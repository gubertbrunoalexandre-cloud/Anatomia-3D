import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { initGame } from "./game.js";

const CATEGORY_LABELS = {
  laringe: "Laringe e pregas vocais",
  cavidade_oral_lingua: "Cavidade oral e língua",
  faringe: "Faringe",
  atm: "ATM (temporomandibular)",
  nervo_I_olfatorio: "N. craniano I — Olfatório",
  nervo_II_optico: "N. craniano II — Óptico",
  nervo_III_oculomotor: "N. craniano III — Oculomotor",
  nervo_IV_troclear: "N. craniano IV — Troclear",
  nervo_V_trigemeo: "N. craniano V — Trigêmeo",
  nervo_VII_facial: "N. craniano VII — Facial",
  nervo_IX_glossofaringeo: "N. craniano IX — Glossofaríngeo",
  nervo_X_vago: "N. craniano X — Vago",
  nervo_XI_acessorio: "N. craniano XI — Acessório",
  nervo_XII_hipoglosso: "N. craniano XII — Hipoglosso",
  cerebro: "Cérebro",
  cranio_ossos: "Ossos do crânio",
  musculos_pescoco: "Músculos do pescoço",
  regioes_superficie: "Regiões de superfície (pele)",
  orelha_nariz_cartilagem: "Cartilagens da orelha e nariz",
  marcos_osseos: "Marcos ósseos (forames, canais, suturas)",
  musculos_suboccipitais: "Músculos suboccipitais",
  musculos_supra_infra_hioideos: "Músculos supra/infra-hióideos",
  musculos_mastigacao: "Músculos da mastigação",
  musculos_faciais: "Músculos faciais (expressão)",
  musculos_extraoculares: "Músculos extraoculares",
  vertebras_cervicais: "Vértebras cervicais",
};

const MARKER_CATEGORY = "marcos_osseos";

const DEFAULT_CHECKED = new Set(["laringe"]);

const state = {
  mode: "estudo", // "estudo" (padrao) ou "jogo" (ver game.js)
  manifest: null,
  db: null, // Map id -> registro de data/estruturas.json (explicacoes, funcao, relacoes)
  categories: {}, // key -> { root, loaded, loading, objects: Map(name->mesh), listEl, checkboxEl, headerLoadingEl }
  selected: null, // mesh
  selectedGroup: [], // a malha selecionada + suas copias gemeas (mesmo nome em outra categoria)
  twins: new Map(), // nome -> [malhas com esse nome, uma por categoria que a contem]
  framedOnce: false,
  photos: null, // config data/photos.json: normalized_key -> nome do arquivo em data/photos/
  pins: [], // alfinetes colocados livremente: { id, group, mesh }
  activePin: null,
};

// 59 objetos do dataset estao exportados em mais de uma categoria (ex.: "Orbital region"
// em "Ossos do cranio" E em "Regioes de superficie") com a MESMA geometria no MESMO lugar.
// Tratamos essas copias como uma peca so: o clique 3D escolhe a copia da categoria mais
// apropriada, o destaque/ocultar vale para todas as copias (senao a gemea normal cobre a
// destacada e o clique parece nao fazer nada).
const CATEGORY_PRIORITY = [
  "nervo_", "musculos_", "orelha_nariz_cartilagem", "regioes_superficie", "vertebras_cervicais",
  "cerebro", "cranio_ossos", "faringe", "cavidade_oral_lingua", "laringe", "atm", "marcos_osseos",
];
function categoryRank(catKey, name) {
  if (catKey === "regioes_superficie" && /\b(region|triangle)\b/i.test(name)) return -1;
  if (catKey === "cavidade_oral_lingua" && /^(mentolabial|nasolabial) sulcus/i.test(name)) return -1;
  if (catKey === "cerebro" && /^olfactory sulcus/i.test(name)) return -1;
  const i = CATEGORY_PRIORITY.findIndex((p) => catKey.startsWith(p));
  return i === -1 ? CATEGORY_PRIORITY.length : i;
}
function preferredTwin(a, b) {
  return categoryRank(b.userData.category, b.name) < categoryRank(a.userData.category, a.name) ? b : a;
}
function twinsOf(mesh) {
  return state.twins.get(mesh.name) || [mesh];
}

const holder = document.getElementById("canvas-holder");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12161c);

const camera = new THREE.PerspectiveCamera(45, holder.clientWidth / holder.clientHeight, 0.01, 100);
camera.position.set(0.3, 0.2, 0.3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(holder.clientWidth, holder.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
holder.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
keyLight.position.set(1, 2, 1.5);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
fillLight.position.set(-1.5, -0.3, -1);
scene.add(fillLight);
const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
rimLight.position.set(0, -1.5, -1.2);
scene.add(rimLight);

// --- coloracao por tipo de tecido (heuristica por nome, ja que os materiais
// originais do Z-Anatomy usam um shader customizado que nao exporta corretamente
// para glTF padrao) ---
const TISSUE_RULES = [
  [/nerve|nervo|nucleus|ganglion/i, 0xf2cf4a],
  [/muscle|musculo/i, 0xa3384a],
  [/cartilage|cartilagem/i, 0xcdd8e6],
  [/ligament|membrane/i, 0xe9e2cf],
  [/joint|capsule|disc/i, 0x8fb3d9],
  [/gland/i, 0xd9a066],
  [/tonsil|lymph/i, 0xd98fae],
  [/bone|canal|fossa|condyle|plate|process|tubercle/i, 0xe8e2d0],
  [/artery/i, 0xc0392b],
  [/vein/i, 0x3a6ea5],
];
const materialCache = new Map();
function materialForName(name) {
  let color = 0xd08c8c; // tecido mole generico (mucosa, orgao)
  for (const [re, c] of TISSUE_RULES) {
    if (re.test(name)) { color = c; break; }
  }
  if (materialCache.has(color)) return materialCache.get(color);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  materialCache.set(color, mat);
  return mat;
}

// marcos osseos (forames/canais/suturas) sao esferas sinteticas - cor de "pino"
// bem distinta pra ficarem faceis de achar sobre o osso
const MARKER_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xff6b3d,
  emissive: 0x7a2c10,
  emissiveIntensity: 0.5,
  roughness: 0.4,
  metalness: 0.1,
});

function materialForMesh(mesh) {
  if (mesh.userData.category === MARKER_CATEGORY) return MARKER_MATERIAL;
  return materialForName(mesh.name);
}

// material unico usado para destacar a peca selecionada (troca o material da
// malha em vez de desenhar uma caixa ao redor dela)
const HIGHLIGHT_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4fb0ff,
  emissive: 0x1c5f9e,
  emissiveIntensity: 0.7,
  roughness: 0.35,
  metalness: 0.1,
  side: THREE.DoubleSide,
});

// --- alfinetes moviveis (posicionados livremente pelo usuario) ---
const PIN_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0xff2d78,
  emissive: 0x7a0030,
  emissiveIntensity: 0.6,
  depthTest: false,
});
const PIN_MATERIAL_ACTIVE = new THREE.MeshStandardMaterial({
  color: 0xffe14d,
  emissive: 0x8a6a00,
  emissiveIntensity: 0.7,
  depthTest: false,
});

function createPinGroup() {
  const group = new THREE.Group();
  const stickH = 0.02;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, stickH, 8), PIN_MATERIAL);
  stick.position.y = stickH / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.006, 14, 14), PIN_MATERIAL);
  head.position.y = stickH + 0.006;
  group.add(stick, head);
  group.renderOrder = 999;
  group.traverse((o) => {
    if (o.isMesh) {
      o.renderOrder = 999;
      o.userData.isPinPart = true;
    }
  });
  return group;
}

function setPinActive(pin, active) {
  const mat = active ? PIN_MATERIAL_ACTIVE : PIN_MATERIAL;
  pin.group.traverse((o) => {
    if (o.isMesh) o.material = mat;
  });
}

function positionPinAtHit(pin, hit) {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const worldNormal = hit.face
    ? hit.face.normal.clone().applyMatrix3(normalMatrix).normalize()
    : new THREE.Vector3(0, 1, 0);
  pin.group.position.copy(hit.point);
  pin.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), worldNormal);
  pin.mesh = hit.object;
}

let pinIdCounter = 0;
function addPin(hit) {
  const group = createPinGroup();
  const pin = { id: ++pinIdCounter, group, mesh: hit.object };
  positionPinAtHit(pin, hit);
  scene.add(group);
  state.pins.push(pin);
  return pin;
}

function removePin(pin) {
  scene.remove(pin.group);
  pin.group.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
  state.pins = state.pins.filter((p) => p !== pin);
  if (state.activePin === pin) {
    state.activePin = null;
    syncPinInfoUI();
  }
}

function removeAllPins() {
  for (const pin of [...state.pins]) removePin(pin);
}

function selectPin(pin) {
  selectMesh(pin.mesh); // chama clearSelection() internamente, que zera activePin - por isso setamos depois
  state.activePin = pin;
  for (const p of state.pins) setPinActive(p, p === pin);
  syncPinInfoUI();
}

function syncPinInfoUI() {
  const badge = document.getElementById("info-pin-badge");
  const removeBtn = document.getElementById("info-remove-pin");
  const show = !!state.activePin;
  badge.hidden = !show;
  removeBtn.hidden = !show;
}

function pinAtEvent(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const p = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  const rc = new THREE.Raycaster();
  rc.setFromCamera(p, camera);
  const pinMeshes = [];
  for (const pin of state.pins) {
    pin.group.traverse((o) => {
      if (o.isMesh) o.userData.pinRef = pin;
      if (o.isMesh) pinMeshes.push(o);
    });
  }
  const hits = rc.intersectObjects(pinMeshes, false);
  return hits.length > 0 ? hits[0].object.userData.pinRef : null;
}

window.addEventListener("resize", () => {
  camera.aspect = holder.clientWidth / holder.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(holder.clientWidth, holder.clientHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

const SUFFIX_RE = /^(.*)\.([a-zA-Z0-9]{1,3})$/;
function baseName(n) {
  const m = SUFFIX_RE.exec(n.trim());
  if (m && m[2].length <= 3) return m[1].trim();
  return n.trim();
}

function normalizeKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function lookupDescription(nodeName) {
  if (!state.manifest) return { text: "", fallback: false };
  const key = normalizeKey(baseName(nodeName));
  const pt = state.manifest.descriptions_pt && state.manifest.descriptions_pt[key];
  if (pt) return { text: pt, fallback: false };
  const fb = state.manifest.descriptions_fallback && state.manifest.descriptions_fallback[key];
  if (fb) return { text: fb, fallback: true };
  const en = state.manifest.descriptions_en && state.manifest.descriptions_en[key];
  if (en) return { text: en, fallback: false };
  return { text: "", fallback: false };
}

function photoForName(nodeName) {
  if (!state.photos) return null;
  const key = normalizeKey(baseName(nodeName));
  return state.photos[key] || null;
}

function displayName(nodeName) {
  if (!state.manifest) return baseName(nodeName);
  const key = normalizeKey(baseName(nodeName));
  return (state.manifest.names_pt && state.manifest.names_pt[key]) || baseName(nodeName);
}

const loader = new GLTFLoader();

function frameObject(object3d) {
  const box = new THREE.Box3().setFromObject(object3d);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  controls.target.copy(center);
  const dir = new THREE.Vector3(0.5, 0.35, 0.8).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(size * 0.9 || 0.3)));
  camera.near = Math.max(size / 1000, 0.001);
  camera.far = size * 50;
  camera.updateProjectionMatrix();
  controls.update();
}

// uma unica promessa por categoria: quem pede enquanto ela carrega espera o mesmo download
// (o jogo pre-carrega a regiao da proxima pergunta em segundo plano). opts.startHidden: nasce oculta.
function loadCategory(catKey, opts = {}) {
  const cat = state.categories[catKey];
  if (cat.loaded) return Promise.resolve();
  if (cat.loadPromise) return cat.loadPromise;
  cat.loadPromise = doLoadCategory(catKey, opts).finally(() => { cat.loadPromise = null; });
  return cat.loadPromise;
}

async function doLoadCategory(catKey, opts) {
  const cat = state.categories[catKey];
  cat.loading = true;
  cat.headerLoadingEl.textContent = "carregando…";
  const meta = state.manifest.categories[catKey];
  try {
    const gltf = await loader.loadAsync(`../data/glb/${meta.file}`);
    const root = gltf.scene;
    root.name = `category:${catKey}`;
    root.traverse((child) => {
      if (child.isMesh) {
        // o exportador glTF do Blender sanitiza nomes de nos (troca espaco por "_",
        // remove "."), entao usamos o nome original preservado via extras/orig_name
        const origName = child.userData && child.userData.orig_name ? child.userData.orig_name : child.name;
        child.name = origName;
        cat.objects.set(child.name, child);
        child.userData.category = catKey;
        if (!state.twins.has(child.name)) state.twins.set(child.name, []);
        state.twins.get(child.name).push(child);
        child.material = materialForMesh(child);
      }
    });
    if (opts.startHidden) root.visible = false;
    scene.add(root);
    cat.root = root;
    cat.loaded = true;
    cat.headerLoadingEl.textContent = "";
    if (!state.framedOnce) {
      frameObject(root);
      state.framedOnce = true;
    }
  } catch (err) {
    console.error(`Falha ao carregar ${catKey}`, err);
    cat.headerLoadingEl.textContent = "erro";
  } finally {
    cat.loading = false;
  }
  maybeHideLoadingOverlay();
}

function setCategoryVisible(catKey, visible) {
  const cat = state.categories[catKey];
  if (cat.root) cat.root.visible = visible;
}

// "Ver atraves": desenha a peca selecionada por cima das outras (util para estruturas profundas)
let xrayOn = false;
function applyXray() {
  HIGHLIGHT_MATERIAL.depthTest = !xrayOn;
  for (const m of state.selectedGroup) m.renderOrder = xrayOn ? 998 : 0;
  document.getElementById("btn-xray").classList.toggle("active", xrayOn);
  document.getElementById("info-xray").classList.toggle("active", xrayOn);
}

function clearSelection() {
  for (const m of state.selectedGroup) {
    m.material = materialForMesh(m);
    m.renderOrder = 0;
  }
  state.selectedGroup = [];
  state.selected = null;
  document.querySelectorAll(".struct-item.active").forEach((el) => el.classList.remove("active"));
  if (state.activePin) {
    setPinActive(state.activePin, false);
    state.activePin = null;
  }
  syncPinInfoUI();
}

function selectMesh(mesh) {
  clearSelection();
  state.selected = mesh;
  state.selectedGroup = twinsOf(mesh).slice();
  for (const m of state.selectedGroup) {
    m.material = HIGHLIGHT_MATERIAL;
    if (xrayOn) m.renderOrder = 998;
  }

  const catKey = mesh.userData.category;
  const listItem = document.querySelector(`.struct-item[data-cat="${catKey}"][data-name="${CSS.escape(mesh.name)}"]`);
  if (listItem) {
    listItem.classList.add("active");
    const list = listItem.closest(".struct-list");
    if (list) list.classList.add("open");
    listItem.scrollIntoView({ block: "center" });
  }
  for (const twin of state.selectedGroup) {
    if (twin === mesh) continue;
    const twinItem = document.querySelector(`.struct-item[data-cat="${twin.userData.category}"][data-name="${CSS.escape(twin.name)}"]`);
    if (twinItem) twinItem.classList.add("active");
  }

  showInfoPanel(mesh.name, catKey);

  // no celular a barra lateral e uma gaveta sobreposta - fecha ela ao
  // selecionar pra revelar o modelo 3D + painel de detalhes
  if (window.matchMedia("(max-width: 768px)").matches) closeSidebar();
}

// registro da estrutura em data/estruturas.json (carregado em segundo plano; pode ainda nao estar pronto)
function recordFor(nodeName) {
  if (!state.db) return null;
  return state.db.get(normalizeKey(baseName(nodeName)).replace(/ /g, "-")) || null;
}

// seccoes extras do painel: explicacao completa, funcao, origem/insercao/inervacao e nota de fono.
// Funcao/relacoes so aparecem quando foram curadas (fontes.escrito_por_ia); as frases extraidas
// automaticamente das descricoes ja aparecem no texto da descricao.
function renderInfoExtra(rec) {
  const box = document.getElementById("info-extra");
  box.replaceChildren();
  if (!rec) return;
  const curated = (c) => !!(rec.fontes && Array.isArray(rec.fontes.escrito_por_ia) && rec.fontes.escrito_por_ia.includes(c));
  const add = (titulo, texto) => {
    if (!texto) return;
    const sec = document.createElement("div");
    sec.className = "info-section";
    const h = document.createElement("h3");
    h.textContent = titulo;
    const p = document.createElement("p");
    p.textContent = texto;
    sec.append(h, p);
    box.appendChild(sec);
  };
  add("Explicação", rec.explicacao);
  if (curated("funcao")) add("Função", rec.funcao);
  if (curated("origem")) add("Origem", rec.relacoes && rec.relacoes.origem);
  if (curated("insercao")) add("Inserção", rec.relacoes && rec.relacoes.insercao);
  if (curated("inervado_por")) add("Inervação", rec.relacoes && rec.relacoes.inervado_por);
  if (curated("inerva")) add("O que inerva / conduz", rec.relacoes && rec.relacoes.inerva);
  add("Na fonoaudiologia", rec.fono);
  const foot = document.createElement("div");
  foot.className = "info-source";
  const partes = [];
  const refs = Array.isArray(rec.referencias) ? rec.referencias : [];
  if (rec.explicacao && rec.explicacao_revisada_por) {
    partes.push(`Explicação revisada por ${rec.explicacao_revisada_por}.`);
  } else if (rec.explicacao || (rec.fontes && rec.fontes.escrito_por_ia)) {
    partes.push(refs.length
      ? "Explicação, função e relações escritas por IA e conferidas com as referências abaixo; ainda sem revisão de um profissional da área."
      : "Explicação, função e relações escritas por IA a partir de conhecimento anatômico padrão; ainda sem revisão profissional.");
  }
  const url = rec.fontes && rec.fontes.descricao_url;
  foot.append(document.createTextNode(partes.join(" ") + (partes.length ? " " : "")));
  if (url) {
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = "Descrição original (Wikipédia, CC BY-SA)";
    foot.append(a);
  }
  if (foot.childNodes.length) box.appendChild(foot);
  if (refs.length) {
    const det = document.createElement("details");
    det.className = "info-refs";
    const sum = document.createElement("summary");
    sum.textContent = `Referências consultadas (${refs.length})`;
    const ul = document.createElement("ul");
    for (const r of refs) {
      if (!/^https:\/\//.test(r.url || "")) continue;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = r.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = r.titulo;
      li.append(a);
      if (r.tipo) li.append(document.createTextNode(` — ${r.tipo}`));
      ul.append(li);
    }
    det.append(sum, ul);
    box.appendChild(det);
  }
}

function showInfoPanel(nodeName, catKey) {
  const panel = document.getElementById("info-panel");
  const title = document.getElementById("info-title");
  const englishName = document.getElementById("info-english");
  const catLabel = document.getElementById("info-cat");
  const desc = document.getElementById("info-desc");
  const photoBox = document.getElementById("info-photo");
  const searchBtn = document.getElementById("info-search-btn");

  const pt = displayName(nodeName);
  const en = baseName(nodeName);
  const rec = recordFor(nodeName);
  title.textContent = pt;
  const nomes = [];
  if (pt.toLowerCase() !== en.toLowerCase()) nomes.push(`en: ${en}`);
  if (rec && rec.nome_latim) nomes.push(`lat.: ${rec.nome_latim}`);
  englishName.textContent = nomes.length ? `(${nomes.join(" · ")})` : "";
  catLabel.textContent = CATEGORY_LABELS[catKey] || catKey;
  renderInfoExtra(rec);

  const { text, fallback } = lookupDescription(nodeName);
  desc.innerHTML = "";
  if (text) {
    desc.classList.remove("empty");
    const main = document.createElement("span");
    main.textContent = text;
    desc.appendChild(main);
    if (fallback) {
      const note = document.createElement("span");
      note.className = "generic-note";
      note.textContent = "Descrição baseada em conhecimento anatômico geral (esta estrutura ainda não tem um artigo de referência específico na base de dados).";
      desc.appendChild(note);
    }
  } else {
    desc.textContent = "Sem descrição disponível para esta estrutura ainda.";
    desc.classList.add("empty");
  }

  photoBox.hidden = false;
  searchBtn.hidden = false;
  const photoFile = photoForName(nodeName);
  photoBox.innerHTML = "";
  if (photoFile) {
    const img = document.createElement("img");
    img.src = `../data/photos/${photoFile}`;
    img.alt = pt;
    img.onerror = () => {
      photoBox.innerHTML = `<div class="photo-placeholder"><div class="icon">📷</div><div>foto em breve</div></div>`;
    };
    photoBox.appendChild(img);
  } else {
    photoBox.innerHTML = `<div class="photo-placeholder"><div class="icon">📷</div><div>foto em breve</div></div>`;
  }

  searchBtn.textContent = `🔎 Pesquisar sobre ${pt}`;
  searchBtn.onclick = () => searchStructure(nodeName);

  panel.classList.add("open");
}

function closeInfoPanel() {
  document.getElementById("info-extra").replaceChildren();
  document.getElementById("info-panel").classList.remove("open");
  document.getElementById("info-photo").hidden = true;
  document.getElementById("info-search-btn").hidden = true;
  clearSelection();
}

document.getElementById("info-close").addEventListener("click", closeInfoPanel);

// --- raycasting / click to select ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// varias pecas do dataset ficam encaixadas umas dentro/atras das outras (ex.: musculos
// da laringe dentro da cartilagem tireoide, musculos extraoculares atras do globo ocular)
// - o raio de clique so acerta a peca mais externa/proxima da camera por padrao. Pra dar
// acesso as pecas encobertas sem precisar ocultar/isolar manualmente, guardamos TODAS as
// intersecoes (nao so a primeira) e permitimos "furar" a pilha por clique repetido ou pelo
// menu de contexto (ver showContextMenu).
function raycastAllHits(clientX, clientY, accept) {
  // accept (opcional): funcao(mesh) -> bool; o jogo usa para tornar o cranio de contexto "transparente" ao clique
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const pickables = [];
  for (const cat of Object.values(state.categories)) {
    if (cat.root && cat.root.visible) {
      cat.root.traverse((child) => {
        if (child.isMesh && child.visible && (!accept || accept(child))) pickables.push(child);
      });
    }
  }
  const rawHits = raycaster.intersectObjects(pickables, false);

  // uma malha curva/aberta pode ser atravessada mais de uma vez pelo mesmo raio (face
  // da frente e face de tras) - mantem so a intersecao mais proxima de cada peca unica,
  // senao ela apareceria duplicada na pilha de "outras pecas neste ponto"
  const seen = new Set();
  const hits = [];
  const indexByName = new Map();
  for (const hit of rawHits) {
    if (seen.has(hit.object)) continue;
    seen.add(hit.object);
    // copia gemea (mesmo nome em outra categoria, mesma geometria): fica so uma entrada,
    // a da categoria mais apropriada
    const prev = indexByName.get(hit.object.name);
    if (prev !== undefined) {
      if (preferredTwin(hits[prev].object, hit.object) === hit.object) hits[prev] = hit;
      continue;
    }
    indexByName.set(hit.object.name, hits.length);
    hits.push(hit);
  }
  return hits;
}

function raycastHit(clientX, clientY) {
  const hits = raycastAllHits(clientX, clientY);
  return hits.length > 0 ? hits[0] : null;
}

function meshAtEvent(event) {
  const hit = raycastHit(event.clientX, event.clientY);
  return hit ? hit.object : null;
}

// clicar repetidas vezes no mesmo ponto da tela avanca pra proxima peca da pilha de
// intersecoes naquele ponto, em vez de sempre reselecionar a mais externa
let clickCycle = { x: null, y: null, hits: null, index: 0 };

renderer.domElement.addEventListener("click", (event) => {
  if (longPressFired) {
    longPressFired = false; // toque longo ja tratou a selecao, ignora o click sintetico que vem junto
    return;
  }
  if (pinInteractionJustHappened) {
    pinInteractionJustHappened = false; // clique/arraste no alfinete ja tratou tudo
    return;
  }
  if (state.mode === "jogo") {
    game.onCanvasClick(event); // no jogo o clique e a resposta, nao abre o painel de informacoes
    return;
  }
  const hits = raycastAllHits(event.clientX, event.clientY);
  if (!hits.length) {
    clickCycle = { x: null, y: null, hits: null, index: 0 };
    return;
  }
  const samePoint =
    clickCycle.hits &&
    Math.hypot(event.clientX - clickCycle.x, event.clientY - clickCycle.y) < 6;
  const index = samePoint ? (clickCycle.index + 1) % hits.length : 0;
  clickCycle = { x: event.clientX, y: event.clientY, hits, index };
  selectMesh(hits[index].object);
});

// --- menu de contexto (botao direito) ---
const ctxMenu = document.getElementById("ctx-menu");

function hideContextMenu() {
  ctxMenu.hidden = true;
}

function showContextMenu(x, y, hits) {
  const hit = hits[0];
  const mesh = hit.object;
  const pt = displayName(mesh.name);
  ctxMenu.innerHTML = "";

  const makeItem = (label, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-item";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      onClick();
      hideContextMenu();
    });
    ctxMenu.appendChild(btn);
  };

  const nameEl = document.createElement("div");
  nameEl.className = "ctx-header";
  nameEl.textContent = pt;
  ctxMenu.appendChild(nameEl);

  makeItem("👁 Selecionar", () => selectMesh(mesh));
  makeItem("📌 Colocar alfinete aqui", () => {
    const pin = addPin(hit);
    selectPin(pin);
  });
  makeItem("🚫 Ocultar", () => hideMesh(mesh));
  makeItem("🎯 Isolar", () => {
    selectMesh(mesh);
    isolateMesh(mesh);
  });
  makeItem("↺ Mostrar tudo", showAllMeshes);
  makeItem("🔎 Pesquisar sobre esta estrutura", () => searchStructure(mesh.name));

  // quando ha mais de uma peca embaixo do cursor (ex.: musculo encaixado atras de
  // cartilagem, ligamento atras de outro musculo), lista as demais pra selecionar ou
  // colocar alfinete direto nelas - sem isso, so dava pra alcancar a mais externa
  if (hits.length > 1) {
    const stackHeader = document.createElement("div");
    stackHeader.className = "ctx-stack-header";
    stackHeader.textContent = "Outras peças neste ponto (atrás)";
    ctxMenu.appendChild(stackHeader);

    for (const otherHit of hits.slice(1, 7)) {
      const otherMesh = otherHit.object;
      const row = document.createElement("div");
      row.className = "ctx-stack-item";

      const nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = "ctx-stack-name";
      nameBtn.textContent = displayName(otherMesh.name);
      nameBtn.title = "Selecionar";
      nameBtn.addEventListener("click", () => {
        selectMesh(otherMesh);
        hideContextMenu();
      });

      const pinBtn = document.createElement("button");
      pinBtn.type = "button";
      pinBtn.className = "ctx-stack-pin";
      pinBtn.textContent = "📌";
      pinBtn.title = "Colocar alfinete aqui";
      pinBtn.addEventListener("click", () => {
        const pin = addPin(otherHit);
        selectPin(pin);
        hideContextMenu();
      });

      row.appendChild(nameBtn);
      row.appendChild(pinBtn);
      ctxMenu.appendChild(row);
    }
  }

  ctxMenu.hidden = false;
  // mantem o menu dentro da janela (mede a altura real, ja que o numero de linhas varia)
  const menuW = 240;
  ctxMenu.style.left = "0px";
  ctxMenu.style.top = "0px";
  const menuH = ctxMenu.offsetHeight;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);
  ctxMenu.style.left = `${left}px`;
  ctxMenu.style.top = `${top}px`;
}

renderer.domElement.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (state.mode === "jogo") {
    game.onContextMenuAt(event.clientX, event.clientY); // menu sem nomes (nao entrega a resposta)
    return;
  }
  const hits = raycastAllHits(event.clientX, event.clientY);
  if (!hits.length) {
    hideContextMenu();
    return;
  }
  selectMesh(hits[0].object);
  showContextMenu(event.clientX, event.clientY, hits);
});

// --- selecionar/arrastar alfinetes com o botao esquerdo do mouse ---
let draggingPin = null;
let pinDownPos = null;
let pinMoved = false;
let pinInteractionJustHappened = false;

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return; // so botao esquerdo
  const pin = pinAtEvent(event.clientX, event.clientY);
  if (!pin) return;
  draggingPin = pin;
  pinDownPos = { x: event.clientX, y: event.clientY };
  pinMoved = false;
  controls.enabled = false; // impede a orbita da camera enquanto mexe no alfinete
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!draggingPin) return;
  const dx = event.clientX - pinDownPos.x;
  const dy = event.clientY - pinDownPos.y;
  if (Math.hypot(dx, dy) > 3) pinMoved = true;
  if (!pinMoved) return;
  const hit = raycastHit(event.clientX, event.clientY);
  if (hit) positionPinAtHit(draggingPin, hit);
});

window.addEventListener("pointerup", () => {
  if (!draggingPin) return;
  const pin = draggingPin;
  draggingPin = null;
  controls.enabled = true;
  pinInteractionJustHappened = true;
  selectPin(pin); // seleciona (clique simples) ou atualiza a info pra nova posicao (apos arrastar)
});

// --- toque longo (celular) equivale ao botao direito ---
let touchTimer = null;
let touchStartPos = null;
let longPressFired = false;

renderer.domElement.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 1) {
    clearTimeout(touchTimer);
    return;
  }
  const touch = event.touches[0];
  touchStartPos = { x: touch.clientX, y: touch.clientY };
  clearTimeout(touchTimer);
  touchTimer = setTimeout(() => {
    if (state.mode === "jogo") {
      longPressFired = true;
      game.onContextMenuAt(touch.clientX, touch.clientY);
      if (navigator.vibrate) navigator.vibrate(15);
      return;
    }
    const hits = raycastAllHits(touch.clientX, touch.clientY);
    if (hits.length) {
      longPressFired = true;
      selectMesh(hits[0].object);
      showContextMenu(touch.clientX, touch.clientY, hits);
      if (navigator.vibrate) navigator.vibrate(15);
    }
  }, 550);
}, { passive: true });

renderer.domElement.addEventListener("touchmove", (event) => {
  if (!touchStartPos || event.touches.length !== 1) return;
  const touch = event.touches[0];
  const dx = touch.clientX - touchStartPos.x;
  const dy = touch.clientY - touchStartPos.y;
  if (Math.hypot(dx, dy) > 10) clearTimeout(touchTimer); // arrastando (orbit) cancela o toque longo
}, { passive: true });

renderer.domElement.addEventListener("touchend", () => {
  clearTimeout(touchTimer);
  touchStartPos = null;
}, { passive: true });

// --- gaveta da lista lateral (celular) ---
const sidebarEl = document.getElementById("sidebar");
const sidebarToggleBtn = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");

function openSidebar() {
  sidebarEl.classList.add("open");
  sidebarBackdrop.classList.add("open");
}
function closeSidebar() {
  sidebarEl.classList.remove("open");
  sidebarBackdrop.classList.remove("open");
}
sidebarToggleBtn.addEventListener("click", () => {
  sidebarEl.classList.contains("open") ? closeSidebar() : openSidebar();
});
sidebarBackdrop.addEventListener("click", closeSidebar);

window.addEventListener("click", (event) => {
  if (!ctxMenu.hidden && !ctxMenu.contains(event.target)) hideContextMenu();
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
});
window.addEventListener("blur", hideContextMenu);

// --- toolbar ---
function syncEyeIcons() {
  document.querySelectorAll(".struct-item").forEach((item) => {
    const catKey = item.dataset.cat;
    const objName = item.dataset.name;
    const cat = state.categories[catKey];
    const mesh = cat && cat.objects.get(objName);
    const eyeBtn = item.querySelector(".struct-eye");
    if (!mesh || !eyeBtn) return;
    eyeBtn.classList.toggle("hidden-eye", !mesh.visible);
    eyeBtn.textContent = mesh.visible ? "👁" : "🚫";
  });
}

function isolateMesh(mesh) {
  const keepBase = baseName(mesh.name).toLowerCase();
  for (const cat of Object.values(state.categories)) {
    if (!cat.root) continue;
    cat.root.traverse((child) => {
      if (child.isMesh) {
        child.visible = baseName(child.name).toLowerCase() === keepBase;
      }
    });
  }
  syncEyeIcons();
}

async function showAllMeshes() {
  // "Mostrar tudo" precisa realmente mostrar tudo: carrega qualquer categoria
  // que ainda nao tinha sido aberta, marca a caixinha dela e reexibe cada
  // malha individual (que pode ter sido escondida pelo icone de olho ou por
  // "Isolar"). Antes so agia em categorias ja carregadas e nao remarcava a
  // caixinha, entao uma categoria desmarcada continuava sumida.
  const resetBtn = document.getElementById("btn-reset");
  const originalLabel = resetBtn.textContent;
  resetBtn.textContent = "Carregando…";
  resetBtn.disabled = true;
  try {
    for (const [catKey, cat] of Object.entries(state.categories)) {
      if (!cat.loaded) await loadCategory(catKey);
      if (cat.checkboxEl) cat.checkboxEl.checked = true;
      setCategoryVisible(catKey, true);
      if (cat.root) {
        cat.root.traverse((child) => {
          if (child.isMesh) child.visible = true;
        });
      }
    }
    syncEyeIcons();
  } finally {
    resetBtn.textContent = originalLabel;
    resetBtn.disabled = false;
  }
}

function hideMesh(mesh) {
  for (const m of twinsOf(mesh)) m.visible = false;
  syncEyeIcons();
  if (state.selectedGroup.includes(mesh)) closeInfoPanel();
}

function searchStructure(nodeName) {
  const pt = displayName(nodeName);
  const query = `${pt} anatomia função`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener");
}

document.getElementById("btn-isolate").addEventListener("click", () => {
  if (!state.selected) return;
  isolateMesh(state.selected);
});

document.getElementById("btn-reset").addEventListener("click", showAllMeshes);

document.getElementById("btn-remove-all-pins").addEventListener("click", removeAllPins);

document.getElementById("info-remove-pin").addEventListener("click", () => {
  if (state.activePin) {
    removePin(state.activePin);
    closeInfoPanel();
  }
});

// --- sidebar build ---
function buildSidebar(manifest) {
  const container = document.getElementById("categories");
  for (const [catKey, meta] of Object.entries(manifest.categories)) {
    state.categories[catKey] = {
      root: null,
      loaded: false,
      loading: false,
      objects: new Map(),
    };

    const catDiv = document.createElement("div");
    catDiv.className = "category";

    const header = document.createElement("div");
    header.className = "category-header";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = DEFAULT_CHECKED.has(catKey);
    state.categories[catKey].checkboxEl = checkbox;

    const title = document.createElement("div");
    title.className = "category-title";
    title.textContent = CATEGORY_LABELS[catKey] || catKey;

    const count = document.createElement("div");
    count.className = "category-count";
    count.textContent = meta.objects.length;

    const loadingEl = document.createElement("div");
    loadingEl.className = "category-loading";
    state.categories[catKey].headerLoadingEl = loadingEl;

    header.appendChild(checkbox);
    header.appendChild(title);
    header.appendChild(count);
    header.appendChild(loadingEl);

    const structList = document.createElement("div");
    structList.className = "struct-list";
    for (const objName of meta.objects) {
      const item = document.createElement("div");
      item.className = "struct-item";
      item.dataset.cat = catKey;
      item.dataset.name = objName;
      item.dataset.en = baseName(objName).toLowerCase();

      const label = document.createElement("span");
      label.className = "struct-label";
      label.textContent = displayName(objName);
      label.title = baseName(objName); // nome em ingles no tooltip, util p/ cruzar com literatura

      const eyeBtn = document.createElement("button");
      eyeBtn.className = "struct-eye";
      eyeBtn.type = "button";
      eyeBtn.title = "Mostrar/ocultar";
      eyeBtn.textContent = "👁";

      label.addEventListener("click", async (e) => {
        e.stopPropagation();
        checkbox.checked = true;
        await loadCategory(catKey);
        setCategoryVisible(catKey, true);
        const mesh = state.categories[catKey].objects.get(objName);
        if (mesh) {
          for (const m of twinsOf(mesh)) m.visible = true;
          syncEyeIcons();
          selectMesh(mesh);
          frameSelected(mesh);
        }
      });

      eyeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        checkbox.checked = true;
        await loadCategory(catKey);
        setCategoryVisible(catKey, true);
        const mesh = state.categories[catKey].objects.get(objName);
        if (!mesh) return;
        const nowVisible = !mesh.visible;
        for (const m of twinsOf(mesh)) m.visible = nowVisible;
        syncEyeIcons();
        if (!nowVisible && state.selectedGroup.includes(mesh)) {
          closeInfoPanel();
        }
      });

      item.appendChild(label);
      item.appendChild(eyeBtn);
      structList.appendChild(item);
    }
    state.categories[catKey].listEl = structList;

    header.addEventListener("click", () => {
      structList.classList.toggle("open");
    });

    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", async () => {
      if (checkbox.checked) {
        await loadCategory(catKey);
        setCategoryVisible(catKey, true);
      } else {
        setCategoryVisible(catKey, false);
      }
    });

    catDiv.appendChild(header);
    catDiv.appendChild(structList);
    container.appendChild(catDiv);
  }
}

function frameSelected(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = Math.max(box.getSize(new THREE.Vector3()).length(), 0.02);
  controls.target.copy(center);
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(size * 2.2)));
  camera.near = size / 200;
  camera.far = size * 200;
  camera.updateProjectionMatrix();
  controls.update();
}

// centraliza a camera na peca selecionada; sem selecao, enquadra tudo o que esta visivel
function frameVisible() {
  const box = new THREE.Box3();
  for (const cat of Object.values(state.categories)) {
    if (!cat.root || !cat.root.visible) continue;
    cat.root.traverse((m) => {
      if (m.isMesh && m.visible) box.union(new THREE.Box3().setFromObject(m));
    });
  }
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = Math.max(box.getSize(new THREE.Vector3()).length(), 0.02);
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() === 0) dir.set(0.5, 0.35, 0.8);
  controls.target.copy(center);
  // em tela vertical (celular) a largura visivel e menor: afasta a camera para nao cortar as laterais
  const retrato = Math.max(1, 1 / Math.max(camera.aspect, 0.3));
  camera.position.copy(center.clone().add(dir.normalize().multiplyScalar(size * 0.9 * retrato)));
  camera.near = Math.max(size / 1000, 0.001);
  camera.far = size * 50;
  camera.updateProjectionMatrix();
  controls.update();
}

function centerOnPiece() {
  if (state.selected) frameSelected(state.selected);
  else frameVisible();
}

document.getElementById("btn-center").addEventListener("click", centerOnPiece);
for (const id of ["btn-xray", "info-xray"]) {
  document.getElementById(id).addEventListener("click", () => {
    xrayOn = !xrayOn;
    applyXray();
  });
}
document.getElementById("info-center").addEventListener("click", () => {
  centerOnPiece();
  // no celular o painel ocupa a tela toda: fecha so a janela (mantem a peca destacada) para mostrar o resultado
  if (window.matchMedia("(max-width: 768px)").matches) {
    document.getElementById("info-panel").classList.remove("open");
  }
});

// --- search ---
document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll(".struct-item").forEach((item) => {
    const match =
      q.length === 0 ||
      item.textContent.toLowerCase().includes(q) ||
      (item.dataset.en && item.dataset.en.includes(q));
    item.style.display = match ? "" : "none";
  });
  if (q.length > 0) {
    document.querySelectorAll(".struct-list").forEach((list) => {
      const anyVisible = Array.from(list.children).some((c) => c.style.display !== "none");
      list.classList.toggle("open", anyVisible);
    });
  }
});

function maybeHideLoadingOverlay() {
  document.getElementById("loading-overlay").style.display = "none";
}

// modo jogo: recebe do visualizador apenas o que precisa (ver game.js)
const game = initGame({
  THREE, state, camera, controls,
  loadCategory, materialForMesh, normalizeKey, baseName, twinsOf, raycastAllHits, syncEyeIcons,
  prepareForGame() {
    closeInfoPanel();
    clearSelection();
    removeAllPins();
    hideContextMenu();
  },
});
document.getElementById("btn-game").addEventListener("click", () => game.enter());

window.__debug = { state, scene, camera, renderer, THREE, controls, game };

async function loadPhotosConfig() {
  try {
    const res = await fetch("../data/photos.json", { cache: "no-store" });
    const raw = await res.json();
    const normalized = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_")) continue; // chaves de documentacao (_readme, _exemplo)
      normalized[normalizeKey(k)] = v;
    }
    state.photos = normalized;
  } catch (err) {
    console.warn("Nao foi possivel carregar data/photos.json", err);
    state.photos = {};
  }
}

async function loadDatabase() {
  try {
    const res = await fetch("../data/estruturas.json", { cache: "no-store" });
    const db = await res.json();
    state.db = new Map(db.estruturas.map((e) => [e.id, e]));
    // se uma peca ja estava selecionada quando a base chegou, completa o painel
    if (state.selected && document.getElementById("info-panel").classList.contains("open")) {
      renderInfoExtra(recordFor(state.selected.name));
    }
  } catch (err) {
    console.warn("Nao foi possivel carregar data/estruturas.json (explicacoes completas ficam indisponiveis)", err);
  }
}

async function init() {
  const res = await fetch("../data/glb/manifest.json", { cache: "no-store" });
  state.manifest = await res.json();
  loadDatabase(); // em segundo plano: o painel funciona sem ela
  await loadPhotosConfig();
  buildSidebar(state.manifest);

  const defaultLoads = Object.keys(state.categories).filter((k) => DEFAULT_CHECKED.has(k));
  if (defaultLoads.length === 0) {
    maybeHideLoadingOverlay();
  } else {
    for (const catKey of defaultLoads) {
      await loadCategory(catKey);
      setCategoryVisible(catKey, true);
    }
    maybeHideLoadingOverlay();
  }
}

init().catch((err) => {
  console.error(err);
  document.getElementById("loading-text").textContent = "Erro ao carregar. Veja o console.";
});
