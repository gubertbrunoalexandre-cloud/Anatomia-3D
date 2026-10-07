# Fase 0.2 — Auditoria de cobertura (somente relatório)

Gerado por `scripts/audit_head_neck.py` (somente leitura; pode ser rodado de novo). **Nada foi adicionado ao app.**

## 1. Números gerais

"Cabeça e pescoço" = objetos **com geometria real** nas coleções `Head` ou `Neck` do `.blend` do Z-Anatomy. Etiquetas de texto e objetos-"gancho" (sem faces) ficam de fora porque não têm o que desenhar.

- Objetos com geometria em Head ∪ Neck: **1013**
- Desses, já no app: **575** (57%) · **fora do app: 438** (238 nomes distintos, juntando esquerdo/direito)
- O app também tem **190** objetos que não estão em Head/Neck (principalmente cérebro e nervos, que o Z-Anatomy guarda em outras coleções). Total no app: 765 objetos com geometria + 36 marcadores sintéticos = 801 nomes.
- Há ainda estruturas de cabeça/pescoço guardadas em coleções de outros sistemas (tireoide, paratireoides, traqueia, esôfago, seio cavernoso...) — seção 4.
- Se **tudo** de Head/Neck fosse incluído: ≈ 1.088.531 vértices a mais ≈ **+30 MB** nos `.glb` (hoje 27,0 MB → cerca de 57 MB). Estimativa pela média medida de 27.3 bytes/vértice. Artérias e encéfalo respondem por cerca de 2/3 disso.

## 2. Por categoria

| Categoria | Em Head/Neck | Já no app | Faltam | Vértices que faltam | ≈ MB a mais |
|---|---:|---:|---:|---:|---:|
| Músculos | 166 | 154 | 12 | 8.332 | 0.23 |
| Ossos | 38 | 32 | 6 | 10.864 | 0.30 |
| Cartilagens | 11 | 11 | 0 | 0 | 0.00 |
| Dentes | 28 | 0 | 28 | 23.500 | 0.64 |
| Ligamentos / articulações / discos | 37 | 16 | 21 | 18.884 | 0.52 |
| Fáscias e aponeuroses (tecido conjuntivo) | 8 | 2 | 6 | 24.406 | 0.67 |
| Artérias | 144 | 62 | 82 | 436.267 | 11.91 |
| Veias e seios venosos | 54 | 8 | 46 | 50.880 | 1.39 |
| Vasos (ramos soltos) | 14 | 2 | 12 | 44.376 | 1.21 |
| Nervos, núcleos e gânglios | 105 | 66 | 39 | 126.274 | 3.45 |
| Encéfalo / sistema nervoso central | 219 | 132 | 87 | 263.184 | 7.18 |
| Órgãos dos sentidos (olho, orelha) | 40 | 4 | 36 | 59.518 | 1.62 |
| Glândulas | 6 | 4 | 2 | 344 | 0.01 |
| Linfonodos | 38 | 8 | 30 | 10.148 | 0.28 |
| Regiões e marcos de superfície | 105 | 74 | 31 | 11.554 | 0.32 |

(Objetos esquerdo/direito contam separado; as listas abaixo juntam os dois e marcam `×2`.)

## 3. O que existe no dataset e NÃO está no app

### Músculos — faltam 12 objetos (6 nomes)

**Por que ficou de fora:** O músculo **bucinador** está escrito "Bucinator" no dataset (um "c" só), e a palavra-chave do script é "buccinator" — nunca casou. Os demais (anel tendíneo comum, tarso superior/inferior, depressor do septo nasal, rotadores) não têm palavra-chave em nenhuma categoria.

Bucinator ×2; Common tendinous ring ×2; Depressor septi nasi ×2; Inferior tarsus ×2; Rotatores ×2; Superior tarsus ×2

### Ossos — faltam 6 objetos (3 nomes)

**Por que ficou de fora:** Ossículos (martelo, bigorna, estribo) não têm palavra-chave. Todos os ossos do crânio, mandíbula e hioide já estão.

Incus ×2; Malleus ×2; Stapes ×2

### Cartilagens — completo (11/11)
Completo: todas as cartilagens de cabeça/pescoço do dataset já estão no app.

### Dentes — faltam 28 objetos (14 nomes)

**Por que ficou de fora:** Nenhuma categoria tem palavra-chave de dente (28 objetos: 14 dentes × 2 lados).

Lower canine ×2; Lower first molar tooth ×2; Lower first premolar ×2; Lower lateral incisor ×2; Lower medial incisor ×2; Lower second molar tooth ×2; Lower second premolar ×2; Upper canine ×2; Upper first molar tooth ×2; Upper first premolar ×2; Upper lateral incisor ×2; Upper medial incisor ×2; Upper second molar tooth ×2; Upper second premolar ×2

### Ligamentos / articulações / discos — faltam 21 objetos (16 nomes)

**Por que ficou de fora:** As categorias só pegam ligamentos por palavra-chave específica (cricotireóideo, membrana tíreo-hióidea, ATM). Faltam esfenomandibular, estilomandibular, ligamentos tíreo-hióideos, nucal, longitudinais, interespinhosos, flavos e núcleo pulposo dos discos.

Anterior longitudinal ligament; Interspinous ligaments; Lateral thyrohyoid ligament ×2; Ligamenta flava; Median thyrohyoid ligament; Nuchal ligament; Nucleus pulposus C2-C3; Nucleus pulposus C3-C4; Nucleus pulposus C4-C5; Nucleus pulposus C5-C6; Nucleus pulposus C6-C7; Posterior longitudinal ligament; Pterygospinous ligament ×2; Quadrangular membrane ×2; Sphenomandibular ligament ×2; Stylomandibular ligament ×2

### Fáscias e aponeuroses (tecido conjuntivo) — faltam 6 objetos (3 nomes)

**Por que ficou de fora:** Sem categoria própria; não há palavra-chave para fáscia.

Epicranial aponeurosis ×2; Superficial investing cervical fascia ×2; Superficial layer of temporal fascia ×2

### Artérias — faltam 82 objetos (43 nomes)

**Por que ficou de fora:** **O app não tem categoria de vasos.** As artérias que aparecem hoje são acidentais (ramos cerebrais que casaram com a categoria "cérebro", artéria maxilar etc.). Carótidas, facial, vertebral, occipital, temporal superficial, oftálmica, basilar... ficaram de fora por isso.

Angular artery ×2; Anterior communicating artery; Anterior deep temporal artery ×2; Anterior spinal artery ×2; Artery of pterygoid canal ×2; Basilar artery; Callosomarginal artery ×2; Central retinal artery ×2; Deep cervical artery ×2; External carotid artery ×2; Facial artery ×2; Frontal branch of superficial temporal artery ×2; Frontal branches of callosomarginal artery ×2; Inferior alveolar artery ×2; Inferior thyroid artery ×2; Internal carotid artery ×2; Lacrimal artery ×2; Lateral frontobasal artery ×2; Lateral occipital artery ×2; Lateral pontine branches of basilar artery ×2; Left common carotid artery; Medial occipital artery ×2; Medial pontine branches of basilar artery ×2; Mental branch of inferior alveolar artery ×2; Occipital artery ×2; Ophthalmic artery ×2; Parieto-occipital artery ×2; Pericallosal artery ×2; Postcentral arterial branch ×2; Posterior communicating artery ×2; Posterior deep temporal artery ×2; Posterior superior alveolar artery ×2; Right common carotid artery; Long posterior ciliary arteries ×2; Posterior parietal artery ×2; Prefrontal artery ×2; Short posterior ciliary arteries ×2; Submental artery ×2; Superficial temporal artery ×2; Supratrochlear artery ×2; Transverse cervical artery ×2; Transverse facial artery ×2; Vertebral artery ×2

### Veias e seios venosos — faltam 46 objetos (26 nomes)

**Por que ficou de fora:** Mesmo motivo: não existe categoria de veias. Inclui jugulares, facial, retromandibular, seios da dura-máter.

Angular vein ×2; Anterior division of retromandibular vein ×2; Anterior intercavernous sinus; Anterior jugular vein ×2; External jugular vein ×2; Facial vein ×2; Inferior ophthalmic vein ×2; Inferior petrosal sinus ×2; Inferior sagittal sinus; Internal jugular vein ×2; Occipital sinus; Occipital vein ×2; Posterior auricular vein ×2; Posterior division of retromandibular vein ×2; Posterior intercavernous sinus; Retromandibular vein ×2; Sigmoid sinus ×2; Straight sinus; Submental vein ×2; Superficial temporal veins ×2; Superior ophthalmic vein ×2; Superior petrosal sinus ×2; Superior sagittal sinus; Superior thyroid vein ×2; Transverse sinus ×2; Vertebral vein ×2

### Vasos (ramos soltos) — faltam 12 objetos (6 nomes)

**Por que ficou de fora:** Ramos soltos (estriados, temporais) sem categoria.

?x ×2; Anterior temporal branch ×2; Distal lateral striate branches ×2; Posterior temporal branch ×2; Proximal lateral striate branches ×2; Temporo-occipital branch ×2

### Nervos, núcleos e gânglios — faltam 39 objetos (20 nomes)

**Por que ficou de fora:** Os nervos VI (abducente) e VIII (vestibulococlear) foram deixados de fora de propósito (fora do escopo original). Nervo alveolar inferior e mentual não casam com as palavras-chave do V par. Núcleos (ambíguo, salivatórios), tronco e nervos simpáticos e nervos de ombro/plexo braquial não têm categoria.

Abducens nerve (VI) ×2; Anterior cochlear nucleus ×2; Cochlear nerve ×2; Dorsal scapular nerve ×2; Ganglia of sympathetic trunk ×2; Inferior alveolar nerve ×2; Inferior salivatory nucleus ×2; Long thoracic nerve ×2; Mental nerve ×2; Nucleus ambiguus ×2; Nucleus of abducens nerve ×2; Red nucleus ×2; Posterior cochlear nucleus ×2; Pyramis of vermis; Roots of brachial plexus ×2; Superior salivatory nucleus ×2; Sympathetic nerves ×2; Sympathetic trunk ×2; Vestibular nerve ×2; Vestibulocochlear nerve (VIII) ×2

### Encéfalo / sistema nervoso central — faltam 87 objetos (50 nomes)

**Por que ficou de fora:** A categoria "cérebro" usa uma lista de palavras-chave de giros/sulcos; cerebelo (lóbulos), colículos, corpos geniculados, comissuras, amígdala, hábenula etc. não estão nela.

Amygdaloid body ×2; Anterior commissure; Anterior quadrangular lobule ×2; Auditory tube ×2; Biventral lobule ×2; Central canal'; Central lobule; Culmen; Cuneus ×2; Declive; Flocculus ×2; Folium of vermis; Gracile lobule ×2; Habenula; Inferior colliculus ×2; Inferior semilunar lobule ×2; Interpeduncular fossa ×2; Lat_Fis-ant-Horizont ×2; Lat_Fis-ant-Vertical ×2; Lat_Fis-post ×2; Lateral geniculate body ×2; Mamillary body ×2; Medial geniculate body ×2; Nodule of vermis; Occipital pole ×2; Olive ×2; Peduncle of flocculus ×2; Posterior commissure; Precuneus ×2; Septal nuclei; Posterior quadrangular lobule ×2; Septum pellucidum; Stria medullaris thalami ×2; Stria terminalis ×2; Base of peduncle ×2; Superior colliculus ×2; Superior occipital gyri ×2; Superior parietal lobule ×2; Superior semilunar lobule ×2; Temporal plane ×2; Temporal pole ×2; Tonsil of cerebellum ×2; Transverse temporal gyri ×2; Tuber of vermis; Uvula of vermis; Vestibular nuclei ×2; Vestibule ×2; White matter of telencephalon ×2; Wing of central lobule ×2; Zonular fibres ×2

### Órgãos dos sentidos (olho, orelha) — faltam 36 objetos (18 nomes)

**Por que ficou de fora:** Globo ocular (esclera, córnea, íris, cristalino, retina, corpo vítreo), aparelho lacrimal, tímpano e cóclea não têm categoria. **Cuidado:** cóclea/labirinto podem vir do conjunto "Anatomy of the Inner Ear" (CC-BY-NC-SA) — ver inventário de licenças antes de incluir.

Ampulla of lacrimal canaliculus ×2; Anterior chamber of eyeball ×2; Anterior segment of eyeball ×2; Ciliary body-curve ×2; Cochlea ×2; Cornea ×2; Iris ×2; Lacrimal canaliculus ×2; Lacrimal gland ×2; Lacrimal sac ×2; Lens ×2; Nasolacrimal duct ×2; Posterior segment of eyeball ×2; Retina ×2; Sclera ×2; Suspensory ligament of eyeball ×2; Tympanic membrane ×2; Vitreous body ×2

### Glândulas — faltam 2 objetos (1 nomes)

**Por que ficou de fora:** Só "linfonodos tireoidianos" nesta região; a glândula lacrimal está em órgãos dos sentidos, e a tireoide fica fora de Head/Neck (seção 4).

Thyroid nodes ×2

### Linfonodos — faltam 30 objetos (16 nomes)

**Por que ficou de fora:** Sem categoria de linfonodos. (Tonsilas palatinas/faríngeas já estão em "Faringe".)

Anterior inferior jugular nodes ×2; Bucinator node ×2; Inferior deep lateral cervical nodes ×2; Infra-auricular nodes ×2; Lateral superior jugular node ×2; Mandibular node ×2; Mastoid nodes ×2; Occipital nodes ×2; Paratracheal cervical nodes; Pre-auricular nodes ×2; Pretracheal nodes ×2; Submandibular nodes ×2; Submental nodes ×2; Superficial anterior cervical nodes; Superficial lateral cervical nodes ×2; Supraclavicular nodes ×2

### Regiões e marcos de superfície — faltam 31 objetos (16 nomes)

**Por que ficou de fora:** Sobrancelhas, cílios, cabelos, fossas e eminências do pavilhão auricular e fossas supraclaviculares não casaram com a lista de regiões.

Angle of mouth ×2; Auricular tubercle ×2; Eminentia fossae triangularis ×2; Eminentia scaphae ×2; Eyebrow ×2; Eyelashes ×2; Fossa antihelica ×2; Greater supraclavicular fossa ×2; Hairs of eyebrow ×2; Hairs of head; Intertragic incisure ×2; Lesser supraclavicular fossa ×2; Oral region ×2; Posterior auricular groove ×2; Scapha ×2; Triangular fossa ×2

## 4. Cabeça/pescoço guardados fora de Head/Neck (também ausentes)

O script de exportação seleciona por **palavra-chave no nome**, não por coleção, então estas só entrariam com palavra-chave nova:

- Thyroid gland; Inferior parathyroid gland; Superior parathyroid gland; Trachea; Oesophagus; Submandibular duct; Cavernous sinus; Common facial vein; Thyrocervical trunk; Costocervical trunk; Deep/Superficial branch of transverse cervical artery; Prevertebral nodes; Juxta-oesophageal nodes

Observação: **tireoide**, **traqueia** e **esôfago** existem no dataset com geometria — relevantes para fonoaudiologia (voz e deglutição).

## 5. O que NÃO existe no dataset (busca por nome em todos os 7.184 objetos)

Nem malha, nem gancho. Se forem necessários no app, teriam de vir de outra fonte (ou ser representados só por alfinete/marcador):

- **Músculos:** levantador do véu palatino, tensor do véu palatino, palatoglosso, salpingofaríngeo, cricofaríngeo, estiloglosso, músculos intrínsecos da língua (longitudinal, transverso, vertical), auriculares, estapédio, tensor do tímpano, transverso do mento, incisivo, dilatador e compressor do nariz
- **Ligamentos:** ligamento vocal, ligamento vestibular, ligamento cricotraqueal, rafe pterigomandibular, ligamento transverso do atlas, ligamento apical, ligamentos alares
- **Artérias:** artéria lingual, artéria tireóidea superior
- **Nervos:** laríngeo recorrente, laríngeo superior, alça cervical (ansa), auriculotemporal, auricular magno, occipital maior, infraorbital, supraorbital
- **Partes moles:** palato duro, adenoide (só existe como etiqueta), prega vocal e prega vestibular como malhas próprias, septo nasal, seio maxilar, seio esfenoidal
- **Glândulas:** hipófise

Limitação: a busca é por trecho do nome em inglês; uma estrutura pode existir com nome diferente (foi o caso do "Bucinator").

## 6. Problema estrutural encontrado: objetos em mais de uma categoria

59 dos 801 nomes do app estão exportados em 2 ou 3 categorias ao mesmo tempo (mesma geometria, mesmo lugar). Isso causou o bug de seleção da pele (item 0.1) e deixa os `.glb` maiores do que precisam (cada cópia carrega a malha de novo). Não mexi nos arquivos: o app agora trata as cópias como uma peça só. Dá para resolver de vez na Fase 1 (uma categoria "principal" por estrutura).

## 7. Sugestão de prioridade para fonoaudiologia (não implementado — aguarda sua aprovação)

1. **Alta (voz, fala, deglutição):** bucinador (correção de grafia), tireoide e paratireoides, traqueia e esôfago cervical, ligamentos tíreo-hióideos e esfeno/estilomandibulares, nervos VI e VIII (já existem no dataset), carótidas, artéria facial e veia jugular (contexto do pescoço).
2. **Média:** dentes (articulação dos sons), ossículos e tímpano (audição — conferir licença antes), globo ocular, aparelho lacrimal, fáscias cervicais, linfonodos cervicais.
3. **Baixa:** cerebelo detalhado, núcleos, seios venosos, demais ramos arteriais.

### Lista completa das 59 peças duplicadas (afetadas pelo bug 0.1)

**Causa:** o script de exportação escolhe peças por palavra-chave no nome, e a mesma peça do Blender casou com palavras-chave de mais de uma categoria. Resultado: duas (ou três) cópias idênticas no mesmo lugar do 3D. O clique escolhia a cópia "errada" (a de outra categoria) e o destaque azul ficava escondido atrás da cópia gêmea — o painel abria, mas nada acendia no modelo. Era mais visível na pele porque 10 regiões de superfície (região orbital, infraorbital, bucal, parotideomassetérica e do esternocleidomastóideo, direita e esquerda) tinham a cópia da pele sempre atrás da cópia do crânio/cavidade oral/músculos do pescoço.

**Correção:** o app agora trata cópias de mesmo nome como uma peça só (clique escolhe a categoria mais apropriada, destaque e "ocultar" valem para todas as cópias). Os `.glb` não foram alterados.

| Categorias em que o objeto aparece | Objetos (nome; ×2 = esquerdo e direito) |
|---|---|
| cavidade_oral_lingua + regioes_superficie | Buccal region ×2 |
| orelha_nariz_cartilagem + regioes_superficie | Concha of auricle ×2; Lobule of auricle ×2 |
| faringe + nervo_IX_glossofaringeo | Glossopharyngeal nerve (IX) ×2 |
| atm + musculos_mastigacao | Inferior head of lateral pterygoid muscle ×2; Lateral pterygoid muscle ×4; Medial pterygoid muscle ×6; Superior head of lateral pterygoid muscle ×2 |
| cranio_ossos + regioes_superficie | Infra-orbital region ×2; Orbital region ×2 |
| faringe + laringe | Laryngopharynx |
| cavidade_oral_lingua + cerebro | Lingual gyrus ×2; Mentolabial sulcus ×2; Nasolabial sulcus ×2 |
| cranio_ossos + nervo_V_trigemeo | Maxillary nerve ×2 |
| cerebro + cranio_ossos + nervo_V_trigemeo | Meningeal branch of maxillary nerve ×2 |
| cerebro + nervo_I_olfatorio | Olfactory sulcus ×2 |
| cerebro + cranio_ossos | Orbital gyri (Frontomarginal gyrus and sulcus*) ×2; Orbital part of  inferior frontal gyrus ×2; Orbital sulci (Lateral Orbital sulcus*) ×2; Orbitofrontal branches of anterior cerebral artery ×2 |
| cranio_ossos + musculos_faciais | Orbital part of orbicularis oculi ×4 |
| cavidade_oral_lingua + cranio_ossos | Palatine bone ×2 |
| cavidade_oral_lingua + faringe | Palatine tonsil ×2 |
| cavidade_oral_lingua + musculos_mastigacao + regioes_superficie | Parotideomasseteric region ×2 |
| musculos_pescoco + regioes_superficie | Sternocleidomastoid region ×2 |
