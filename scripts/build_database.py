#!/usr/bin/env python3
"""
Gera a base de dados unica de estruturas (data/estruturas.json) a partir do que o
projeto ja tem. O jogo (e, aos poucos, o modo de estudo) le SO desta base.

Entradas (todas ja existentes no projeto):
  data/glb/manifest.json            categorias/objetos exportados, nomes PT, descricoes
  data/TA2.csv                      Terminologia Anatomica (ingles, latim, portugues)
  data/source_meta.json             sistema/colecoes do .blend e link da Wikipedia
                                    (gerado por scripts/extract_source_meta.py, com Blender)
  data/photos.json                  fotos explicativas
  data/regras_base_dados.json       regioes, tipos e regras de relevancia/dificuldade (editavel)
  data/estruturas_ajustes.json      correcoes manuais por estrutura (sobrevivem a regeneracao)

Saidas:
  data/estruturas.json                       a base
  docs/fase-1/relatorio-base-dados.md        contagens e campos vazios
  docs/fase-1/campos-vazios.csv              uma linha por estrutura com o que falta

Estruturas novas que entrarem no manifest aparecem sozinhas na proxima execucao.
Uso:  python scripts/build_database.py
"""
import csv
import datetime
import json
import os
import re
import sys
import unicodedata
from collections import Counter, OrderedDict, defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
P = lambda *a: os.path.join(ROOT, *a)

SUFFIX_RE = re.compile(r"^(.*)\.([a-zA-Z0-9]{1,3})$")


def base_name(n):
    n = n.strip()
    m = SUFFIX_RE.match(n)
    return m.group(1).strip() if m and len(m.group(2)) <= 3 else n


def suffix_of(n):
    m = SUFFIX_RE.match(n.strip())
    return m.group(2) if m and len(m.group(2)) <= 3 else ""


def norm_key(s):
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_ta2():
    rows = {}
    with open(P("data", "TA2.csv"), encoding="utf-8") as f:
        for i, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            if line.startswith('"') and line.endswith('"'):
                line = line[1:-1]
            cols = line.split(";")
            if i == 0 or len(cols) < 6:
                continue
            k = norm_key(cols[1])
            if k and k not in rows:
                rows[k] = {"id": cols[0].strip(), "latim": cols[2].strip(), "pt": cols[5].strip()}
    return rows


def load_explicacoes():
    """Explicacoes completas (escritas por IA, nao revisadas) em data/explicacoes/*.json:
    {"explicacoes": {"<id>": {"explicacao": "...", "fono": "..."}}}"""
    out = {}
    d = P("data", "explicacoes")
    if os.path.isdir(d):
        for nome in sorted(os.listdir(d)):
            if nome.endswith(".json"):
                out.update(load_json(os.path.join(d, nome)).get("explicacoes", {}))
    return out


def glb_mesh_names(manifest):
    """Nomes originais dos objetos que realmente tem malha em cada .glb (le o JSON do arquivo).
    O manifest as vezes lista objetos que o exportador glTF descartou (ex.: ancora de rotulo sem faces)."""
    import struct
    out = {}
    for cat, v in manifest["categories"].items():
        names = set()
        path = P("data", "glb", v["file"])
        if os.path.exists(path):
            with open(path, "rb") as f:
                head = f.read(20)  # cabecalho GLB (12) + cabecalho do chunk JSON (8)
                jl = struct.unpack("<I", head[12:16])[0]
                j = json.loads(f.read(jl).decode("utf-8"))
            for n in j.get("nodes", []):
                if "mesh" in n:
                    names.add((n.get("extras") or {}).get("orig_name") or n.get("name"))
        out[cat] = names
    return out


def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if p and p.strip()]


def main():
    manifest = load_json(P("data", "glb", "manifest.json"))
    meta = load_json(P("data", "source_meta.json"))
    rules = load_json(P("data", "regras_base_dados.json"))
    ajustes = load_json(P("data", "estruturas_ajustes.json")).get("ajustes", {})
    explicacoes = load_explicacoes()
    photos = load_json(P("data", "photos.json")) if os.path.exists(P("data", "photos.json")) else {}
    photos = {norm_key(k): v for k, v in photos.items() if not k.startswith("_")}
    ta2 = load_ta2()
    malhas = glb_mesh_names(manifest)

    meta_obj = meta["objects"]
    wiki_url = meta.get("wiki_url", {})
    names_pt = manifest["names_pt"]
    desc_pt = manifest.get("descriptions_pt", {})
    desc_fb = manifest.get("descriptions_fallback", {})
    desc_en = manifest.get("descriptions_en", {})

    # ---- regioes -------------------------------------------------------
    cat_to_region = {}
    for r in rules["regioes"]:
        for c in r["categorias_app"]:
            cat_to_region[c] = r["id"]
    prio = rules["prioridade_categoria_app"]

    def category_rank(cat, name):
        # mesma regra de web/js/main.js (categoryRank) para escolher a categoria "principal"
        if cat == "regioes_superficie" and re.search(r"\b(region|triangle)\b", name, re.I):
            return -1
        if cat == "cavidade_oral_lingua" and re.search(r"^(mentolabial|nasolabial) sulcus", name, re.I):
            return -1
        if cat == "cerebro" and re.search(r"^olfactory sulcus", name, re.I):
            return -1
        for i, p in enumerate(prio):
            if cat.startswith(p):
                return i
        return len(prio)

    # ---- objetos do manifest agrupados por estrutura --------------------
    by_key = OrderedDict()
    for cat, v in manifest["categories"].items():
        for nome in v["objects"]:
            k = norm_key(base_name(nome))
            by_key.setdefault(k, []).append({"nome": nome, "categoria_app": cat})

    rx_true = [re.compile(p, re.I) for p in rules["relevancia_fono"]["nomes_true"]]
    cats_true = set(rules["relevancia_fono"]["categorias_true"])
    rx_main = [re.compile(p, re.I) for p in rules["dificuldade"]["principais"]]
    rx_detail = re.compile(rules["dificuldade"]["detalhe"], re.I)
    ext = {k: re.compile(v, re.I) for k, v in rules["extracao_texto"].items() if not k.startswith("_")}
    rx_inner_ear = re.compile(r"cochlea|vestibul|labyrinth|semicircular|inner ear", re.I)

    def classify_tipo(nome_en, objs, primary_cat, systems, colls):
        n = nome_en.lower()
        if any(o["papel"] == "marcador" for o in objs):
            return "marco_osseo"
        for rule in rules.get("tipo_por_nome", []):
            if re.search(rule["regex"], n):
                return rule["tipo"]
        has = lambda s: any(x.startswith(s) for x in systems)
        if has("4") or (has("2") and not has("1")):
            if re.search(r"fascia|aponeuros|bursa|sheath", n):
                return "fascia"
            return "musculo"
        if has("1"):
            if any("cartilage" in c.lower() for c in colls) or "cartilage" in n:
                return "cartilagem"
            return "osso"
        if has("3"):
            if re.search(r"ligament|membrane", n):
                return "ligamento"
            return "articulacao"
        if has("5"):
            if re.search(r"artery|arteries|arterial|trunk", n):
                return "arteria"
            if re.search(r"vein|sinus|venous", n):
                return "veia"
            return "vaso"
        if has("6"):
            return "linfoide"
        if has("7"):
            if "nucleus" in n:
                return "encefalo"
            if primary_cat.startswith("nervo_") or re.search(r"nerve|ganglion|ramus|rami|root of|plexus|chorda|ansa", n):
                return "nervo"
            if re.search(r"eye|lens|cornea|retina|iris|sclera|lacrimal|ear\b|tympan|cochlea|ossicle", n):
                return "orgao_sentido"
            return "encefalo"
        if has("8"):
            return "glandula" if re.search(r"gland", n) else "orgao"
        if has("9"):
            return "regiao_superficie"
        return "orgao"

    estruturas = []
    for k, objs in by_key.items():
        nome_en_base = base_name(objs[0]["nome"])
        # papel de cada objeto
        for o in objs:
            mo = meta_obj.get(o["nome"], {})
            systems = mo.get("systems", [])
            if mo.get("marker"):
                o["papel"] = "marcador"
            elif systems == ["2: Muscular insertions"]:
                o["papel"] = "fixacao"
            else:
                o["papel"] = "corpo"
            suf = suffix_of(o["nome"])
            o["lado"] = "l" if suf.endswith("l") else "r" if suf.endswith("r") else "unico"
            o["malha"] = o["nome"] in malhas.get(o["categoria_app"], set())
        body = [o for o in objs if o["papel"] != "fixacao"] or objs
        systems = sorted({s for o in body for s in meta_obj.get(o["nome"], {}).get("systems", [])})
        colls = sorted({c for o in body for c in meta_obj.get(o["nome"], {}).get("colls", [])})

        primary = min(objs, key=lambda o: category_rank(o["categoria_app"], nome_en_base))["categoria_app"]
        tipo = classify_tipo(nome_en_base, objs, primary, systems, colls)
        sistema_id = next((s for s in rules["sistema_prioridade"] if s in systems), None)
        if tipo == "musculo":
            sistema_id = "4: Muscular system"  # musculos so com areas de fixacao no .blend continuam sendo musculos
        regiao = cat_to_region.get(primary, "sem_regiao")
        par = None
        m = re.match(r"nervo_([IVX]+)_", primary)
        if m:
            par = m.group(1)

        ta = ta2.get(k)
        nome_pt = names_pt.get(k) or nome_en_base
        pt_from_ta2 = bool(ta and ta["pt"])

        # descricao
        d_pt, d_fb = desc_pt.get(k), desc_fb.get(k)
        if d_pt:
            texto, dfonte = d_pt, ("wikipedia_traduzida_ia" if (k in desc_en or k in wiki_url) else "escrita_para_o_projeto_ia")
        elif d_fb:
            texto, dfonte = d_fb, "conhecimento_geral_ia"
        else:
            texto, dfonte = None, None
        url = wiki_url.get(k) if dfonte == "wikipedia_traduzida_ia" else None
        aviso_texto = None
        if url and "wikipedia.org" not in url:
            # o Z-Anatomy as vezes cita outra fonte no fim do texto (ex.: dicionario da Academie de medecine)
            dfonte = "outra_fonte_traduzida_ia"
            aviso_texto = f"Descricao traduzida de {url} (nao e Wikipedia); licenca dessa fonte nao verificada."

        # funcao / relacoes: frases literais da descricao
        frases = split_sentences(texto) if texto else []
        got = defaultdict(list)
        for s in frases:
            f_ori, f_ins = bool(ext["origem"].search(s)), bool(ext["insercao"].search(s))
            if bool(ext["inervacao"].search(s)):
                got["inerva" if tipo == "nervo" else "inervado_por"].append(s)
            if f_ori and f_ins:
                got["origem_insercao"].append(s)
            elif f_ori:
                got["origem"].append(s)
            elif f_ins:
                got["insercao"].append(s)
            if ext["funcao"].search(s):
                got["funcao"].append(s)
        funcao = " ".join(got.pop("funcao", [])) or None
        relacoes = {key: " ".join(vals) for key, vals in got.items()}

        # relevancia / dificuldade
        relev = primary in cats_true or any(rx.search(nome_en_base) for rx in rx_true)
        if tipo == "marco_osseo":
            d = 3
        else:
            d = 2
            if tipo == "encefalo":
                d += 1
            if rx_detail.search(nome_en_base):
                d += 1
            if any(rx.search(nome_en_base) for rx in rx_main):
                d -= 1
        d = max(1, min(3, d))

        lados = sorted({o["lado"] for o in body if o["lado"] != "unico"}) or ["unico"]
        avisos = []
        ouvido_interno = any(rx_inner_ear.search(c) for c in colls) or (tipo == "marco_osseo" and rx_inner_ear.search(nome_en_base))
        if ouvido_interno:
            avisos.append("Ancora/posicao em colecao de ouvido interno do Z-Anatomy (conjunto 'Anatomy of the Inner Ear' e CC-BY-NC-SA); conferir licenca antes de uso comercial.")
        if aviso_texto:
            avisos.append(aviso_texto)
        aviso = " ".join(avisos) or None

        # entra no modo jogo? (regras em data/regras_base_dados.json > jogo; pode ser ajustado por estrutura)
        jr = rules.get("jogo", {})
        jogo_motivo = None
        if not pt_from_ta2:
            jogo_motivo = "sem nome em português (a TA2 não traz tradução)"
        elif ouvido_interno:
            jogo_motivo = "aviso de licença (âncora no ouvido interno)"
        elif tipo in jr.get("excluir_tipos", []):
            jogo_motivo = "vasos ficam fora do jogo"
        elif jr.get("excluir_nome_regex") and re.search(jr["excluir_nome_regex"], nome_en_base, re.I):
            jogo_motivo = "linfonodos ficam fora do jogo"
        elif regiao in jr.get("tipos_por_regiao", {}) and tipo not in jr["tipos_por_regiao"][regiao]:
            jogo_motivo = "tipo não combina com a fase"

        estruturas.append(OrderedDict([
            ("id", k.replace(" ", "-")),
            ("nome_pt", nome_pt),
            ("nome_en", nome_en_base),
            ("nome_latim", (ta["latim"] if ta and ta["latim"] else None)),
            ("tipo", tipo),
            ("sistema", rules["sistemas"].get(sistema_id) if sistema_id else None),
            ("regiao", regiao),
            ("categoria_app_principal", primary),
            ("categorias_app", sorted({o["categoria_app"] for o in objs})),
            ("par_craniano", par),
            ("descricao", texto),
            ("explicacao", (explicacoes.get(k.replace(" ", "-")) or {}).get("explicacao")),
            ("fono", (explicacoes.get(k.replace(" ", "-")) or {}).get("fono")),
            ("funcao", funcao),
            ("relacoes", relacoes),
            ("relevancia_fono", bool(relev)),
            ("dificuldade", d),
            ("jogo", jogo_motivo is None),
            ("jogo_excluido_por", jogo_motivo),
            ("revisado", False),
            ("lados", lados),
            ("tem_geometria_propria", any(o["papel"] in ("corpo", "marcador") and o["malha"] for o in objs)),
            ("objetos", [OrderedDict([("nome", o["nome"]), ("categoria_app", o["categoria_app"]), ("papel", o["papel"]), ("lado", o["lado"]), ("malha", o["malha"])]) for o in objs]),
            ("fontes", OrderedDict([
                ("nome_pt", "ta2" if pt_from_ta2 else "ingles"),
                ("nome_latim", "ta2" if (ta and ta["latim"]) else None),
                ("descricao", dfonte),
                ("descricao_url", url),
                ("explicacao", "escrita_por_ia_nao_revisada" if k.replace(" ", "-") in explicacoes else None),
                ("funcao_relacoes", "trecho_da_descricao" if (funcao or relacoes) else None),
                ("tipo_regiao_relevancia_dificuldade", "regra_automatica"),
            ])),
            ("foto", photos.get(k)),
            ("aviso_licenca", aviso),
            ("ajustado", False),
        ]))

    # ---- vinculo estrutural: nervo que inerva (so quando a frase cita um nervo da base) ----
    nervos = []
    for e in estruturas:
        if e["tipo"] == "nervo" and e["nome_pt"].lower().startswith("nervo "):
            core = re.sub(r"\(.*?\)", "", e["nome_pt"][6:]).strip()
            if core:
                nervos.append((e["id"], strip_accents(core).lower()))
    for e in estruturas:
        txt = e["relacoes"].get("inervado_por")
        if not txt:
            continue
        t = strip_accents(txt).lower()
        ids = sorted({nid for nid, core in nervos if re.search(r"\bnervos?\s+(?:craniano\s+)?" + re.escape(core) + r"\b", t)})
        if ids:
            e["relacoes"]["inervado_por_ids"] = ids

    # ---- ajustes manuais -------------------------------------------------
    ids = {e["id"] for e in estruturas}
    desconhecidos = [a for a in ajustes if a not in ids] + [f"explicacoes:{a}" for a in explicacoes if a not in ids]
    for e in estruturas:
        a = ajustes.get(e["id"])
        if not a:
            continue
        escritos = []
        for key, val in a.items():
            if key == "_fonte":
                continue
            if key == "relacoes" and isinstance(val, dict):
                for rk, rv in val.items():
                    if rv is None:
                        e["relacoes"].pop(rk, None)
                    else:
                        e["relacoes"][rk] = rv
                        if rk in ("origem", "insercao", "inervado_por", "inerva"):
                            escritos.append(rk)
            else:
                e[key] = val
                if key in ("funcao", "descricao"):
                    escritos.append(key)
        e["ajustado"] = True
        if a.get("_fonte") and escritos:
            e["fontes"]["escrito_por_ia"] = sorted(set(escritos))
            e["fontes"]["escrito_por_ia_fonte"] = a["_fonte"]
            e["fontes"]["funcao_relacoes"] = a["_fonte"]

    # ---- contagem por regiao + gravacao -----------------------------------
    cont_regiao = Counter(e["regiao"] for e in estruturas)
    regioes_out = []
    for r in rules["regioes"]:
        regioes_out.append(OrderedDict([("id", r["id"]), ("nome", r["nome"]), ("ordem", r["ordem"]), ("categorias_app", r["categorias_app"]), ("contexto_app", r.get("contexto_app", [])), ("n_estruturas", cont_regiao.get(r["id"], 0))]))
    if cont_regiao.get("sem_regiao"):
        regioes_out.append(OrderedDict([("id", "sem_regiao"), ("nome", "Sem região definida"), ("ordem", 99), ("categorias_app", []), ("n_estruturas", cont_regiao["sem_regiao"])]))

    out = OrderedDict([
        ("versao", 1),
        ("gerado_em", datetime.date.today().isoformat()),
        ("aviso", "Gerado por scripts/build_database.py. NAO edite a mao: use data/estruturas_ajustes.json (por estrutura) ou data/regras_base_dados.json (regras)."),
        ("tipos", rules["tipos"]),
        ("regioes", regioes_out),
        ("estruturas", estruturas),
    ])
    with open(P("data", "estruturas.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")

    erros = validar(estruturas, manifest, rules)
    write_report(estruturas, out, rules, desconhecidos)
    print(f"OK: {len(estruturas)} estruturas -> data/estruturas.json")
    if erros:
        print("ERROS DE INTEGRIDADE:")
        for e in erros:
            print("  -", e)
        return 1
    if desconhecidos:
        print("AVISO: ajustes com id inexistente:", desconhecidos)


# ---------------------------------------------------------------------------
def validar(estruturas, manifest, rules):
    erros = []
    ids = [e["id"] for e in estruturas]
    if len(ids) != len(set(ids)):
        erros.append("ids repetidos: " + ", ".join(i for i, c in Counter(ids).items() if c > 1))
    conhecidos = set(ids)
    cobertos = Counter((o["nome"], o["categoria_app"]) for e in estruturas for o in e["objetos"])
    for cat, v in manifest["categories"].items():
        for nome in v["objects"]:
            if cobertos[(nome, cat)] != 1:
                erros.append(f"objeto {nome!r} da categoria {cat} aparece {cobertos[(nome, cat)]}x na base (esperado 1)")
    regioes_ok = {r["id"] for r in rules["regioes"]}
    tipos_ok = set(rules["tipos"])
    for e in estruturas:
        if e["regiao"] not in regioes_ok:
            erros.append(f"{e['id']}: regiao sem definicao em regras ({e['regiao']}) - categoria nova do app?")
        if e["tipo"] not in tipos_ok:
            erros.append(f"{e['id']}: tipo invalido {e['tipo']}")
        if e["dificuldade"] not in (1, 2, 3):
            erros.append(f"{e['id']}: dificuldade fora de 1..3")
        if not isinstance(e["revisado"], bool) or not isinstance(e["relevancia_fono"], bool):
            erros.append(f"{e['id']}: revisado/relevancia_fono nao booleano")
        for ref in e["relacoes"].get("inervado_por_ids", []):
            if ref not in conhecidos:
                erros.append(f"{e['id']}: inervado_por_ids aponta para id inexistente {ref}")
    return erros


def expected_fields(e):
    """Campos que, para este tipo de estrutura, fazem sentido existir."""
    exp = ["nome_latim", "funcao"]
    if e["tipo"] == "musculo":
        exp += ["origem", "insercao", "inervado_por"]
    elif e["tipo"] == "nervo":
        exp += ["inerva"]
    return exp


def has_field(e, f):
    if f in ("nome_latim", "funcao"):
        return bool(e[f])
    r = e["relacoes"]
    if f == "origem":
        return bool(r.get("origem") or r.get("origem_insercao"))
    if f == "insercao":
        return bool(r.get("insercao") or r.get("origem_insercao"))
    return bool(r.get(f))


def write_report(estruturas, out, rules, desconhecidos):
    os.makedirs(P("docs", "fase-1"), exist_ok=True)
    N = len(estruturas)
    pct = lambda x: f"{x} ({round(100 * x / N)}%)" if N else "0"
    tipos = rules["tipos"]
    regioes = {r["id"]: r["nome"] for r in out["regioes"]}

    n_desc = sum(1 for e in estruturas if e["descricao"])
    n_lat = sum(1 for e in estruturas if e["nome_latim"])
    n_fun = sum(1 for e in estruturas if e["funcao"])
    n_ori = sum(1 for e in estruturas if has_field(e, "origem"))
    n_ins = sum(1 for e in estruturas if has_field(e, "insercao"))
    n_inn_m = sum(1 for e in estruturas if e["relacoes"].get("inervado_por"))
    n_inn_ids = sum(1 for e in estruturas if e["relacoes"].get("inervado_por_ids"))
    n_inerva = sum(1 for e in estruturas if e["relacoes"].get("inerva"))
    n_rev_false = sum(1 for e in estruturas if not e["revisado"])
    fonte_desc = Counter(e["fontes"]["descricao"] for e in estruturas)
    n_geo = sum(1 for e in estruturas if e["tem_geometria_propria"])
    n_url = sum(1 for e in estruturas if e["fontes"]["descricao_url"])
    n_rel = sum(1 for e in estruturas if e["relevancia_fono"])
    pt_ingles = [e for e in estruturas if e["fontes"]["nome_pt"] == "ingles"]
    avisos = [e for e in estruturas if e["aviso_licenca"]]
    sem_geo = [e for e in estruturas if not e["tem_geometria_propria"]]

    L = []
    L.append("# Fase 1 — Relatório da base de dados (`data/estruturas.json`)\n")
    L.append("Gerado automaticamente por `scripts/build_database.py`. Fonte de tudo: manifest, descrições, TA2 e metadados do `.blend` que já existiam; **nenhuma estrutura nova foi adicionada**.\n")
    L.append("## 1. Números pedidos\n")
    cur = [e for e in estruturas if e["fontes"].get("escrito_por_ia")]
    n_jogo = sum(1 for e in estruturas if e["jogo"])
    n_expl = sum(1 for e in estruturas if e.get("explicacao"))
    n_fonotxt = sum(1 for e in estruturas if e.get("fono"))
    tabela = [
        "| Item | Estruturas |",
        "|---|---:|",
        f"| **Total de estruturas** (esquerdo/direito juntos) | **{N}** |",
        f"| Com descrição | {pct(n_desc)} |",
        f"| Com nome em latim | {pct(n_lat)} |",
        f"| Com função (qualquer origem) | {pct(n_fun)} |",
        f"| Com função/relações **escritas por IA** (Fase 2, opção B) | {len(cur)} |",
        f"| Com **explicação completa** escrita por IA | {pct(n_expl)} |",
        f"| Com nota de relevância para fonoaudiologia | {n_fonotxt} |",
        f"| Entram no modo jogo (`jogo: true`) | {pct(n_jogo)} |",
        f"| `revisado: false` | **{pct(n_rev_false)}** |",
        "",
    ]
    L.extend(tabela)
    L.append("`revisado` é `false` em todas porque nenhum texto foi conferido por uma pessoa especialista: as descrições são da Wikipédia traduzidas por IA (ou texto geral escrito por IA), e os textos de função/origem/inserção/inervação das estruturas curadas foram escritos por IA a partir de conhecimento padrão de livros-texto (campo `fontes.escrito_por_ia`).\n")
    L.append("### Origem das descrições\n")
    nomes_fonte = {"wikipedia_traduzida_ia": "Wikipédia traduzida por IA", "outra_fonte_traduzida_ia": "Outra fonte (não Wikipédia) traduzida por IA", "escrita_para_o_projeto_ia": "Escrita para o projeto (IA)", "conhecimento_geral_ia": "Conhecimento geral (IA), sem artigo-fonte", None: "Sem descrição"}
    for k, v in fonte_desc.most_common():
        L.append(f"- {nomes_fonte.get(k, k)}: {v}")
    L.append(f"\nLink da Wikipédia por estrutura (para a atribuição CC BY-SA): **{n_url}** estruturas têm `fontes.descricao_url`.\n")
    L.append("## 2. Função e relações (curadas por IA + frases copiadas das descrições)\n")
    L.append("| Campo | Estruturas |\n|---|---:|")
    L.append(f"| função | {n_fun} |\n| origem | {n_ori} |\n| inserção | {n_ins} |\n| inervado por (texto) — músculos etc. | {n_inn_m} |\n| inervado por, ligado a um nervo da base (`inervado_por_ids`) | {n_inn_ids} |\n| inerva (texto) — nervos | {n_inerva} |\n")
    L.append("As estruturas listadas em `data/estruturas_ajustes.json` têm texto curado (escrito por IA, não revisado). Nas demais, o campo só existe quando a própria descrição traz a frase, copiada literalmente. **As perguntas de função, origem, inserção e inervação do jogo usam apenas os textos curados** (as frases extraídas citam o nome da estrutura ou nem sempre descrevem função).\n")
    L.append("## 3. Por tipo de estrutura\n")
    L.append("| Tipo | Total | Latim | Função | Relevante p/ fono | Fácil (1) | Médio (2) | Difícil (3) |\n|---|---:|---:|---:|---:|---:|---:|---:|")
    por_tipo = defaultdict(list)
    for e in estruturas:
        por_tipo[e["tipo"]].append(e)
    for t, es in sorted(por_tipo.items(), key=lambda x: -len(x[1])):
        dif = Counter(e["dificuldade"] for e in es)
        L.append(f"| {tipos.get(t, t)} | {len(es)} | {sum(1 for e in es if e['nome_latim'])} | {sum(1 for e in es if e['funcao'])} | {sum(1 for e in es if e['relevancia_fono'])} | {dif[1]} | {dif[2]} | {dif[3]} |")
    L.append("\n## 4. Quantas estruturas servem a cada tipo de pergunta\n")
    L.append("O jogo só usa uma estrutura numa pergunta se o campo necessário existir.\n")
    L.append("| Pergunta | Requisito | Estruturas elegíveis | Dessas, relevantes p/ fono |\n|---|---|---:|---:|")

    def row(nome, req, pred):
        es = [e for e in estruturas if e["jogo"] and pred(e)]
        L.append(f"| {nome} | {req} | {len(es)} | {sum(1 for e in es if e['relevancia_fono'])} |")

    def curada(e, campo):
        return campo in e["fontes"].get("escrito_por_ia", [])

    row("Encontre a estrutura / Que estrutura é esta?", "tem malha ou marcador próprio no 3D", lambda e: e["tem_geometria_propria"])
    row("Qual a função?", "`funcao` curada", lambda e: curada(e, "funcao"))
    row("Qual o nervo que inerva?", "`inervado_por_ids` curado", lambda e: curada(e, "inervado_por") and bool(e["relacoes"].get("inervado_por_ids")))
    row("Origem", "`origem` curada", lambda e: curada(e, "origem"))
    row("Inserção", "`insercao` curada", lambda e: curada(e, "insercao"))
    L.append("\n(Só estruturas com `jogo: true`. O número final de perguntas também depende de haver alternativas suficientes; o teste `web/tests/game-core.test.html` conta as perguntas realmente geradas.)\n")
    L.append("## 5. Regiões (fases do jogo) e ordem sugerida\n")
    L.append("| Ordem | Região | Estruturas na base | No jogo | Relevantes p/ fono (no jogo) |\n|---:|---|---:|---:|---:|")
    for r in sorted(out["regioes"], key=lambda r: r["ordem"]):
        es = [e for e in estruturas if e["regiao"] == r["id"]]
        gj = [e for e in es if e["jogo"]]
        L.append(f"| {r['ordem']} | {r['nome']} | {len(es)} | {len(gj)} | {sum(1 for e in gj if e['relevancia_fono'])} |")
    excl = Counter(e["jogo_excluido_por"] for e in estruturas if not e["jogo"])
    L.append("\nFora do jogo: " + "; ".join(f"{k}: {v}" for k, v in excl.most_common()) + ".")
    L.append(f"\nTotal relevante para fonoaudiologia (regra automática): **{n_rel}** de {N}. A ordem das regiões é uma sugestão inicial; a Fase 2 pode ajustar.\n")
    L.append("## 6. Estruturas com campos vazios\n")
    L.append("A lista completa (uma linha por estrutura, com o que falta) está em [`campos-vazios.csv`](campos-vazios.csv) — abre direto no Excel.\n")
    L.append(f"- **Sem nome em latim ({N - n_lat})** e **sem tradução na TA2 — nome em português cai para o inglês ({len(pt_ingles)})**: " + "; ".join(e["nome_en"] for e in pt_ingles) + "\n")
    L.append(f"- **Sem malha própria no 3D ({len(sem_geo)})** — só têm áreas de fixação muscular ou o objeto não tem malha no .glb; ficam fora de 'Encontre a estrutura': " + ("; ".join(f"{e['nome_pt']} ({e['nome_en']})" for e in sem_geo) or "nenhuma") + "\n")
    if avisos:
        L.append(f"- **Avisos de licença ({len(avisos)})** — campo `aviso_licenca` (ver `docs/fase-0/inventario-licencas.md`):")
        for e in avisos:
            L.append(f"  - {e['nome_en']}: {e['aviso_licenca']}")
        L.append("")
    faltando = Counter()
    for e in estruturas:
        for f in expected_fields(e):
            if not has_field(e, f):
                faltando[f] += 1
    L.append("Campos esperados que faltam (considerando só o que faz sentido para o tipo — função/latim para todos; origem, inserção e inervação para músculos; 'inerva' para nervos): " + ", ".join(f"{f}: {n}" for f, n in faltando.most_common()) + ".\n")
    if desconhecidos:
        L.append(f"- Ajustes com id inexistente (ignorados): {', '.join(desconhecidos)}\n")
    L.append("## 7. Como a base é mantida\n")
    L.append("- **Estruturas novas** que entrarem no `manifest.json` aparecem sozinhas ao rodar `python scripts/build_database.py`.\n- **Correções/enriquecimento manual** (função, origem, inervação, `revisado: true`...) vão em `data/estruturas_ajustes.json`, por `id`; sobrevivem a cada regeneração.\n- **Regras** de região, tipo, relevância para fono e dificuldade estão em `data/regras_base_dados.json` — todas são palpites automáticos e valem `revisado: false`.\n")
    with open(P("docs", "fase-1", "relatorio-base-dados.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L))

    with open(P("docs", "fase-1", "campos-vazios.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "nome_pt", "nome_en", "tipo", "regiao", "relevancia_fono", "dificuldade", "faltando", "tem_geometria_propria", "fonte_descricao"])
        for e in estruturas:
            miss = [fld for fld in expected_fields(e) if not has_field(e, fld)]
            w.writerow([e["id"], e["nome_pt"], e["nome_en"], tipos.get(e["tipo"], e["tipo"]), regioes.get(e["regiao"], e["regiao"]),
                        "sim" if e["relevancia_fono"] else "não", e["dificuldade"], ", ".join(miss), "sim" if e["tem_geometria_propria"] else "não", e["fontes"]["descricao"] or ""])


if __name__ == "__main__":
    sys.exit(main())
