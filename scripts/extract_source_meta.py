"""
Extrai do Startup.blend os metadados que o manifest.json nao guarda e que a base
de dados (scripts/build_database.py) precisa:
  - para cada objeto exportado: sistema do Z-Anatomy (coluna "1: Skeletal system" etc.),
    sub-colecoes e se esta em Head/Neck;
  - para cada estrutura: o link da pagina original da Wikipedia (o Z-Anatomy poe o
    link no fim de cada texto; o export_head_neck.py o descarta ao limpar a descricao).
Somente leitura. Gera data/source_meta.json.

Uso (headless):
    blender --background data/blender_source/Startup.blend --python scripts/extract_source_meta.py
"""
import bpy
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath))
PROJECT = os.path.abspath(os.path.join(HERE, "..", ".."))
MANIFEST = os.path.join(PROJECT, "data", "glb", "manifest.json")
EXPORT_SCRIPT = os.path.join(PROJECT, "scripts", "export_head_neck.py")
OUT = os.path.join(PROJECT, "data", "source_meta.json")

# reaproveita LANDMARK_MARKERS / base_name / normalize_key do script de exportacao (sem rodar o main())
src = open(EXPORT_SCRIPT, encoding="utf-8").read()
src = re.sub(r"^main\(\)\s*$", "", src, flags=re.M)
ns = {"__name__": "export_defs", "__file__": EXPORT_SCRIPT}
exec(compile(src, EXPORT_SCRIPT, "exec"), ns)
LANDMARK_MARKERS, base_name, normalize_key = ns["LANDMARK_MARKERS"], ns["base_name"], ns["normalize_key"]

manifest = json.load(open(MANIFEST, encoding="utf-8"))
app_names = sorted({n for v in manifest["categories"].values() for n in v["objects"]})

SYSTEMS = [
    "1: Skeletal system", "2: Muscular insertions", "3: Joints", "4: Muscular system",
    "5: Cardiovascular system", "6: Lymphoid organs", "7: Nervous system & Sense organs",
    "8: Visceral systems", "9: Regions of human body",
]

objects = {}
for name in app_names:
    marker = name in LANDMARK_MARKERS
    o = bpy.data.objects.get(LANDMARK_MARKERS[name] if marker else name)
    if o is None:
        objects[name] = {"found": False, "marker": marker}
        continue
    colls = [c.name for c in o.users_collection]
    objects[name] = {
        "found": True,
        "marker": marker,
        "systems": [c for c in SYSTEMS if c in colls],
        "in_head": "Head" in colls,
        "in_neck": "Neck" in colls,
        "colls": [c for c in colls if c not in SYSTEMS and c not in ("Head", "Neck")][:6],
    }

# link da Wikipedia: ultimo URL do texto; entre textos de mesma chave, o mais longo
# (mesmo criterio que o export_head_neck.py usa para escolher a descricao)
URL_RE = re.compile(r"https?://\S+")
wanted = {normalize_key(base_name(n)) for n in app_names}
wiki = {}
best_len = {}
for t in bpy.data.texts:
    key = normalize_key(t.name)
    if key not in wanted:
        continue
    s = t.as_string()
    urls = URL_RE.findall(s)
    if not urls:
        continue
    if key not in best_len or len(s) > best_len[key]:
        best_len[key] = len(s)
        url = urls[-1].rstrip(".,;")
        while url.endswith(")") and url.count(")") > url.count("("):
            url = url[:-1]  # parentese de fechamento sobrando (ex.: citacao entre parenteses), mantem o balanceado
        wiki[key] = url

json.dump({"objects": objects, "wiki_url": wiki}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("META DONE ->", OUT, len(objects), "objetos,", len(wiki), "links")
