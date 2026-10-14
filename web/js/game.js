// Modo "Jogar": interface e integracao com o visualizador 3D. A logica (perguntas, revisao
// espacada, pontos, ranking) fica em game-core.js; os dados vem de data/estruturas.json.
import * as core from "./game-core.js";

const PLAYERS_KEY = "anatomia-fono-3d:jogadores:v1";
const LEGACY_PROGRESS_KEY = "anatomia-fono-3d:jogo:v1"; // jogador "padrao" mantem a chave antiga (nao perde progresso)
const SKULL_CAT = "cranio_ossos";

const progressKey = (id) => (id === "padrao" ? LEGACY_PROGRESS_KEY : `${LEGACY_PROGRESS_KEY}:${id}`);

function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "value") node.value = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// ------------------------------------------------------------ armazenamento
function readJson(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* modo privado/cheio: segue sem salvar */ }
}
function loadPlayers() {
  const p = readJson(PLAYERS_KEY);
  if (p && Array.isArray(p.lista) && p.lista.length && p.lista.some((x) => x.id === p.atual)) {
    p.cartoes = Array.isArray(p.cartoes) ? p.cartoes : [];
    return p;
  }
  return { versao: 1, atual: "padrao", lista: [{ id: "padrao", nome: "Jogador", nome_definido: false }], cartoes: [] };
}
function loadProgressOf(id) {
  const v = core.validarProgresso(readJson(progressKey(id)));
  return v.ok ? v.progresso : core.novoProgresso();
}

export function initGame(ctx) {
  const { THREE, state, camera, controls } = ctx;
  const root = document.getElementById("game-root");

  let data = null;
  let players = loadPlayers();
  let progress = loadProgressOf(players.atual);
  const G = {
    active: false, snapshot: null, isolate: true,
    regionId: null, regionCats: new Set(),
    round: null, q: null, answered: false, hint: false,
    highlights: [], candidate: null, cycle: { x: null, y: null, hits: null, index: 0 },
    framed: false, loadingToken: 0,
    skullPref: null, // null = automatico; "solido" | "fantasma" | "oculto"
    skullSet: new Set(),
  };
  const jogador = () => players.lista.find((p) => p.id === players.atual);
  const savePlayers = () => writeJson(PLAYERS_KEY, players);
  const saveProgress = () => writeJson(progressKey(players.atual), progress);

  // --------------------------------------------------------------- materiais 3D
  const mk = (color, emissive) => new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: 0.75, roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide, depthTest: false,
  });
  const MAT = {
    alvo: mk(0x4fb0ff, 0x1c5f9e), certo: mk(0x3ddc84, 0x137a40), errado: mk(0xff5d5d, 0x8a1c1c), candidato: mk(0xffb84f, 0x8a5a10),
  };
  // cranio de contexto: "fantasma" deixa ver (e clicar) o que esta atras dele
  const GHOST = new THREE.MeshStandardMaterial({
    color: 0xe8e2d0, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
  });

  function skullMode() {
    return G.skullPref || (G.regionId === "cranio" ? "solido" : "fantasma");
  }
  function restoreMaterial(m) {
    return G.skullSet.has(m) && skullMode() === "fantasma" ? GHOST : ctx.materialForMesh(m);
  }
  function highlight(meshes, kind) {
    for (const m of meshes) {
      m.material = MAT[kind];
      m.renderOrder = 998;
      if (!G.highlights.includes(m)) G.highlights.push(m);
    }
  }
  function clearHighlights() {
    for (const m of G.highlights) {
      m.material = restoreMaterial(m);
      m.renderOrder = G.skullSet.has(m) && skullMode() === "fantasma" ? -1 : 0;
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
  // cranio de contexto nao atrapalha o clique, a menos que esteja solido ou a fase seja a dos ossos
  const pickAccept = (m) => !G.skullSet.has(m) || skullMode() === "solido" || G.regionId === "cranio";

  // -------------------------------------------------------------------- camera
  function frameBox(box, dir, factor) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(box.getSize(new THREE.Vector3()).length(), 0.02);
    controls.target.copy(center);
    // em tela vertical (celular) a largura visivel e menor: afasta a camera para nao cortar as laterais
    const retrato = Math.max(1, 1 / Math.max(camera.aspect, 0.3));
    camera.position.copy(center.clone().add(dir.clone().normalize().multiplyScalar(size * factor * retrato)));
    camera.near = Math.max(size / 1000, 0.001);
    camera.far = size * 50;
    camera.updateProjectionMatrix();
    controls.update();
  }
  // semCranio=false (padrao): enquadra a regiao e o cranio inteiro, para o cranio aparecer completo em
  // todas as fases; semCranio=true aproxima so da regiao (pecas pequenas ficam maiores)
  function frameRegion(semCranio = false) {
    const box = new THREE.Box3();
    for (const k of G.regionCats) {
      if (semCranio && k === SKULL_CAT && G.regionId !== "cranio") continue;
      const c = state.categories[k];
      if (c && c.root) c.root.traverse((m) => { if (m.isMesh && m.visible) box.union(new THREE.Box3().setFromObject(m)); });
    }
    if (!semCranio && skullMode() !== "oculto") {
      for (const m of G.skullSet) if (m.visible) box.union(new THREE.Box3().setFromObject(m));
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

  // ------------------------------------------------ visibilidade (regiao + cranio)
  function computeSkullSet() {
    const cat = state.categories[SKULL_CAT];
    G.skullSet = new Set();
    if (!cat || !cat.loaded || !data) return;
    for (const e of data.db.estruturas) {
      if (e.regiao !== "cranio" || e.tipo !== "osso") continue;
      for (const o of e.objetos) {
        if (o.papel === "fixacao" || o.categoria_app !== SKULL_CAT) continue;
        const m = cat.objects.get(o.nome);
        if (m) G.skullSet.add(m);
      }
    }
  }
  function applySkull() {
    const cat = state.categories[SKULL_CAT];
    if (!cat || !cat.root) return;
    const mode = skullMode();
    cat.root.visible = mode !== "oculto";
    for (const m of G.skullSet) {
      if (G.highlights.includes(m)) continue;
      m.material = mode === "fantasma" ? GHOST : ctx.materialForMesh(m);
      m.renderOrder = mode === "fantasma" ? -1 : 0;
    }
  }
  function applyVisibility() {
    for (const [key, cat] of Object.entries(state.categories)) {
      if (!cat.root || key === SKULL_CAT) continue;
      cat.root.visible = G.regionCats.has(key) || !G.isolate;
    }
    applySkull();
  }
  // mostra todas as pecas da regiao; no cranio, so os ossos (a categoria tambem traz vasos e mucosa)
  function resetRegionMeshes() {
    for (const c of new Set([...G.regionCats, SKULL_CAT])) {
      const cat = state.categories[c];
      if (!cat || !cat.root) continue;
      for (const m of cat.objects.values()) m.visible = c === SKULL_CAT ? G.skullSet.has(m) : true;
    }
  }
  async function ensureRegion(regiaoId) {
    if (G.regionId === regiaoId && G.regionCats.size) return;
    const phase = data.phases.find((p) => p.id === regiaoId);
    const token = ++G.loadingToken;
    setLoading(`Carregando ${phase.nome}…`);
    const regionCats = [...phase.categorias_app, ...phase.contexto_app];
    const todas = [...new Set([...regionCats, SKULL_CAT])];
    try {
      await Promise.all(todas.map((c) => ctx.loadCategory(c)));
    } finally {
      if (token === G.loadingToken) setLoading(null);
    }
    for (const c of todas) {
      const cat = state.categories[c];
      if (!cat || !cat.loaded) throw new Error("Não foi possível carregar o modelo 3D desta região.");
    }
    computeSkullSet();
    G.regionId = regiaoId;
    G.regionCats = new Set(regionCats);
    resetRegionMeshes();
    applyVisibility();
    frameRegion();
    syncHud();
  }
  // baixa em segundo plano a regiao da proxima pergunta (modos misto e revisao trocam de regiao a cada pergunta)
  function prefetchRegionOf(index) {
    const cand = G.round && G.round.cands[index];
    if (!cand || cand.e.regiao === G.regionId) return;
    const ph = data.phases.find((p) => p.id === cand.e.regiao);
    if (!ph) return;
    Promise.all([...ph.categorias_app, ...ph.contexto_app, SKULL_CAT].map((c) => ctx.loadCategory(c, { startHidden: true }))).catch(() => {});
  }
  function showAllInRegion() {
    resetRegionMeshes();
  }

  // ----------------------------------------------------------------- estrutura da UI
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
  const resetRoundState = () => { G.round = null; G.q = null; G.answered = false; clearHighlights(); };

  // ----------------------------------------------------------------- tela inicial
  function menuTop(titulo, voltar) {
    return h("div", { class: "game-menu-top" },
      voltar ? h("button", { class: "game-btn ghost", onclick: voltar, text: "← Voltar" }) : null,
      h("h2", { text: titulo }),
      h("button", { class: "game-btn ghost", onclick: exit, text: "✕ Sair do jogo" }));
  }
  function playerChip() {
    return h("button", { class: "player-chip", title: "Trocar ou adicionar jogador", onclick: openPlayers },
      h("span", { text: "👤 " + jogador().nome }), h("span", { class: "player-chip-sub", text: "trocar" }));
  }

  function renderHome() {
    resetRoundState();
    const pendentes = core.revisaoCandidatos(data, progress).length;
    const t = progress.totais;
    const modo = (icone, titulo, desc, onclick, extra) =>
      h("button", { class: "mode-card", onclick },
        h("div", { class: "mode-icon", text: icone }),
        h("div", { class: "mode-title", text: titulo }),
        h("div", { class: "mode-desc", text: desc }),
        extra ? h("div", { class: "mode-extra", text: extra }) : null);
    const mixed = progress.modos.misto.melhor;
    ui.menu.replaceChildren(
      h("div", { class: "game-menu-inner" },
        menuTop("🎮 Jogar"),
        h("div", { class: "game-subtop" }, playerChip(),
          h("div", { class: "game-stats" },
            h("span", { text: `⭐ ${t.pontos} pontos` }),
            h("span", { text: `🔥 melhor sequência: ${t.melhor_sequencia}` }),
            h("span", { text: `🎯 ${t.respostas ? Math.round((100 * t.acertos) / t.respostas) : 0}% de acertos` }))),
        h("h3", { class: "game-section", text: "Como você quer jogar?" }),
        h("div", { class: "mode-grid" },
          modo("🪜", "Fases", "Suba de nível: cada fase muda as partes e libera a próxima com pelo menos 1 estrela.", renderPhases),
          modo("🎯", "Treino por parte", "Escolha a parte que quer treinar (ossos, músculos, nervos...) e jogue sem passar de fase.", renderPicker),
          modo("🎲", "Tudo misturado", "Perguntas sorteadas de todos os conteúdos: uma de ossos, outra de nervos, outra de músculos...", () => startRound(null, "misto"),
            mixed ? `Melhor: ${mixed.acertos}/${mixed.total} · ${stars(mixed.estrelas)}` : null)),
        h("div", { class: "game-actions" },
          h("button", { class: "game-btn", disabled: pendentes === 0, onclick: () => startRound(null, "revisao"), text: `🔁 Revisar meus erros (${pendentes})` }),
          h("button", { class: "game-btn", onclick: renderRanking, text: "🏆 Ranking" }),
          h("button", { class: "game-btn ghost", onclick: openProgress, text: "📊 Progresso e backup" }),
          h("button", { class: "game-btn ghost", onclick: openCredits, text: "ℹ️ Créditos e fontes" })),
        h("p", { class: "game-note", text: "Aviso: descrições, explicações e perguntas foram traduzidas ou escritas por IA e ainda não foram revisadas por um especialista. Confira em fontes de referência antes de estudar para prova." })));
    showOnly("menu");
  }

  function phaseCard(p, { liberada, melhor, nota, onclick }) {
    return h("button", {
      class: "phase-card" + (liberada ? "" : " locked"), disabled: !liberada, onclick,
      "aria-label": `${p.nome}${liberada ? "" : " (indisponível)"}`,
    },
      h("div", { class: "phase-order", text: String(p.ordem) }),
      h("div", { class: "phase-title", text: p.nome }),
      h("div", { class: "phase-meta", text: `${p.n_estruturas} estruturas · ${p.n_relevantes} de fono` }),
      h("div", { class: "phase-stars", text: melhor ? stars(melhor.estrelas) : stars(0) }),
      h("div", { class: "phase-best", text: nota }));
  }

  function renderPhases() {
    resetRoundState();
    const lock = core.fasesDesbloqueadas(data.phases, progress);
    const cards = data.phases.map((p) => {
      const melhor = progress.fases[p.id] && progress.fases[p.id].melhor;
      const liberada = p.jogavel && lock[p.id];
      const nota = !p.jogavel ? "Poucas perguntas disponíveis" : !lock[p.id] ? "🔒 Ganhe 1 estrela na fase anterior" : melhor ? `Melhor: ${melhor.acertos}/${melhor.total} · ${melhor.pontos} pts` : "Ainda não jogada";
      return phaseCard(p, { liberada, melhor, nota, onclick: () => startRound(p, "fases") });
    });
    ui.menu.replaceChildren(
      h("div", { class: "game-menu-inner" },
        menuTop("🪜 Fases", renderHome),
        h("p", { class: "game-hint", text: "Cada fase tem 10 perguntas. Ganhe pelo menos 1 estrela (50% de acertos) para liberar a próxima." }),
        h("div", { class: "game-phases" }, cards)));
    showOnly("menu");
  }

  function renderPicker() {
    resetRoundState();
    const cards = data.phases.map((p) => {
      const rec = progress.modos.livre[p.id];
      const melhor = rec && rec.melhor;
      const nota = !p.jogavel ? "Poucas perguntas disponíveis" : melhor ? `Melhor: ${melhor.acertos}/${melhor.total} · ${melhor.pontos} pts` : "Ainda não jogada";
      return phaseCard(p, { liberada: p.jogavel, melhor, nota, onclick: () => startRound(p, "livre") });
    });
    ui.menu.replaceChildren(
      h("div", { class: "game-menu-inner" },
        menuTop("🎯 Treino por parte", renderHome),
        h("p", { class: "game-hint", text: "Escolha qualquer parte, sem precisar passar de fase. Os pontos e a revisão de erros contam normalmente." }),
        h("div", { class: "game-phases" }, cards)));
    showOnly("menu");
  }

  function openCredits() {
    const credits = document.getElementById("credits");
    openModal("Créditos e fontes",
      h("p", { text: (credits ? credits.textContent : "").replace(/\s+/g, " ").trim() }),
      h("p", { text: "Os modelos 3D e os textos são distribuídos sob licenças Creative Commons (CC BY-SA); qualquer cópia ou adaptação deve manter a atribuição e a mesma licença. Detalhes em docs/fase-0/inventario-licencas.md." }),
      h("p", { text: "O link da página de origem de cada descrição (Wikipédia) aparece no painel de informações do modo de estudo. As explicações completas, funções, origens, inserções e inervações foram escritas por IA, sem revisão profissional." }));
  }

  // ---------------------------------------------------------- jogadores e ranking
  function openNamePrompt() {
    const input = h("input", { type: "text", class: "game-input", maxlength: "24", placeholder: "Seu nome ou apelido", value: jogador().nome_definido ? jogador().nome : "" });
    const save = () => {
      const nome = input.value.replace(/[<>]/g, "").trim().slice(0, 24) || "Jogador";
      jogador().nome = nome;
      jogador().nome_definido = true;
      savePlayers();
      closeModal();
      renderHome();
    };
    openModal("Qual é o seu nome?",
      h("p", { text: "O nome aparece no ranking e no cartão de pontuação que você pode compartilhar com colegas. Fica salvo só neste aparelho." }),
      input,
      h("div", { class: "game-actions" },
        h("button", { class: "game-btn primary", onclick: save, text: "Salvar" }),
        h("button", { class: "game-btn ghost", onclick: () => { jogador().nome_definido = true; savePlayers(); closeModal(); }, text: "Agora não" })));
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") save(); });
    setTimeout(() => input.focus(), 50);
  }

  function switchPlayer(id) {
    saveProgress();
    players.atual = id;
    savePlayers();
    progress = loadProgressOf(id);
    closeModal();
    renderHome();
  }
  function openPlayers() {
    const input = h("input", { type: "text", class: "game-input", maxlength: "24", placeholder: "Nome do novo jogador" });
    const addPlayer = () => {
      const nome = input.value.replace(/[<>]/g, "").trim().slice(0, 24);
      if (!nome) return;
      const id = "p" + Date.now().toString(36);
      players.lista.push({ id, nome, nome_definido: true });
      switchPlayer(id);
    };
    const rows = players.lista.map((p) => {
      const prog = p.id === players.atual ? progress : loadProgressOf(p.id);
      return h("div", { class: "player-row" + (p.id === players.atual ? " atual" : "") },
        h("button", { class: "player-pick", onclick: () => switchPlayer(p.id) },
          h("span", { text: (p.id === players.atual ? "● " : "○ ") + p.nome }),
          h("span", { class: "player-pts", text: `${prog.totais.pontos} pts` })),
        h("button", { class: "game-x", title: "Renomear", "aria-label": "Renomear", onclick: () => {
          const novo = prompt("Novo nome:", p.nome);
          if (novo && novo.trim()) { p.nome = novo.replace(/[<>]/g, "").trim().slice(0, 24); p.nome_definido = true; savePlayers(); openPlayers(); }
        }, text: "✏️" }),
        players.lista.length > 1 ? h("button", { class: "game-x", title: "Apagar jogador", "aria-label": "Apagar jogador", onclick: () => {
          if (!confirm(`Apagar o jogador "${p.nome}" e todo o progresso dele neste aparelho?`)) return;
          try { localStorage.removeItem(progressKey(p.id)); } catch (e) { /* ignora */ }
          players.lista = players.lista.filter((x) => x.id !== p.id);
          if (players.atual === p.id) { players.atual = players.lista[0].id; progress = loadProgressOf(players.atual); }
          savePlayers();
          closeModal();
          renderHome();
        }, text: "🗑" }) : null);
    });
    openModal("Jogadores neste aparelho",
      h("p", { class: "game-hint", text: "Cada jogador tem pontos, estrelas e revisão de erros próprios. Ideal para um computador usado por vários colegas." }),
      h("div", { class: "player-list" }, rows),
      h("div", { class: "player-add" }, input, h("button", { class: "game-btn primary", onclick: addPlayer, text: "➕ Adicionar" })));
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") addPlayer(); });
  }

  function rankingEntries() {
    const out = [];
    for (const p of players.lista) {
      const prog = p.id === players.atual ? progress : loadProgressOf(p.id);
      const c = core.cartaoPontuacao(p.nome, prog);
      out.push({ ...c, origem: "local", id: p.id, atual: p.id === players.atual });
    }
    for (const c of players.cartoes) out.push({ ...c, origem: "importado", id: "c:" + c.nome.toLowerCase() });
    return core.montarRanking(out);
  }
  function renderRanking() {
    resetRoundState();
    const lista = rankingEntries();
    const linhas = lista.map((e) =>
      h("tr", { class: (e.atual ? "voce " : "") + (e.posicao <= 3 ? "top" : "") },
        h("td", { text: ["🥇", "🥈", "🥉"][e.posicao - 1] || String(e.posicao) }),
        h("td", { class: "r-nome" }, h("span", { text: e.nome }),
          e.atual ? h("span", { class: "tag", text: "você" }) : null,
          e.origem === "importado" ? h("span", { class: "tag imp", title: `Cartão importado (gerado em ${new Date(e.gerado_em).toLocaleDateString("pt-BR")})`, text: "importado" }) : null),
        h("td", { class: "num", text: String(e.pontos) }),
        h("td", { class: "num", text: String(e.estrelas) }),
        h("td", { class: "num", text: `${e.pct}%` }),
        h("td", { class: "num", text: String(e.melhor_rodada) }),
        h("td", { class: "num" }, e.origem === "importado" ? h("button", { class: "game-x", title: "Remover do ranking", "aria-label": "Remover do ranking", onclick: () => {
          players.cartoes = players.cartoes.filter((c) => c.nome.toLowerCase() !== e.nome.toLowerCase());
          savePlayers();
          renderRanking();
        }, text: "✕" }) : null)));
    ui.menu.replaceChildren(
      h("div", { class: "game-menu-inner" },
        menuTop("🏆 Ranking", renderHome),
        h("div", { class: "rank-wrap" },
          h("table", { class: "rank-table" },
            h("thead", {}, h("tr", {}, ["#", "Jogador", "Pontos", "⭐", "Acertos", "Melhor rodada", ""].map((t) => h("th", { text: t })))),
            h("tbody", {}, linhas))),
        h("div", { class: "game-actions" },
          h("button", { class: "game-btn primary", onclick: shareCard, text: "📤 Compartilhar meu cartão de pontuação" }),
          h("button", { class: "game-btn", onclick: importCards, text: "📥 Importar cartão de colega" })),
        h("p", { class: "game-hint", text: "Como funciona: o ranking soma os jogadores deste aparelho e os cartões de pontuação que você importar de colegas (cada um gera o seu e envia o arquivo/texto). Ele não é verificado — vale a confiança entre colegas. Um ranking online automático exigiria um servidor e ainda não existe." })));
    showOnly("menu");
  }

  function shareCard() {
    const c = core.cartaoPontuacao(jogador().nome, progress);
    const texto = `🏆 Anatomia 3D Fono — ${c.nome}: ${c.pontos} pontos, ${c.estrelas} ⭐, ${c.respostas ? Math.round((100 * c.acertos) / c.respostas) : 0}% de acertos, melhor rodada ${c.melhor_rodada}.`;
    const blob = new Blob([JSON.stringify(c, null, 1)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `cartao-pontuacao-${c.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    let copiado = false;
    const aviso = () => openModal("Cartão de pontuação",
      h("p", { text: "O arquivo foi baixado. Envie-o aos colegas (eles usam “Importar cartão de colega”). Você também pode colar o texto abaixo no grupo da turma:" }),
      h("p", { class: "card-text", text: texto }),
      copiado ? h("p", { class: "game-hint", text: "Texto copiado para a área de transferência." }) : null);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => { copiado = true; aviso(); }, aviso);
    } else {
      aviso();
    }
  }
  function importCards() {
    const input = h("input", { type: "file", accept: "application/json,.json", multiple: "" });
    input.addEventListener("change", async () => {
      let ok = 0, falhas = 0;
      for (const file of input.files || []) {
        try {
          const v = core.validarCartao(JSON.parse(await file.text()));
          if (!v.ok) { falhas += 1; continue; }
          const k = v.cartao.nome.toLowerCase();
          players.cartoes = players.cartoes.filter((c) => c.nome.toLowerCase() !== k).concat(v.cartao);
          ok += 1;
        } catch (e) { falhas += 1; }
      }
      savePlayers();
      renderRanking();
      if (ok || falhas) alert(`${ok} cartão(ões) importado(s)${falhas ? `, ${falhas} arquivo(s) inválido(s)` : ""}.`);
    });
    input.click();
  }

  // --------------------------------------------------------- progresso / backup
  function openProgress() {
    const t = progress.totais;
    openModal("Progresso e backup",
      h("ul", { class: "game-list" },
        h("li", { text: `Jogador: ${jogador().nome}` }),
        h("li", { text: `Pontos: ${t.pontos} · estrelas: ${core.estrelasTotais(progress)}` }),
        h("li", { text: `Rodadas jogadas: ${t.rodadas}` }),
        h("li", { text: `Respostas: ${t.respostas} (${t.acertos} certas)` }),
        h("li", { text: `Melhor sequência: ${t.melhor_sequencia} · melhor rodada: ${t.melhor_rodada || 0} pontos` }),
        h("li", { text: `Itens em revisão espaçada: ${Object.keys(progress.itens).length}` })),
      h("div", { class: "game-actions col" },
        h("button", { class: "game-btn", onclick: exportProgress, text: "⬇ Exportar progresso (arquivo JSON)" }),
        h("button", { class: "game-btn", onclick: importProgress, text: "⬆ Importar progresso (substitui o do jogador atual)" }),
        h("button", { class: "game-btn", onclick: () => { closeModal(); openNamePrompt(); }, text: "✏️ Mudar meu nome" }),
        h("label", { class: "game-check" },
          h("input", { type: "checkbox", checked: progress.config.liberar_tudo, onchange: (ev) => { progress.config.liberar_tudo = ev.target.checked; saveProgress(); } }),
          " Liberar todas as fases (modo professor/teste)"),
        h("button", { class: "game-btn danger", onclick: resetProgress, text: "🗑 Zerar o progresso deste jogador" })),
      h("p", { class: "game-hint", text: "O progresso fica salvo só neste navegador. Para trocar de aparelho, exporte aqui e importe no outro." }));
  }
  function exportProgress() {
    const blob = new Blob([JSON.stringify(progress, null, 1)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `progresso-anatomia-fono-${jogador().nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.json` });
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
        if (!confirm("Substituir o progresso do jogador atual pelo do arquivo?")) return;
        progress = v.progresso;
        saveProgress();
        closeModal();
        renderHome();
      } catch (e) { alert("Arquivo inválido: não é um JSON de progresso."); }
    });
    input.click();
  }
  function resetProgress() {
    if (!confirm("Apagar todo o progresso deste jogador (pontos, estrelas e revisão de erros)? Isso não pode ser desfeito.")) return;
    progress = core.novoProgresso();
    saveProgress();
    closeModal();
    renderHome();
  }

  // ------------------------------------------------------------------- rodada
  async function startRound(phase, modo) {
    try {
      let cands, opts = {};
      if (modo === "revisao") cands = core.revisaoCandidatos(data, progress);
      else if (modo === "misto") { cands = core.candidatosMistos(data); opts.balanceKey = (c) => c.e.regiao; }
      else cands = phase.candidatos;
      if (!cands.length) return;
      core.iniciarSessao(progress);
      const seed = (Date.now() ^ (progress.sessao * 2654435761)) >>> 0;
      const rng = core.mulberry32(seed);
      const picked = core.pickRound(cands, progress, core.ROUND_SIZE, rng, opts);
      G.round = { modo, phase, cands: picked, i: 0, acertos: 0, pontos: 0, streak: 0, melhorSeq: 0, rng };
      saveProgress();
      clearHighlights();
      showOnly("round");
      await showQuestion();
    } catch (err) {
      setLoading(null);
      alert(err.message || String(err));
      renderHome();
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
    if (R.modo === "misto" || R.modo === "revisao") prefetchRegionOf(R.i + 1);
  }

  function modeTitle() {
    const R = G.round;
    if (R.modo === "revisao") return "Revisão de erros";
    if (R.modo === "misto") return "Tudo misturado";
    if (R.modo === "livre") return `Treino: ${R.phase.nome}`;
    return R.phase.nome;
  }

  function syncHud() {
    const R = G.round;
    if (!R) return;
    const sk = skullMode();
    const skullLabel = { solido: "Crânio sólido", fantasma: "Crânio transparente", oculto: "Crânio oculto" }[sk];
    ui.hud.replaceChildren(
      h("div", { class: "hud-row" },
        h("button", { class: "game-btn small ghost", onclick: confirmLeaveRound, text: "✕ Sair" }),
        h("div", { class: "hud-title" }, h("strong", { text: modeTitle() }), h("span", { text: ` · pergunta ${Math.min(R.i + 1, R.cands.length)}/${R.cands.length}` })),
        h("div", { class: "hud-score", title: "Pontos e sequência de acertos" }, h("span", { text: `⭐ ${R.pontos}` }), h("span", { text: `🔥 ${R.streak}` }))),
      h("div", { class: "hud-row tools" },
        h("button", { class: "game-btn small ghost", title: "Centraliza a câmera na peça (alvo, depois de responder; ou a peça que você escolheu)", onclick: centerPiece, text: "⌖ Centralizar peça" }),
        h("button", { class: "game-btn small ghost", title: "Alterna entre crânio transparente, sólido e oculto", onclick: cycleSkull, text: `💀 ${skullLabel}` }),
        h("button", { class: "game-btn small ghost" + (G.isolate ? " on" : ""), title: "Mostra só as peças desta região (e o crânio)", onclick: () => { G.isolate = !G.isolate; applyVisibility(); syncHud(); }, text: G.isolate ? "🎯 Região isolada" : "🎯 Mostrar contexto" }),
        h("button", { class: "game-btn small ghost", title: "Reexibe peças que você ocultou", onclick: showAllInRegion, text: "↺ Mostrar tudo" }),
        h("button", { class: "game-btn small ghost", title: "Mostra o crânio inteiro e a região", onclick: () => frameRegion(false), text: "⌖ Crânio inteiro" }),
        h("button", { class: "game-btn small ghost", title: "Aproxima só da região desta pergunta", onclick: () => frameRegion(true), text: "🔍 Só a região" }),
        h("button", { class: "game-btn small ghost", onclick: openCredits, "aria-label": "Créditos e fontes", text: "ℹ" })));
  }

  function cycleSkull() {
    const ordem = ["fantasma", "solido", "oculto"];
    G.skullPref = ordem[(ordem.indexOf(skullMode()) + 1) % ordem.length];
    applySkull();
    syncHud();
  }

  function centerPiece() {
    const R = G.round;
    if (!R || !G.q) return;
    const e = R.cands[R.i].e;
    let meshes = [];
    if (G.answered || G.q.tipo === "identifique") meshes = meshesOf(e).flatMap((m) => ctx.twinsOf(m));
    else if (G.candidate) meshes = ctx.twinsOf(G.candidate);
    if (meshes.length) frameMeshes(meshes);
    else frameRegion();
  }

  function confirmLeaveRound() {
    if (confirm("Sair desta rodada? As respostas já dadas ficam salvas, mas a rodada não conta estrelas.")) {
      clearHighlights();
      saveProgress();
      backFromRound();
    }
  }
  function backFromRound() {
    const m = G.round && G.round.modo;
    if (m === "fases") renderPhases();
    else if (m === "livre") renderPicker();
    else renderHome();
  }

  // ------------------------------------------------------------ painel de pergunta
  function renderPanel() {
    const q = G.q;
    const R = G.round;
    const c = [];
    const regiaoNome = (data.phases.find((p) => p.id === R.cands[R.i].e.regiao) || {}).nome;
    c.push(h("div", { class: "q-type", text: core.TYPES[q.tipo].nome + (R.modo === "misto" && regiaoNome ? ` · ${regiaoNome}` : "") }));
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
    const confirmBtn = document.getElementById("q-confirm");
    const help = document.getElementById("q-help");
    if (mesh) {
      highlight(ctx.twinsOf(mesh), "candidato");
      if (confirmBtn) confirmBtn.disabled = false;
      if (help) help.textContent = `Peça escolhida${stackInfo && stackInfo.total > 1 ? ` (${stackInfo.index + 1} de ${stackInfo.total} neste ponto — toque de novo para alternar)` : ""}. Confirme ou toque em outra peça.`;
    } else if (confirmBtn) {
      confirmBtn.disabled = true;
    }
  }

  function onCanvasClick(event) {
    if (!G.active || !G.q || G.q.tipo !== "encontre" || G.answered || !ui.menu.hidden) return;
    const hits = ctx.raycastAllHits(event.clientX, event.clientY, pickAccept);
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
    const completa = [e.explicacao, e.fono ? `Na fonoaudiologia: ${e.fono}` : null].filter(Boolean);
    // replaceChildren(null) escreveria o texto "null": filtra os blocos ausentes
    fb.replaceChildren(...[
      h("div", { class: "fb-title", text: correct ? `✅ Correto! +${ganho} pontos${G.hint ? " (com dica)" : ""}${R.streak >= 2 ? ` · 🔥 ${R.streak} seguidas` : ""}` : extra && extra.skipped ? "💡 Sem problema — veja a resposta:" : "❌ Não foi dessa vez." }),
      h("div", { class: "fb-text", text: G.q.explicacao }),
      completa.length && !(G.q.tipo === "encontre" || G.q.tipo === "identifique") ? h("details", { class: "fb-more" }, h("summary", { text: "Explicação completa" }), completa.map((t) => h("p", { text: t }))) : null,
      completa.length && (G.q.tipo === "encontre" || G.q.tipo === "identifique") && e.fono ? h("div", { class: "fb-fono", text: `Na fonoaudiologia: ${e.fono}` }) : null,
      meshes.length ? h("div", { class: "fb-3d", text: "A peça correta está destacada em verde no modelo 3D. Use “⌖ Centralizar peça” para aproximá-la." }) : null,
      h("button", { class: "game-btn primary big", onclick: next, text: ultima ? "Ver resultado" : "Próxima ▶" }),
    ].filter(Boolean));
    fb.hidden = false;
    fb.scrollIntoView({ block: "nearest" });
    syncHud();
  }

  async function next() {
    const R = G.round;
    if (!R) return;
    if (R.i >= R.cands.length - 1) { endRound(); return; }
    R.i += 1;
    try { await showQuestion(); } catch (err) { setLoading(null); alert(err.message || String(err)); renderHome(); }
  }

  function endRound() {
    const R = G.round;
    clearHighlights();
    if (G.regionCats.size) frameRegion(); // fundo do resumo: a região inteira, com o crânio de contexto
    const resumo = { acertos: R.acertos, total: R.cands.length, pontos: R.pontos, melhorSequencia: R.melhorSeq };
    const lockAntes = core.fasesDesbloqueadas(data.phases, progress);
    const { recorde } = core.concluirRodada(progress, R.phase ? R.phase.id : null, resumo, R.modo);
    saveProgress();
    const n = core.estrelas(resumo.acertos, resumo.total);
    const lock = core.fasesDesbloqueadas(data.phases, progress);
    const jog = data.phases.filter((p) => p.jogavel);
    const idx = R.modo === "fases" && R.phase ? jog.findIndex((p) => p.id === R.phase.id) : -1;
    const prox = idx >= 0 ? jog[idx + 1] : null;
    const pendentes = core.revisaoCandidatos(data, progress).length;
    const botoes = [];
    if (R.modo === "revisao") {
      if (pendentes) botoes.push(h("button", { class: "game-btn primary big", onclick: () => startRound(null, "revisao"), text: "Revisar mais erros" }));
    } else {
      botoes.push(h("button", { class: "game-btn primary big", onclick: () => startRound(R.phase, R.modo), text: "Jogar de novo" }));
    }
    if (R.modo === "fases" && prox && lock[prox.id]) botoes.push(h("button", { class: "game-btn big", onclick: () => startRound(prox, "fases"), text: "Próxima fase ▶" }));
    if (R.modo === "livre") botoes.push(h("button", { class: "game-btn big", onclick: renderPicker, text: "Escolher outra parte" }));
    botoes.push(h("button", { class: "game-btn ghost big", onclick: renderHome, text: "Menu" }));
    botoes.push(h("button", { class: "game-btn ghost big", onclick: renderRanking, text: "🏆 Ranking" }));
    ui.hud.hidden = true;
    ui.panel.replaceChildren(
      h("div", { class: "summary" },
        h("div", { class: "summary-stars", text: R.modo === "revisao" ? "🔁" : stars(n) }),
        h("h3", { text: R.modo === "revisao" ? "Revisão concluída" : n >= 1 ? "Rodada concluída!" : "Quase lá — tente de novo" }),
        h("div", { class: "summary-line", text: `${resumo.acertos} de ${resumo.total} certas · ${resumo.pontos} pontos · melhor sequência ${resumo.melhorSequencia}` }),
        recorde ? h("div", { class: "summary-record", text: "🏆 Novo recorde!" }) : null,
        R.modo === "fases" && prox && lock[prox.id] && !lockAntes[prox.id] ? h("div", { class: "summary-record", text: `🔓 Liberada: ${prox.nome}` }) : null,
        h("div", { class: "q-actions" }, botoes)));
    ui.panel.hidden = false;
  }

  // ----------------------------------------------- ocultar pecas (botao direito / toque longo)
  function onContextMenuAt(x, y) {
    if (!G.active || !ui.menu.hidden) return;
    const menu = document.getElementById("ctx-menu");
    const hits = ctx.raycastAllHits(x, y, pickAccept);
    menu.replaceChildren();
    const add = (label, fn) => menu.append(h("button", { type: "button", class: "ctx-item", onclick: () => { fn(); menu.hidden = true; }, text: label }));
    if (hits.length) {
      add("🚫 Ocultar a peça da frente", () => {
        for (const t of ctx.twinsOf(hits[0].object)) t.visible = false;
        if (G.candidate && ctx.twinsOf(hits[0].object).includes(G.candidate)) setCandidate(null);
      });
    }
    add("↺ Mostrar todas as peças da região", showAllInRegion);
    add("⌖ Enquadrar o crânio inteiro", () => frameRegion(false));
    add("🔍 Aproximar só da região", () => frameRegion(true));
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
    for (const m of G.skullSet) { m.material = ctx.materialForMesh(m); m.renderOrder = 0; }
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
    renderHome();
    if (!jogador().nome_definido) openNamePrompt();
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
    G.regionId = null; G.regionCats = new Set();
    window.dispatchEvent(new Event("resize"));
  }

  // __estado: so para testes automatizados (le a pergunta atual, inclusive a resposta certa)
  return {
    enter, exit, onCanvasClick, onContextMenuAt, isActive: () => G.active,
    __estado: () => ({ q: G.q, round: G.round, answered: G.answered, candidate: G.candidate, regionId: G.regionId, progress, data, players, skull: { mode: skullMode(), size: G.skullSet.size } }),
  };
}
