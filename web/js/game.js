// Modo "Jogar": interface e integracao com o visualizador 3D. A logica (perguntas, revisao
// espacada, pontos) fica em game-core.js; os dados vem de data/estruturas.json.
import * as core from "./game-core.js";

const STORAGE_KEY = "anatomia-fono-3d:jogo:v1";

function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function initGame(ctx) {
  const { THREE, state, camera, controls } = ctx;
  const root = document.getElementById("game-root");

  let data = null;
  let progress = loadProgress();
  const G = {
    active: false, snapshot: null, isolate: true,
    regionId: null, regionCats: new Set(),
    round: null, q: null, answered: false,
    highlights: [], candidate: null, cycle: { x: null, y: null, hits: null, index: 0 },
    framed: false, loadingToken: 0,
  };

  // ------------------------------------------------------------ persistencia
  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = core.validarProgresso(JSON.parse(raw));
        if (v.ok) return v.progresso;
      }
    } catch (e) { /* storage indisponivel ou corrompido: recomeca */ }
    return core.novoProgresso();
  }
  function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) { /* modo privado: segue sem salvar */ }
  }

  // --------------------------------------------------------------- materiais 3D
  const mk = (color, emissive) => new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: 0.75, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide, depthTest: false,
  });
  const MAT = {
    alvo: mk(0x4fb0ff, 0x1c5f9e), certo: mk(0x3ddc84, 0x137a40), errado: mk(0xff5d5d, 0x8a1c1c), candidato: mk(0xffb84f, 0x8a5a10),
  };

  function highlight(meshes, kind) {
    for (const m of meshes) {
      m.material = MAT[kind];
      m.renderOrder = 998;
      if (!G.highlights.includes(m)) G.highlights.push(m);
    }
  }
  function clearHighlights() {
    for (const m of G.highlights) {
      m.material = ctx.materialForMesh(m);
      m.renderOrder = 0;
    }
    G.highlights = [];
  }

  function idForMesh(mesh) {
    return ctx.normalizeKey(ctx.baseName(mesh.name)).replace(/ /g, "-");
  }
  function meshesOf(e, { corpo = true } = {}) {
    const out = [];
    for (const o of e.objetos) {
      if (corpo && o.papel === "fixacao") continue;
      const cat = state.categories[o.categoria_app];
      const m = cat && cat.objects.get(o.nome);
      if (m) out.push(m);
    }
    return out;
  }

  // ---------------------------------------------------------------- camera
  function frameBox(box, dir, factor) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(box.getSize(new THREE.Vector3()).length(), 0.02);
    controls.target.copy(center);
    camera.position.copy(center.clone().add(dir.clone().normalize().multiplyScalar(size * factor)));
    camera.near = Math.max(size / 1000, 0.001);
    camera.far = size * 50;
    camera.updateProjectionMatrix();
    controls.update();
  }
  function frameRegion() {
    const box = new THREE.Box3();
    for (const k of G.regionCats) {
      const c = state.categories[k];
      if (c && c.root) box.union(new THREE.Box3().setFromObject(c.root));
    }
    frameBox(box, new THREE.Vector3(0.5, 0.35, 0.8), 0.9);
    G.framed = false;
  }
  function frameMeshes(meshes) {
    const box = new THREE.Box3();
    for (const m of meshes) box.union(new THREE.Box3().setFromObject(m));
    const dir = camera.position.clone().sub(controls.target);
    frameBox(box, dir.lengthSq() > 0 ? dir : new THREE.Vector3(0.5, 0.35, 0.8), 2.4);
    G.framed = true;
  }

  // ------------------------------------------------ visibilidade (isolar regiao)
  function applyVisibility() {
    for (const [key, cat] of Object.entries(state.categories)) {
      if (!cat.root) continue;
      cat.root.visible = G.regionCats.has(key) || !G.isolate;
    }
  }
  async function ensureRegion(regiaoId) {
    if (G.regionId === regiaoId && G.regionCats.size) return;
    const phase = data.phases.find((p) => p.id === regiaoId);
    const token = ++G.loadingToken;
    setLoading(`Carregando ${phase.nome}…`);
    // categorias da regiao + "contexto" (ex.: o cranio nas fases de marcos osseos e nervos, que sem ele ficariam soltos no espaco)
    const todas = [...phase.categorias_app, ...phase.contexto_app];
    try {
      await Promise.all(todas.map((c) => ctx.loadCategory(c)));
    } finally {
      if (token === G.loadingToken) setLoading(null);
    }
    for (const c of todas) {
      const cat = state.categories[c];
      if (!cat || !cat.loaded) throw new Error("Não foi possível carregar o modelo 3D desta região.");
    }
    G.regionId = regiaoId;
    G.regionCats = new Set(todas);
    for (const c of G.regionCats) for (const m of state.categories[c].objects.values()) m.visible = true;
    applyVisibility();
    frameRegion();
    syncHud();
  }
  function showAllInRegion() {
    for (const c of G.regionCats) for (const m of state.categories[c].objects.values()) m.visible = true;
  }

  // -------------------------------------------------------------- estrutura da UI
  const ui = {
    loading: h("div", { class: "game-loading", hidden: true }),
    hud: h("div", { class: "game-hud", hidden: true }),
    panel: h("div", { class: "game-panel", hidden: true, "aria-live": "polite" }),
    menu: h("div", { class: "game-menu", hidden: true }),
    modal: h("div", { class: "game-modal", hidden: true }),
  };
  root.append(ui.menu, ui.hud, ui.panel, ui.modal, ui.loading);

  function setLoading(text) {
    ui.loading.hidden = !text;
    ui.loading.textContent = text || "";
  }
  function showOnly(which) {
    ui.menu.hidden = which !== "menu";
    ui.hud.hidden = which !== "round";
    ui.panel.hidden = which !== "round";
  }
  function closeModal() { ui.modal.hidden = true; ui.modal.replaceChildren(); }
  function openModal(title, ...content) {
    ui.modal.replaceChildren(
      h("div", { class: "game-modal-box", role: "dialog", "aria-label": title },
        h("div", { class: "game-modal-head" }, h("h3", { text: title }), h("button", { class: "game-x", "aria-label": "Fechar", onclick: closeModal, text: "✕" })),
        h("div", { class: "game-modal-body" }, content)));
    ui.modal.hidden = false;
  }

  const stars = (n, of = 3) => "★".repeat(n) + "☆".repeat(of - n);

  // ------------------------------------------------------------------- menu
  function renderMenu() {
    G.round = null; G.q = null; G.answered = false;
    clearHighlights();
    const lock = core.fasesDesbloqueadas(data.phases, progress);
    const pendentes = core.revisaoCandidatos(data, progress).length;
    const cards = data.phases.map((p) => {
      const f = progress.fases[p.id];
      const melhor = f && f.melhor;
      const liberada = p.jogavel && lock[p.id];
      const btn = h("button", {
        class: "phase-card" + (liberada ? "" : " locked"), disabled: !liberada,
        onclick: () => startRound(p, false),
        "aria-label": `${p.nome}${liberada ? "" : p.jogavel ? " (bloqueada)" : " (indisponível)"}`,
      },
        h("div", { class: "phase-order", text: String(p.ordem) }),
        h("div", { class: "phase-title", text: p.nome }),
        h("div", { class: "phase-meta", text: `${p.n_estruturas} estruturas · ${p.n_relevantes} de fono` }),
        h("div", { class: "phase-stars", text: melhor ? stars(melhor.estrelas) : stars(0) }),
        h("div", { class: "phase-best", text: !p.jogavel ? "Poucas perguntas disponíveis" : !lock[p.id] ? "🔒 Ganhe 1 estrela na fase anterior" : melhor ? `Melhor: ${melhor.acertos}/${melhor.total} · ${melhor.pontos} pts` : "Ainda não jogada" }));
      return btn;
    });
    const t = progress.totais;
    ui.menu.replaceChildren(
      h("div", { class: "game-menu-inner" },
        h("div", { class: "game-menu-top" },
          h("h2", { text: "🎮 Jogar" }),
          h("button", { class: "game-btn ghost", onclick: exit, text: "✕ Sair do jogo" })),
        h("div", { class: "game-stats" },
          h("span", { text: `⭐ ${t.pontos} pontos` }), h("span", { text: `🔥 melhor sequência: ${t.melhor_sequencia}` }),
          h("span", { text: `🎯 ${t.respostas ? Math.round((100 * t.acertos) / t.respostas) : 0}% de acertos` })),
        h("div", { class: "game-actions" },
          h("button", { class: "game-btn", disabled: pendentes === 0, onclick: () => startRound(null, true), text: `🔁 Revisar meus erros (${pendentes})` }),
          h("button", { class: "game-btn ghost", onclick: openProgress, text: "📊 Progresso e backup" }),
          h("button", { class: "game-btn ghost", onclick: openCredits, text: "ℹ️ Créditos e fontes" })),
        h("p", { class: "game-hint", text: "Cada fase tem 10 perguntas: encontrar a peça no 3D, identificá-la e responder sobre função, origem, inserção e inervação. Ganhe pelo menos 1 estrela (50% de acertos) para liberar a próxima fase." }),
        h("div", { class: "game-phases" }, cards),
        h("p", { class: "game-note", text: "Aviso: descrições e perguntas foram traduzidas ou escritas por IA e ainda não foram revisadas por um especialista. Confira em fontes de referência antes de estudar para prova." })));
    showOnly("menu");
  }

  function openCredits() {
    const credits = document.getElementById("credits");
    openModal("Créditos e fontes",
      h("p", { text: (credits ? credits.textContent : "").replace(/\s+/g, " ").trim() }),
      h("p", { text: "Os modelos 3D e os textos são distribuídos sob licenças Creative Commons (CC BY-SA); qualquer cópia ou adaptação deve manter a atribuição e a mesma licença. Detalhes em docs/fase-0/inventario-licencas.md." }),
      h("p", { text: "Links da página de origem de cada descrição (Wikipédia) estão no campo fontes.descricao_url de data/estruturas.json." }));
  }

  // --------------------------------------------------------- progresso / backup
  function openProgress() {
    const t = progress.totais;
    const body = [
      h("ul", { class: "game-list" },
        h("li", { text: `Pontos: ${t.pontos}` }), h("li", { text: `Rodadas jogadas: ${t.rodadas}` }),
        h("li", { text: `Respostas: ${t.respostas} (${t.acertos} certas)` }), h("li", { text: `Melhor sequência de acertos: ${t.melhor_sequencia}` }),
        h("li", { text: `Itens em revisão espaçada: ${Object.keys(progress.itens).length}` })),
      h("div", { class: "game-actions col" },
        h("button", { class: "game-btn", onclick: exportProgress, text: "⬇ Exportar progresso (arquivo JSON)" }),
        h("button", { class: "game-btn", onclick: importProgress, text: "⬆ Importar progresso (substitui o atual)" }),
        h("label", { class: "game-check" },
          h("input", { type: "checkbox", checked: progress.config.liberar_tudo, onchange: (ev) => { progress.config.liberar_tudo = ev.target.checked; saveProgress(); renderMenu(); } }),
          " Liberar todas as fases (modo professor/teste)"),
        h("button", { class: "game-btn danger", onclick: resetProgress, text: "🗑 Zerar progresso" })),
      h("p", { class: "game-hint", text: "O progresso fica salvo só neste navegador. Para trocar de aparelho, exporte aqui e importe no outro." }),
    ];
    openModal("Progresso e backup", ...body);
  }
  function exportProgress() {
    const blob = new Blob([JSON.stringify(progress, null, 1)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `progresso-anatomia-fono-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importProgress() {
    const input = h("input", { type: "file", accept: "application/json,.json" });
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const v = core.validarProgresso(JSON.parse(await file.text()));
        if (!v.ok) { alert("Não foi possível importar: " + v.erro); return; }
        if (!confirm("Substituir o progresso atual pelo do arquivo?")) return;
        progress = v.progresso;
        saveProgress();
        closeModal();
        renderMenu();
      } catch (e) { alert("Arquivo inválido: não é um JSON de progresso."); }
    });
    input.click();
  }
  function resetProgress() {
    if (!confirm("Apagar todo o progresso (pontos, estrelas e revisão de erros)? Isso não pode ser desfeito.")) return;
    progress = core.novoProgresso();
    saveProgress();
    closeModal();
    renderMenu();
  }

  // ------------------------------------------------------------------ rodada
  async function startRound(phase, revisao) {
    try {
      let cands;
      if (revisao) {
        cands = core.revisaoCandidatos(data, progress);
        if (!cands.length) return;
      } else {
        cands = phase.candidatos;
      }
      core.iniciarSessao(progress);
      const seed = (Date.now() ^ (progress.sessao * 2654435761)) >>> 0;
      const rng = core.mulberry32(seed);
      const picked = core.pickRound(cands, progress, core.ROUND_SIZE, rng);
      G.round = { phase, revisao, cands: picked, i: 0, acertos: 0, pontos: 0, streak: 0, melhorSeq: 0, rng };
      saveProgress();
      clearHighlights();
      showOnly("round");
      await showQuestion();
    } catch (err) {
      setLoading(null);
      alert(err.message || String(err));
      renderMenu();
    }
  }

  async function showQuestion() {
    const R = G.round;
    const cand = R.cands[R.i];
    const e = cand.e;
    clearHighlights();
    G.candidate = null;
    G.answered = false;
    G.hint = false;
    G.cycle = { x: null, y: null, hits: null, index: 0 };
    await ensureRegion(e.regiao);
    if (G.framed) frameRegion();
    G.q = core.buildQuestion(data, cand.id, cand.tipo, R.rng);
    const meshes = meshesOf(e);
    for (const m of meshes) for (const t of ctx.twinsOf(m)) t.visible = true; // peca-alvo escondida pelo jogador volta a aparecer
    if (cand.tipo === "identifique" && meshes.length) {
      highlight(meshes.flatMap((m) => ctx.twinsOf(m)), "alvo");
      frameMeshes(meshes);
    }
    syncHud();
    renderPanel();
  }

  function syncHud() {
    const R = G.round;
    if (!R) return;
    const nomeFase = R.revisao ? "Revisão de erros" : R.phase.nome;
    ui.hud.replaceChildren(
      h("div", { class: "hud-row" },
        h("button", { class: "game-btn small ghost", onclick: confirmLeaveRound, text: "✕ Sair" }),
        h("div", { class: "hud-title" }, h("strong", { text: nomeFase }), h("span", { text: ` · pergunta ${Math.min(R.i + 1, R.cands.length)}/${R.cands.length}` })),
        h("div", { class: "hud-score", title: "Pontos e sequência de acertos" }, h("span", { text: `⭐ ${R.pontos}` }), h("span", { text: `🔥 ${R.streak}` }))),
      h("div", { class: "hud-row tools" },
        h("button", { class: "game-btn small ghost" + (G.isolate ? " on" : ""), title: "Mostra só as peças desta região", onclick: () => { G.isolate = !G.isolate; applyVisibility(); syncHud(); }, text: G.isolate ? "🎯 Região isolada" : "🎯 Mostrar contexto" }),
        h("button", { class: "game-btn small ghost", title: "Reexibe peças que você ocultou", onclick: showAllInRegion, text: "↺ Mostrar tudo" }),
        h("button", { class: "game-btn small ghost", title: "Volta a câmera para a região", onclick: frameRegion, text: "⌖ Enquadrar" }),
        h("button", { class: "game-btn small ghost", onclick: openCredits, "aria-label": "Créditos e fontes", text: "ℹ" })));
  }

  function confirmLeaveRound() {
    if (confirm("Sair desta rodada? As respostas já dadas ficam salvas, mas a rodada não conta estrelas.")) {
      clearHighlights();
      saveProgress();
      renderMenu();
    }
  }

  // ------------------------------------------------------------ painel de pergunta
  function renderPanel() {
    const q = G.q;
    const c = [];
    c.push(h("div", { class: "q-type", text: core.TYPES[q.tipo].nome }));
    if (q.tipo === "encontre") {
      c.push(h("div", { class: "q-prompt" }, q.prompt, " ", h("strong", { text: q.alvo })));
      if (q.alvoLatim) c.push(h("div", { class: "q-latin", text: q.alvoLatim }));
      c.push(h("div", { class: "q-help", id: "q-help", text: "Toque na peça. Toque de novo no mesmo ponto para alternar entre peças sobrepostas. Clique com o botão direito (ou segure) para ocultar peças da frente." }));
      c.push(h("div", { class: "q-actions" },
        h("button", { class: "game-btn primary big", id: "q-confirm", disabled: true, onclick: confirmFind, text: "Confirmar" }),
        h("button", { class: "game-btn big", id: "q-hint", title: "Centraliza a câmera na região da peça; vale metade dos pontos", onclick: useHint, text: "💡 Dica" }),
        h("button", { class: "game-btn ghost big", onclick: () => finish(false, { skipped: true }), text: "Não sei" })));
    } else {
      c.push(h("div", { class: "q-prompt", text: q.prompt }));
      c.push(h("div", { class: "q-options" }, q.opcoes.map((o, i) =>
        h("button", { class: "q-option", "data-i": i, onclick: () => answerOption(i) }, h("span", { class: "q-letter", text: "ABCD"[i] }), h("span", { text: o.texto })))));
      c.push(h("div", { class: "q-actions" }, h("button", { class: "game-btn ghost", onclick: () => finish(false, { skipped: true }), text: "Não sei" })));
    }
    c.push(h("div", { class: "q-feedback", id: "q-feedback", hidden: true }));
    ui.panel.replaceChildren(...c);
  }

  function setCandidate(mesh, stackInfo) {
    clearHighlights();
    G.candidate = mesh;
    const confirm = document.getElementById("q-confirm");
    const help = document.getElementById("q-help");
    if (mesh) {
      highlight(ctx.twinsOf(mesh), "candidato");
      if (confirm) confirm.disabled = false;
      if (help) help.textContent = `Peça escolhida${stackInfo && stackInfo.total > 1 ? ` (${stackInfo.index + 1} de ${stackInfo.total} neste ponto — toque de novo para alternar)` : ""}. Confirme ou toque em outra peça.`;
    } else {
      if (confirm) confirm.disabled = true;
    }
  }

  function onCanvasClick(event) {
    if (!G.active || !G.q || G.q.tipo !== "encontre" || G.answered || !ui.menu.hidden) return;
    const hits = ctx.raycastAllHits(event.clientX, event.clientY);
    if (!hits.length) { G.cycle = { x: null, y: null, hits: null, index: 0 }; setCandidate(null); return; }
    const same = G.cycle.hits && Math.hypot(event.clientX - G.cycle.x, event.clientY - G.cycle.y) < 6;
    const index = same ? (G.cycle.index + 1) % hits.length : 0;
    G.cycle = { x: event.clientX, y: event.clientY, hits, index };
    setCandidate(hits[index].object, { index, total: hits.length });
  }

  function useHint() {
    if (G.answered || G.hint) return;
    const e = G.round.cands[G.round.i].e;
    const meshes = meshesOf(e);
    if (!meshes.length) return;
    G.hint = true;
    frameMeshes(meshes); // so aproxima a camera; a peca continua sem destaque
    const help = document.getElementById("q-help");
    if (help) help.textContent = "Dica usada: a câmera foi para a região da peça (esta pergunta vale metade dos pontos). Toque na peça para escolher.";
    const btn = document.getElementById("q-hint");
    if (btn) btn.disabled = true;
  }

  function confirmFind() {
    if (G.answered || !G.candidate) return;
    const e = G.round.cands[G.round.i].e;
    finish(idForMesh(G.candidate) === e.id, { candidate: G.candidate });
  }
  function answerOption(i) {
    if (G.answered) return;
    finish(i === G.q.correta, { chosen: i });
  }

  // ------------------------------------------------------------------ resposta
  function finish(correct, extra) {
    if (G.answered) return;
    G.answered = true;
    const R = G.round;
    const cand = R.cands[R.i];
    const e = cand.e;
    core.registrarResposta(progress, cand, correct);
    let ganho = 0;
    if (correct) {
      R.streak += 1;
      R.melhorSeq = Math.max(R.melhorSeq, R.streak);
      R.acertos += 1;
      ganho = core.pontosDaResposta(e.dificuldade, R.streak);
      if (G.hint) ganho = Math.round(ganho / 2);
      R.pontos += ganho;
    } else {
      R.streak = 0;
    }
    saveProgress();

    // destaque do 3D: a peça certa em verde; se errou ao clicar, a escolhida em vermelho
    clearHighlights();
    const meshes = meshesOf(e);
    if (extra && extra.candidate && !correct) highlight(ctx.twinsOf(extra.candidate), "errado");
    if (meshes.length) {
      highlight(meshes.flatMap((m) => ctx.twinsOf(m)), "certo");
      frameMeshes(meshes);
    }

    // marca as alternativas
    if (G.q.opcoes) {
      ui.panel.querySelectorAll(".q-option").forEach((b) => {
        const i = Number(b.dataset.i);
        b.disabled = true;
        if (i === G.q.correta) b.classList.add("certo");
        else if (extra && extra.chosen === i) b.classList.add("errado");
      });
    }
    const confirmBtn = document.getElementById("q-confirm");
    if (confirmBtn) confirmBtn.disabled = true;
    const helpEl = document.getElementById("q-help");
    if (helpEl) helpEl.hidden = true;
    ui.panel.querySelectorAll(".q-actions .game-btn").forEach((b) => (b.hidden = true));

    const ultima = R.i >= R.cands.length - 1;
    const fb = document.getElementById("q-feedback");
    fb.className = "q-feedback " + (correct ? "certo" : "errado");
    fb.replaceChildren(
      h("div", { class: "fb-title", text: correct ? `✅ Correto! +${ganho} pontos${G.hint ? " (com dica)" : ""}${R.streak >= 2 ? ` · 🔥 ${R.streak} seguidas` : ""}` : extra && extra.skipped ? "💡 Sem problema — veja a resposta:" : "❌ Não foi dessa vez." }),
      h("div", { class: "fb-text", text: G.q.explicacao }),
      meshes.length ? h("div", { class: "fb-3d", text: "A peça correta está destacada em verde no modelo 3D." }) : null,
      h("button", { class: "game-btn primary big", onclick: next, text: ultima ? "Ver resultado" : "Próxima ▶" }));
    fb.hidden = false;
    fb.scrollIntoView({ block: "nearest" });
    syncHud();
  }

  async function next() {
    const R = G.round;
    if (!R) return;
    if (R.i >= R.cands.length - 1) { endRound(); return; }
    R.i += 1;
    try { await showQuestion(); } catch (err) { setLoading(null); alert(err.message || String(err)); renderMenu(); }
  }

  function endRound() {
    const R = G.round;
    clearHighlights();
    const resumo = { acertos: R.acertos, total: R.cands.length, pontos: R.pontos, melhorSequencia: R.melhorSeq };
    const lockAntes = core.fasesDesbloqueadas(data.phases, progress);
    const { recorde } = core.concluirRodada(progress, R.phase ? R.phase.id : null, resumo, R.revisao);
    saveProgress();
    const n = core.estrelas(resumo.acertos, resumo.total);
    const lock = core.fasesDesbloqueadas(data.phases, progress);
    const jog = data.phases.filter((p) => p.jogavel);
    const idx = R.phase ? jog.findIndex((p) => p.id === R.phase.id) : -1;
    const prox = idx >= 0 ? jog[idx + 1] : null;
    ui.hud.hidden = true;
    ui.panel.replaceChildren(
      h("div", { class: "summary" },
        h("div", { class: "summary-stars", text: R.revisao ? "🔁" : stars(n) }),
        h("h3", { text: R.revisao ? "Revisão concluída" : n >= 1 ? "Fase concluída!" : "Quase lá — tente de novo" }),
        h("div", { class: "summary-line", text: `${resumo.acertos} de ${resumo.total} certas · ${resumo.pontos} pontos · melhor sequência ${resumo.melhorSequencia}` }),
        recorde ? h("div", { class: "summary-record", text: "🏆 Novo recorde nesta fase!" }) : null,
        !R.revisao && prox && lock[prox.id] && !lockAntes[prox.id] ? h("div", { class: "summary-record", text: `🔓 Liberada: ${prox.nome}` }) : null,
        h("div", { class: "q-actions" },
          !R.revisao || core.revisaoCandidatos(data, progress).length ? h("button", { class: "game-btn primary big", onclick: () => startRound(R.phase, R.revisao), text: R.revisao ? "Revisar mais erros" : "Jogar de novo" }) : null,
          !R.revisao && prox && lock[prox.id] ? h("button", { class: "game-btn big", onclick: () => startRound(prox, false), text: "Próxima fase ▶" }) : null,
          h("button", { class: "game-btn ghost big", onclick: renderMenu, text: "Menu" }))));
    ui.panel.hidden = false;
  }

  // ----------------------------------------------- ocultar pecas (botao direito / toque longo)
  function onContextMenuAt(x, y) {
    if (!G.active || !ui.menu.hidden) return;
    const menu = document.getElementById("ctx-menu");
    const hits = ctx.raycastAllHits(x, y);
    menu.replaceChildren();
    const add = (label, fn) => menu.append(h("button", { type: "button", class: "ctx-item", onclick: () => { fn(); menu.hidden = true; }, text: label }));
    if (hits.length) {
      add("🚫 Ocultar a peça da frente", () => {
        for (const t of ctx.twinsOf(hits[0].object)) t.visible = false;
        if (G.candidate && ctx.twinsOf(hits[0].object).includes(G.candidate)) setCandidate(null);
      });
    }
    add("↺ Mostrar todas as peças da região", showAllInRegion);
    add("⌖ Enquadrar a região", frameRegion);
    menu.hidden = false;
    menu.style.left = "0px"; menu.style.top = "0px";
    const w = 250, hgt = menu.offsetHeight;
    menu.style.left = `${Math.min(x, window.innerWidth - w - 8)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - hgt - 8)}px`;
  }

  // --------------------------------------------------------------- entrar / sair
  function snapshot() {
    const cats = {};
    for (const [k, c] of Object.entries(state.categories)) {
      cats[k] = { loaded: c.loaded, rootVisible: c.root ? c.root.visible : false, meshes: c.root ? [...c.objects.values()].map((m) => [m, m.visible]) : [] };
    }
    return { cats, pos: camera.position.clone(), target: controls.target.clone(), near: camera.near, far: camera.far };
  }
  function restore(s) {
    for (const [k, c] of Object.entries(state.categories)) {
      if (!c.root) continue;
      const sc = s.cats[k];
      if (sc && sc.loaded) {
        c.root.visible = sc.rootVisible;
        for (const [m, v] of sc.meshes) m.visible = v;
      } else {
        c.root.visible = false; // carregada so durante o jogo; no modo estudo continua desmarcada
      }
    }
    camera.position.copy(s.pos);
    controls.target.copy(s.target);
    camera.near = s.near; camera.far = s.far;
    camera.updateProjectionMatrix();
    controls.update();
    ctx.syncEyeIcons();
  }

  async function enter() {
    if (G.active) return;
    const btn = document.getElementById("btn-game");
    try {
      if (btn) btn.disabled = true;
      if (!data) {
        setLoading("Carregando a base de dados…");
        const res = await fetch("../data/estruturas.json", { cache: "no-store" });
        if (!res.ok) throw new Error("Não foi possível carregar data/estruturas.json (" + res.status + ").");
        data = core.prepareData(await res.json());
      }
    } catch (err) {
      setLoading(null);
      alert(err.message || String(err));
      if (btn) btn.disabled = false;
      return;
    }
    setLoading(null);
    if (btn) btn.disabled = false;
    ctx.prepareForGame(); // fecha painel de info, limpa selecao e alfinetes
    G.snapshot = snapshot();
    G.active = true;
    G.regionId = null; G.regionCats = new Set();
    state.mode = "jogo";
    document.body.classList.add("mode-jogo");
    window.dispatchEvent(new Event("resize"));
    renderMenu();
  }

  function exit() {
    if (!G.active) return;
    clearHighlights();
    closeModal();
    G.active = false;
    G.round = null; G.q = null;
    state.mode = "estudo";
    document.body.classList.remove("mode-jogo");
    showOnly(null);
    document.getElementById("ctx-menu").hidden = true;
    if (G.snapshot) restore(G.snapshot);
    G.snapshot = null;
    window.dispatchEvent(new Event("resize"));
  }

  // __estado: so para testes automatizados (le a pergunta atual, inclusive a resposta certa)
  return { enter, exit, onCanvasClick, onContextMenuAt, isActive: () => G.active, __estado: () => ({ q: G.q, round: G.round, answered: G.answered, candidate: G.candidate, regionId: G.regionId, progress, data }) };
}
