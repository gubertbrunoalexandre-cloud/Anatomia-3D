// Motor do modo jogo: logica pura (sem DOM e sem three.js), para poder ser testada
// isoladamente (web/tests/game-core.test.html). Tudo que vira pergunta sai de
// data/estruturas.json - nao existe lista de perguntas fixa no codigo.

export const ROUND_SIZE = 10;
export const BOX_INTERVALS = [0, 1, 2, 4, 8, 16]; // por caixa de Leitner (1..5): rodadas ate voltar
export const STORAGE_VERSION = 1;

export const TYPES = {
  encontre: { nome: "Encontre a estrutura", grupo: "3d" },
  identifique: { nome: "Que estrutura é esta?", grupo: "3d" },
  funcao: { nome: "Função", grupo: "relacoes" },
  inervacao: { nome: "Inervação", grupo: "relacoes" },
  origem: { nome: "Origem", grupo: "relacoes" },
  insercao: { nome: "Inserção", grupo: "relacoes" },
};

// ---------------------------------------------------------------- utilitarios
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stripAccents(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normText(s) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick(list, rng, weightFn) {
  let total = 0;
  const ws = list.map((x) => {
    const w = Math.max(0.0001, weightFn(x));
    total += w;
    return w;
  });
  let r = rng() * total;
  for (let i = 0; i < list.length; i++) {
    r -= ws[i];
    if (r <= 0) return i;
  }
  return list.length - 1;
}

// palavras genericas que nao identificam uma estrutura (nao contam como "vazamento" do nome)
const GENERIC = new Set([
  "musculo", "musculos", "nervo", "nervos", "parte", "partes", "osso", "ossos", "cartilagem", "ligamento",
  "glandula", "arteria", "veia", "regiao", "superior", "inferior", "anterior", "posterior", "lateral", "medial",
  "interna", "interno", "externa", "externo", "maior", "menor", "profunda", "profundo", "superficial", "direito",
  "esquerdo", "ramo", "ramos", "divisao", "tronco", "corpo", "ventre", "cabeca", "pescoco", "orelha", "mucosa",
  "orgao", "canal", "sulco", "giro", "forame", "membrana", "disco", "nucleo", "raiz",
]);

export function nameTokens(nomePt) {
  return normText(nomePt)
    .split(" ")
    .filter((w) => w.length >= 5 && !GENERIC.has(w));
}

// o texto cita o nome da propria estrutura? (entao a pergunta entregaria a resposta)
export function leaks(text, tokens) {
  if (!text || !tokens.length) return false;
  const words = normText(text).split(" ");
  return tokens.some((t) => {
    const stem = t.slice(0, Math.max(5, t.length - 2));
    return words.some((w) => w.startsWith(stem));
  });
}

export function firstSentences(text, maxChars = 230) {
  if (!text) return "";
  const parts = String(text).replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
  let out = "";
  for (const p of parts) {
    if (out && (out + " " + p).length > maxChars) break;
    out = out ? out + " " + p : p;
    if (out.length >= maxChars * 0.6) break;
  }
  return out;
}

// ------------------------------------------------------------------ os dados
// quem entra no jogo e decidido na base (campo "jogo", calculado por regras em
// data/regras_base_dados.json e ajustavel por estrutura); aqui so ha travas de seguranca
function isGameStructure(e) {
  if (e.jogo !== true) return false;
  if (e.regiao === "sem_regiao") return false;
  if (e.fontes && e.fontes.nome_pt === "ingles") return false; // nunca mostrar nome em ingles num jogo em portugues
  if (e.aviso_licenca && /ouvido interno/i.test(e.aviso_licenca)) return false; // possivel conjunto NC
  return true;
}

function curated(e, campo) {
  return !!(e.fontes && Array.isArray(e.fontes.escrito_por_ia) && e.fontes.escrito_por_ia.includes(campo));
}

export function prepareData(db) {
  const byId = new Map(db.estruturas.map((e) => [e.id, e]));
  const jogaveis = db.estruturas.filter(isGameStructure);
  const tokens = new Map(jogaveis.map((e) => [e.id, nameTokens(e.nome_pt)]));

  // textos usados nas perguntas de funcao/origem/insercao: so os CURADOS (escritos por IA
  // e listados em estruturas_ajustes.json) e que nao citem o nome da propria estrutura
  function textFor(e, tipo) {
    let t = null;
    if (tipo === "funcao" && curated(e, "funcao")) t = e.funcao;
    if (tipo === "origem" && curated(e, "origem")) t = e.relacoes && e.relacoes.origem;
    if (tipo === "insercao" && curated(e, "insercao")) t = e.relacoes && e.relacoes.insercao;
    if (!t || leaks(t, tokens.get(e.id) || [])) return null;
    return t;
  }

  const pools = { funcao: [], origem: [], insercao: [] };
  for (const e of jogaveis) {
    for (const tipo of Object.keys(pools)) {
      const t = textFor(e, tipo);
      if (t) pools[tipo].push({ e, text: t });
    }
  }

  // nervos cranianos numerados, ex. "Nervo facial (VII)" (nao os ramos como oftalmico/maxilar, que
  // pertencem ao trigemeo e tornariam a pergunta ambigua), servem de alternativas na inervacao
  const nervos = jogaveis.filter((e) => e.tipo === "nervo" && e.par_craniano && /^Nervo .*\([IVX]+\)$/.test(e.nome_pt));
  const nervoIds = new Set(nervos.map((n) => n.id));

  function availableTypes(e) {
    const out = [];
    if (e.tem_geometria_propria) out.push("encontre", "identifique");
    for (const tipo of Object.keys(pools)) {
      if (textFor(e, tipo) && pools[tipo].length >= 4) out.push(tipo);
    }
    const ids = (e.relacoes && e.relacoes.inervado_por_ids) || [];
    if (curated(e, "inervado_por") && ids.some((i) => nervoIds.has(i)) && nervos.length >= 4) out.push("inervacao");
    return out;
  }

  const tiposDisp = new Map(jogaveis.map((e) => [e.id, availableTypes(e)]));

  const phases = db.regioes
    .filter((r) => r.id !== "sem_regiao")
    .map((r) => {
      const estruturas = jogaveis.filter((e) => e.regiao === r.id);
      const cands = [];
      for (const e of estruturas) for (const tipo of tiposDisp.get(e.id)) cands.push(makeCand(e, tipo));
      return {
        id: r.id, nome: r.nome, ordem: r.ordem, categorias_app: r.categorias_app, contexto_app: r.contexto_app || [],
        estruturas, candidatos: cands,
        n_estruturas: estruturas.length,
        n_relevantes: estruturas.filter((e) => e.relevancia_fono).length,
        jogavel: new Set(cands.map((c) => c.id)).size >= 3 && cands.length >= 6,
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  return { db, byId, jogaveis, tokens, pools, nervos, nervoIds, tiposDisp, phases, textFor };
}

export function makeCand(e, tipo) {
  return { id: e.id, tipo, key: `${e.id}|${tipo}`, grupo: TYPES[tipo].grupo, e };
}

// ----------------------------------------------------------------- perguntas
function related(a, b) {
  const x = normText(a.nome_en), y = normText(b.nome_en);
  return a.nome_pt === b.nome_pt || x.includes(y) || y.includes(x);
}

function pickDistractors(list, e, rng, n, sameKey, opts = {}) {
  // list: itens {e,...}; escolhe n com preferencia: mesmo tipo+regiao > mesmo tipo > mesma regiao > qualquer
  // opts.excludeKey: chave ja usada pela resposta certa; opts.accept: filtro extra por item
  const tiers = [
    (o) => o.tipo === e.tipo && o.regiao === e.regiao,
    (o) => o.tipo === e.tipo,
    (o) => o.regiao === e.regiao,
    () => true,
  ];
  const chosen = [];
  const seen = new Set(opts.excludeKey ? [opts.excludeKey] : []);
  for (const tier of tiers) {
    for (const item of shuffle(list.filter((it) => tier(it.e)), rng)) {
      const k = sameKey(item);
      if (item.e.id === e.id || related(e, item.e) || seen.has(k)) continue;
      if (opts.accept && !opts.accept(item)) continue;
      seen.add(k);
      chosen.push(item);
      if (chosen.length === n) return chosen;
    }
  }
  return chosen;
}

export function buildQuestion(data, id, tipo, rng) {
  const e = data.byId.get(id);
  const base = { id: `${id}|${tipo}`, tipo, estruturaId: id, dificuldade: e.dificuldade, opcoes: null, correta: null };
  const latim = e.nome_latim ? ` (${e.nome_latim})` : "";
  if (tipo === "encontre") {
    return { ...base, prompt: "Encontre no modelo 3D:", alvo: e.nome_pt, alvoLatim: e.nome_latim || null, explicacao: explain(e, tipo) };
  }
  if (tipo === "identifique") {
    const alt = pickDistractors(data.jogaveis.map((x) => ({ e: x })), e, rng, 3, (it) => normText(it.e.nome_pt));
    return finishOptions({ ...base, prompt: "Que estrutura é esta?", explicacao: explain(e, tipo) },
      [{ texto: e.nome_pt, ok: true }, ...alt.map((a) => ({ texto: a.e.nome_pt, ok: false, estruturaId: a.e.id }))], rng);
  }
  if (tipo === "funcao" || tipo === "origem" || tipo === "insercao") {
    const correct = data.textFor(e, tipo);
    const pool = data.pools[tipo];
    const meusTokens = data.tokens.get(e.id) || [];
    const alt = pickDistractors(pool, e, rng, 3, (it) => normText(it.text), {
      excludeKey: normText(correct),
      accept: (it) => !leaks(it.text, meusTokens), // alternativa errada nao pode citar a estrutura perguntada
    });
    const prompts = {
      funcao: `Qual é a função de “${e.nome_pt}”?`,
      origem: `Qual é a origem de “${e.nome_pt}”?`,
      insercao: `Qual é a inserção de “${e.nome_pt}”?`,
    };
    return finishOptions({ ...base, prompt: prompts[tipo], explicacao: explain(e, tipo) },
      [{ texto: correct, ok: true }, ...alt.map((a) => ({ texto: a.text, ok: false, estruturaId: a.e.id }))], rng);
  }
  if (tipo === "inervacao") {
    const ids = (e.relacoes.inervado_por_ids || []).filter((i) => data.nervoIds.has(i));
    const certoId = ids[Math.floor(rng() * ids.length)];
    const certo = data.byId.get(certoId);
    const outros = data.nervos.filter((n) => !ids.includes(n.id));
    // prefere nervos de interesse para fono como alternativas plausiveis
    const pref = shuffle(outros.filter((n) => n.relevancia_fono), rng).concat(shuffle(outros.filter((n) => !n.relevancia_fono), rng));
    const alt = pref.slice(0, 3);
    return finishOptions({ ...base, prompt: `Qual nervo inerva “${e.nome_pt}”?`, explicacao: explain(e, tipo) },
      [{ texto: certo.nome_pt, ok: true }, ...alt.map((a) => ({ texto: a.nome_pt, ok: false, estruturaId: a.id }))], rng);
  }
  throw new Error("tipo de pergunta desconhecido: " + tipo + latim);
}

function finishOptions(q, opcoes, rng) {
  const opts = shuffle(opcoes, rng);
  return { ...q, opcoes: opts.map((o) => ({ texto: o.texto, estruturaId: o.estruturaId || null })), correta: opts.findIndex((o) => o.ok) };
}

export function explain(e, tipo) {
  const latim = e.nome_latim ? ` (${e.nome_latim})` : "";
  if (tipo === "encontre" || tipo === "identifique") {
    // prefere a explicacao completa (escrita por IA) a primeira frase da descricao da Wikipedia
    const corpo = e.explicacao ? firstSentences(e.explicacao, 280) : firstSentences(e.descricao, 230);
    return `${e.nome_pt}${latim}. ${corpo}`.trim();
  }
  if (tipo === "funcao") return `${e.nome_pt}: ${e.funcao}`;
  if (tipo === "inervacao") return `${e.nome_pt}: ${e.relacoes.inervado_por}`;
  if (tipo === "origem") return `${e.nome_pt} — origem: ${e.relacoes.origem}`;
  if (tipo === "insercao") return `${e.nome_pt} — inserção: ${e.relacoes.insercao}`;
  return "";
}

// ------------------------------------------------------------------ progresso
export function novoProgresso() {
  return {
    versao: STORAGE_VERSION,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    sessao: 0,
    itens: {}, // "id|tipo" -> { caixa, due, vistas, acertos }
    fases: {}, // modo "Fases": regiaoId -> { jogadas, melhor: {acertos,total,estrelas,pontos}, ultima }
    modos: { livre: {}, misto: { jogadas: 0, melhor: null, ultima: null } }, // "Treino por parte" e "Tudo misturado"
    totais: { pontos: 0, rodadas: 0, respostas: 0, acertos: 0, melhor_sequencia: 0, melhor_rodada: 0 },
    config: { liberar_tudo: false },
  };
}

export const MODOS = {
  fases: { nome: "Fases", icone: "🪜" },
  livre: { nome: "Treino por parte", icone: "🎯" },
  misto: { nome: "Tudo misturado", icone: "🎲" },
  revisao: { nome: "Revisão de erros", icone: "🔁" },
};

export function iniciarSessao(progress) {
  progress.sessao += 1;
  return progress.sessao;
}

export function registrarResposta(progress, cand, correto) {
  const it = progress.itens[cand.key] || { caixa: 1, due: 0, vistas: 0, acertos: 0 };
  it.vistas += 1;
  if (correto) {
    it.acertos += 1;
    it.caixa = Math.min(5, it.caixa + 1);
  } else {
    it.caixa = 1;
  }
  it.due = progress.sessao + BOX_INTERVALS[it.caixa];
  progress.itens[cand.key] = it;
  progress.totais.respostas += 1;
  if (correto) progress.totais.acertos += 1;
  progress.atualizado_em = new Date().toISOString();
  return it;
}

export function pontosDaResposta(dificuldade, sequenciaAposAcerto) {
  const base = Math.round(100 * [1, 1.25, 1.5][Math.max(1, Math.min(3, dificuldade)) - 1]);
  const bonus = sequenciaAposAcerto >= 2 ? Math.min(sequenciaAposAcerto - 1, 5) * 10 : 0;
  return base + bonus;
}

export function estrelas(acertos, total) {
  if (!total) return 0;
  const p = acertos / total;
  return p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.5 ? 1 : 0;
}

function registrarMelhor(container, resumo) {
  const r = { acertos: resumo.acertos, total: resumo.total, estrelas: estrelas(resumo.acertos, resumo.total), pontos: resumo.pontos };
  container.jogadas += 1;
  container.ultima = r;
  let recorde = false;
  const m = container.melhor;
  if (!m || r.estrelas > m.estrelas || (r.estrelas === m.estrelas && r.pontos > m.pontos)) {
    recorde = !!m;
    container.melhor = r;
  }
  return recorde;
}

// modo: "fases" (sobe de nivel), "livre" (treino por parte), "misto" (tudo misturado) ou "revisao"
export function concluirRodada(progress, regiaoId, resumo, modo = "fases") {
  if (modo === true) modo = "revisao"; // compatibilidade com a assinatura antiga (ehRevisao)
  if (modo === false) modo = "fases";
  progress.totais.rodadas += 1;
  progress.totais.pontos += resumo.pontos;
  progress.totais.melhor_sequencia = Math.max(progress.totais.melhor_sequencia, resumo.melhorSequencia);
  progress.totais.melhor_rodada = Math.max(progress.totais.melhor_rodada || 0, resumo.pontos);
  let recorde = false;
  if (modo === "fases" && regiaoId) {
    const f = progress.fases[regiaoId] || { jogadas: 0, melhor: null, ultima: null };
    recorde = registrarMelhor(f, resumo);
    progress.fases[regiaoId] = f;
  } else if (modo === "livre" && regiaoId) {
    const f = progress.modos.livre[regiaoId] || { jogadas: 0, melhor: null, ultima: null };
    recorde = registrarMelhor(f, resumo);
    progress.modos.livre[regiaoId] = f;
  } else if (modo === "misto") {
    recorde = registrarMelhor(progress.modos.misto, resumo);
  }
  progress.atualizado_em = new Date().toISOString();
  return { recorde };
}

export function estrelasTotais(progress) {
  let n = 0;
  for (const f of Object.values(progress.fases)) if (f.melhor) n += f.melhor.estrelas;
  for (const f of Object.values(progress.modos.livre)) if (f.melhor) n += f.melhor.estrelas;
  if (progress.modos.misto.melhor) n += progress.modos.misto.melhor.estrelas;
  return n;
}

export function fasesDesbloqueadas(phases, progress) {
  const jogaveis = phases.filter((p) => p.jogavel);
  const out = {};
  jogaveis.forEach((p, i) => {
    const anterior = i > 0 ? progress.fases[jogaveis[i - 1].id] : null;
    out[p.id] = i === 0 || progress.config.liberar_tudo || !!(anterior && anterior.melhor && anterior.melhor.estrelas >= 1);
  });
  return out;
}

export function errosPendentes(progress) {
  return Object.entries(progress.itens).filter(([, it]) => it.caixa === 1 && it.vistas > 0).map(([k]) => k);
}

export function validarProgresso(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, erro: "Arquivo vazio ou inválido." };
  if (obj.versao !== STORAGE_VERSION) return { ok: false, erro: `Versão do progresso não reconhecida (${obj.versao}).` };
  const p = novoProgresso();
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  p.criado_em = typeof obj.criado_em === "string" ? obj.criado_em : p.criado_em;
  p.sessao = Math.max(0, Math.floor(num(obj.sessao)));
  for (const [k, it] of Object.entries(obj.itens || {})) {
    if (!/^[a-z0-9-]+\|(encontre|identifique|funcao|inervacao|origem|insercao)$/.test(k) || !it) continue;
    p.itens[k] = { caixa: Math.max(1, Math.min(5, Math.floor(num(it.caixa, 1)))), due: num(it.due), vistas: Math.max(0, num(it.vistas)), acertos: Math.max(0, num(it.acertos)) };
  }
  const pick = (r) => (r && typeof r === "object" ? { acertos: num(r.acertos), total: num(r.total), estrelas: Math.max(0, Math.min(3, num(r.estrelas))), pontos: num(r.pontos) } : null);
  const rec = (f) => ({ jogadas: Math.max(0, num(f.jogadas)), melhor: pick(f.melhor), ultima: pick(f.ultima) });
  for (const [k, f] of Object.entries(obj.fases || {})) {
    if (!/^[a-z_]+$/.test(k) || !f) continue;
    p.fases[k] = rec(f);
  }
  const modos = obj.modos || {};
  for (const [k, f] of Object.entries(modos.livre || {})) {
    if (!/^[a-z_]+$/.test(k) || !f) continue;
    p.modos.livre[k] = rec(f);
  }
  if (modos.misto && typeof modos.misto === "object") p.modos.misto = rec(modos.misto);
  const t = obj.totais || {};
  p.totais = { pontos: num(t.pontos), rodadas: num(t.rodadas), respostas: num(t.respostas), acertos: num(t.acertos), melhor_sequencia: num(t.melhor_sequencia), melhor_rodada: num(t.melhor_rodada) };
  p.config = { liberar_tudo: !!(obj.config && obj.config.liberar_tudo) };
  return { ok: true, progresso: p };
}

// -------------------------------------------------------------- sorteio da rodada
export function revisaoCandidatos(data, progress) {
  const keys = new Set(errosPendentes(progress));
  const out = [];
  for (const e of data.jogaveis) {
    for (const tipo of data.tiposDisp.get(e.id)) {
      const c = makeCand(e, tipo);
      if (keys.has(c.key)) out.push(c);
    }
  }
  return out;
}

// opts.balanceKey: funcao(cand) -> chave (ex.: regiao). Usada no modo "tudo misturado" para nao deixar
// as regioes grandes (cerebro, marcos) dominarem a rodada: cada escolha reduz o peso da mesma chave.
export function pickRound(cands, progress, n, rng, opts = {}) {
  n = Math.min(n, cands.length);
  const sessao = progress.sessao;
  const item = (c) => progress.itens[c.key];
  const due = cands.filter((c) => item(c) && item(c).due <= sessao);
  const novos = cands.filter((c) => !item(c));
  const resto = cands.filter((c) => item(c) && item(c).due > sessao);
  const porChave = new Map();
  const balance = (c) => (opts.balanceKey ? 1 / (1 + 2 * (porChave.get(opts.balanceKey(c)) || 0)) : 1);
  const weight = (c) => (c.e.relevancia_fono ? 3 : 1) * (item(c) ? 6 - item(c).caixa : 2) * balance(c);

  const chosen = [];
  const usedIds = new Set();
  const usedKeys = new Set();
  function take(lists, count, allowSameId) {
    let taken = 0;
    for (const list of lists) {
      let avail = list.filter((c) => !usedKeys.has(c.key) && (allowSameId || !usedIds.has(c.id)));
      while (taken < count && avail.length) {
        const c = avail[weightedPick(avail, rng, weight)];
        chosen.push(c);
        if (opts.balanceKey) porChave.set(opts.balanceKey(c), (porChave.get(opts.balanceKey(c)) || 0) + 1);
        usedIds.add(c.id);
        usedKeys.add(c.key);
        taken += 1;
        avail = avail.filter((x) => !usedKeys.has(x.key) && (allowSameId || !usedIds.has(x.id)));
      }
      if (taken >= count) break;
    }
    return taken;
  }

  // 1) revisao espacada: itens vencidos (os erros voltam primeiro) ocupam ate metade da rodada
  // (pode repetir a estrutura, ex.: errou "encontre" e "identifique" da mesma peca; a ordem evita juntas)
  take([due], Math.ceil(n * 0.5), true);
  // 2) garante algumas perguntas de funcao/relacoes quando a fase tem (contando as ja sorteadas)
  const rel = (list) => list.filter((c) => c.grupo === "relacoes");
  const relIds = new Set(cands.filter((c) => c.grupo === "relacoes").map((c) => c.id));
  const relJa = chosen.filter((c) => c.grupo === "relacoes").length;
  take([rel(novos), rel(resto), rel(due)], Math.max(0, Math.min(Math.floor(n * 0.3), relIds.size) - relJa), false);
  // 3) completa com itens novos, depois com os demais
  take([novos, resto, due], n - chosen.length, false);
  // 4) fase pequena: aceita a mesma estrutura de novo (com outro tipo de pergunta)
  if (chosen.length < n) take([novos, resto, due], n - chosen.length, true);

  return orderRound(chosen, rng);
}

function orderRound(list, rng) {
  let best = shuffle(list, rng);
  const bad = (arr) => {
    let c = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].id === arr[i - 1].id) c += 10;
      if (arr[i].tipo === arr[i - 1].tipo) c += 1;
      if (i > 1 && arr[i].tipo === arr[i - 1].tipo && arr[i].tipo === arr[i - 2].tipo) c += 3;
    }
    return c;
  };
  let bestScore = bad(best);
  for (let t = 0; t < 40 && bestScore > 0; t++) {
    const cand = shuffle(list, rng);
    const s = bad(cand);
    if (s < bestScore) { best = cand; bestScore = s; }
  }
  return best;
}

// ------------------------------------------------------------ modo "tudo misturado"
export function candidatosMistos(data) {
  const out = [];
  for (const p of data.phases) out.push(...p.candidatos);
  return out;
}

// --------------------------------------------------- ranking e cartao de pontuacao
// Ranking SEM servidor: soma os jogadores deste aparelho + "cartoes de pontuacao" importados de
// colegas (arquivo JSON). Nao e verificado: depende da honestidade de quem gera o cartao.
export function cartaoPontuacao(nome, progress) {
  const t = progress.totais;
  return {
    tipo: "cartao-pontuacao",
    versao: 1,
    nome: String(nome || "Jogador").slice(0, 24),
    gerado_em: new Date().toISOString(),
    pontos: t.pontos,
    rodadas: t.rodadas,
    respostas: t.respostas,
    acertos: t.acertos,
    melhor_sequencia: t.melhor_sequencia,
    melhor_rodada: t.melhor_rodada || 0,
    estrelas: estrelasTotais(progress),
  };
}

export function validarCartao(obj) {
  if (!obj || typeof obj !== "object" || obj.tipo !== "cartao-pontuacao" || obj.versao !== 1) {
    return { ok: false, erro: "Não é um cartão de pontuação válido." };
  }
  const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 100000000) : 0);
  const nome = String(obj.nome || "").replace(/[<>]/g, "").trim().slice(0, 24);
  if (!nome) return { ok: false, erro: "O cartão não tem nome." };
  const gerado = typeof obj.gerado_em === "string" && !Number.isNaN(Date.parse(obj.gerado_em)) ? obj.gerado_em : new Date().toISOString();
  const cartao = {
    tipo: "cartao-pontuacao", versao: 1, nome, gerado_em: gerado,
    pontos: num(obj.pontos), rodadas: num(obj.rodadas), respostas: num(obj.respostas), acertos: Math.min(num(obj.acertos), num(obj.respostas)),
    melhor_sequencia: num(obj.melhor_sequencia), melhor_rodada: num(obj.melhor_rodada), estrelas: Math.min(num(obj.estrelas), 1000),
  };
  return { ok: true, cartao };
}

export function montarRanking(entradas) {
  const lista = entradas.map((e) => ({
    ...e,
    pct: e.respostas ? Math.round((100 * e.acertos) / e.respostas) : 0,
  }));
  lista.sort((a, b) => b.pontos - a.pontos || b.estrelas - a.estrelas || b.pct - a.pct || a.nome.localeCompare(b.nome, "pt-BR"));
  return lista.map((e, i) => ({ ...e, posicao: i + 1 }));
}
