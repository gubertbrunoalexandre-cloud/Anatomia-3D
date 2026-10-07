"""
Auditoria de cobertura: compara TODAS as estruturas de cabeca e pescoco do dataset
(Z-Anatomy / Startup.blend) com o que o app exporta hoje (data/glb/manifest.json).
Somente leitura - nao altera nenhum arquivo do projeto.

Uso (headless):
    blender --background data/blender_source/Startup.blend --python scripts/audit_head_neck.py
    (opcional) variavel de ambiente AUDIT_OUT = caminho do .json de saida

"Cabeca e pescoco" = objetos com geometria real que pertencem a colecao "Head" ou
"Neck" do .blend (as colecoes de regiao do Z-Anatomy).
"""
import bpy
import json
import os
import re
import tempfile

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath))
PROJECT = os.path.abspath(os.path.join(HERE, "..", ".."))
MANIFEST = os.path.join(PROJECT, "data", "glb", "manifest.json")
EXPORT_SCRIPT = os.path.join(PROJECT, "scripts", "export_head_neck.py")
OUT = os.environ.get("AUDIT_OUT", os.path.join(tempfile.gettempdir(), "audit_head_neck.json"))

# reaproveita CATEGORIES / matches / FALSE_POSITIVES do script de exportacao (sem rodar o main())
src = open(EXPORT_SCRIPT, encoding="utf-8").read()
src = re.sub(r"^main\(\)\s*$", "", src, flags=re.M)
ns = {"__name__": "export_defs", "__file__": EXPORT_SCRIPT}
exec(compile(src, EXPORT_SCRIPT, "exec"), ns)
CATEGORIES, FALSE_POSITIVES, matches, base_name = ns["CATEGORIES"], ns["FALSE_POSITIVES"], ns["matches"], ns["base_name"]

manifest = json.load(open(MANIFEST, encoding="utf-8"))
app_cat_of = {}
for cat, v in manifest["categories"].items():
    for n in v["objects"]:
        app_cat_of.setdefault(n, []).append(cat)

SYSTEMS = [
    "1: Skeletal system", "2: Muscular insertions", "3: Joints", "4: Muscular system",
    "5: Cardiovascular system", "6: Lymphoid organs", "7: Nervous system & Sense organs",
    "8: Visceral systems", "9: Regions of human body",
]


def has_geo(o):
    if o.type == "MESH":
        return len(o.data.polygons) > 0
    if o.type == "CURVE":
        return len(o.data.splines) > 0
    return False


dg = bpy.context.evaluated_depsgraph_get()


def eval_counts(o):
    eo = o.evaluated_get(dg)
    try:
        me = eo.to_mesh()
        nv, nf = len(me.vertices), len(me.polygons)
        eo.to_mesh_clear()
        return nv, nf
    except Exception:
        return 0, 0


records = []
for o in bpy.data.objects:
    colls = [c.name for c in o.users_collection]
    in_scope = ("Head" in colls) or ("Neck" in colls)
    in_app = o.name in app_cat_of
    if not has_geo(o) or not (in_scope or in_app):
        continue
    nv, nf = eval_counts(o)
    system = next((c for c in colls if c in SYSTEMS), None)
    subs = [c for c in colls if c not in SYSTEMS and c not in ("Head", "Neck")]
    low = o.name.lower()
    records.append({
        "name": o.name, "type": o.type, "system": system, "colls": subs[:8],
        "in_head": "Head" in colls, "in_neck": "Neck" in colls,
        "verts": nv, "faces": nf,
        "in_app": in_app, "app_cats": app_cat_of.get(o.name, []),
        "kw_cats": [c for c, kws in CATEGORIES.items() if matches(low, kws)],
        "false_positive": base_name(o.name).lower() in FALSE_POSITIVES,
    })

# lista de verificacao: estruturas que um curriculo de fono/cabeca-pescoco esperaria
CHECK = {
    "ossos": ["mandible", "maxilla", "hyoid", "zygomatic bone", "sphenoid", "ethmoid", "vomer", "palatine bone",
              "nasal bone", "lacrimal bone", "inferior nasal concha", "temporal bone", "occipital bone", "parietal bone",
              "frontal bone", "tooth", "incisor", "canine", "premolar", "molar", "malleus", "incus", "stapes", "styloid"],
    "ligamentos_articulacoes": ["temporomandibular", "stylohyoid ligament", "stylomandibular", "sphenomandibular",
              "pterygomandibular", "vocal ligament", "vestibular ligament", "thyrohyoid", "cricothyroid", "cricotracheal",
              "alar ligament", "transverse ligament of atlas", "apical ligament", "nuchal ligament", "longitudinal ligament",
              "interspinous", "atlanto", "intervertebral disc", "cricoarytenoid joint", "crico-arytenoid joint", "suture"],
    "arterias": ["common carotid", "internal carotid", "external carotid", "facial artery", "lingual artery",
              "superior thyroid artery", "inferior thyroid artery", "maxillary artery", "vertebral artery",
              "ascending pharyngeal", "occipital artery", "superficial temporal", "ophthalmic artery", "basilar",
              "middle cerebral", "subclavian", "thyrocervical"],
    "veias": ["internal jugular", "external jugular", "facial vein", "retromandibular", "anterior jugular",
              "vertebral vein", "sigmoid sinus", "transverse sinus", "superior sagittal"],
    "glandulas": ["thyroid gland", "parathyroid", "parotid gland", "submandibular gland", "sublingual gland",
              "lacrimal gland", "pituitary", "pineal", "salivary"],
    "nervos": ["olfactory", "optic", "oculomotor", "trochlear", "trigeminal", "abducens", "abducent", "facial nerve",
              "vestibulocochlear", "glossopharyngeal", "vagus", "accessory nerve", "hypoglossal", "recurrent laryngeal",
              "superior laryngeal", "ansa cervicalis", "cervical plexus", "phrenic", "lingual nerve", "inferior alveolar",
              "mental nerve", "auriculotemporal", "great auricular", "greater occipital", "chorda tympani",
              "nerve to mylohyoid", "infra-orbital nerve", "supra-orbital nerve"],
    "musculos": ["buccinator", "mentalis", "masseter", "temporalis", "pterygoid", "digastric", "mylohyoid",
              "geniohyoid", "stylohyoid", "omohyoid", "sternohyoid", "sternothyroid", "thyrohyoid", "platysma",
              "sternocleidomastoid", "trapezius", "scalen", "longus", "splenius", "semispinalis", "levator veli",
              "tensor veli", "palatoglossus", "palatopharyngeus", "uvula", "salpingopharyngeus", "stylopharyngeus",
              "constrictor", "cricopharyngeus", "genioglossus", "hyoglossus", "styloglossus", "longitudinal muscle",
              "transverse muscle of tongue", "vertical muscle", "orbicularis oris", "orbicularis oculi", "zygomaticus",
              "risorius", "levator labii", "levator anguli", "depressor", "procerus", "nasalis", "frontalis",
              "occipitalis", "temporoparietalis", "auricularis", "stapedius", "tensor tympani", "corrugator",
              "levator palpebrae", "rectus", "oblique", "transversus menti", "incisivus", "dilator naris", "compressor naris"],
    "partes_moles_orgaos": ["hard palate", "soft palate", "tongue", "uvula", "tonsil", "adenoid", "epiglottis",
              "vocal fold", "vestibular fold", "trachea", "esophagus", "eyeball", "lens", "cornea", "retina", "iris",
              "eyelid", "lacrimal", "nasal cavity", "nasal septum", "paranasal", "maxillary sinus", "frontal sinus",
              "sphenoid sinus", "ethmoid", "middle ear", "tympanic membrane", "cochlea", "semicircular", "auditory tube",
              "eustachian", "lymph node", "fascia", "bursa"],
}
check_out = {}
for group, terms in CHECK.items():
    check_out[group] = {}
    for t in terms:
        hits = [o for o in bpy.data.objects if t in o.name.lower()]
        geo = [o for o in hits if has_geo(o)]
        check_out[group][t] = {
            "any": len(hits), "geo": len(geo),
            "geo_in_scope": len([o for o in geo if any(c.name in ("Head", "Neck") for c in o.users_collection)]),
            "geo_in_app": len([o for o in geo if o.name in app_cat_of]),
            "examples_geo": [o.name for o in geo][:6],
            "examples_nogeo": [f"{o.name}[{o.type}]" for o in hits if not has_geo(o)][:4],
        }

json.dump({"records": records, "check": check_out}, open(OUT, "w", encoding="utf-8"))
print("AUDIT DONE ->", OUT, len(records), "registros")
