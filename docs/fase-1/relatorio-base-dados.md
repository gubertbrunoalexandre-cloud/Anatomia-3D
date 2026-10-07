# Fase 1 — Relatório da base de dados (`data/estruturas.json`)

Gerado automaticamente por `scripts/build_database.py`. Fonte de tudo: manifest, descrições, TA2 e metadados do `.blend` que já existiam; **nenhuma estrutura nova foi adicionada**.

## 1. Números pedidos

| Item | Estruturas |
|---|---:|
| **Total de estruturas** (esquerdo/direito juntos) | **375** |
| Com descrição | 375 (100%) |
| Com nome em latim | 350 (93%) |
| Com função | 35 (9%) |
| `revisado: false` | **375 (100%)** |

`revisado` é `false` em todas porque nenhum texto foi conferido por uma pessoa especialista: as descrições são da Wikipédia traduzidas por IA (ou texto geral escrito por IA), e função/relações são frases copiadas dessas descrições.

### Origem das descrições

- Wikipédia traduzida por IA: 328
- Conhecimento geral (IA), sem artigo-fonte: 44
- Escrita para o projeto (IA): 2
- Outra fonte (não Wikipédia) traduzida por IA: 1

Link da Wikipédia por estrutura (para a atribuição CC BY-SA): **276** estruturas têm `fontes.descricao_url`.

## 2. Função e relações (frases copiadas das descrições)

| Campo | Estruturas |
|---|---:|
| função | 35 |
| origem | 52 |
| inserção | 27 |
| inervado por (texto) — músculos etc. | 20 |
| inervado por, ligado a um nervo da base (`inervado_por_ids`) | 11 |
| inerva (texto) — nervos | 8 |

Esses campos ficam vazios quando a descrição não traz a informação; **não inventei conteúdo**. Isso limita as perguntas de função/relações (ver seção 4).

## 3. Por tipo de estrutura

| Tipo | Total | Latim | Função | Relevante p/ fono | Fácil (1) | Médio (2) | Difícil (3) |
|---|---:|---:|---:|---:|---:|---:|---:|
| Músculo | 86 | 86 | 7 | 48 | 11 | 59 | 16 |
| Encéfalo (sistema nervoso central) | 82 | 61 | 14 | 12 | 0 | 0 | 82 |
| Região de superfície | 37 | 37 | 1 | 18 | 0 | 32 | 5 |
| Marco ósseo (forame, canal, sutura) | 36 | 36 | 3 | 7 | 0 | 0 | 36 |
| Artéria | 32 | 29 | 3 | 10 | 1 | 16 | 15 |
| Osso | 27 | 27 | 0 | 8 | 11 | 16 | 0 |
| Nervo | 25 | 25 | 5 | 17 | 11 | 8 | 6 |
| Órgão / víscera | 10 | 10 | 1 | 9 | 6 | 4 | 0 |
| Cartilagem | 8 | 8 | 0 | 8 | 5 | 2 | 1 |
| Articulação / disco | 8 | 8 | 0 | 2 | 0 | 8 | 0 |
| Glândula | 7 | 7 | 1 | 4 | 0 | 7 | 0 |
| Tecido linfoide | 6 | 6 | 0 | 6 | 1 | 5 | 0 |
| Ligamento / membrana | 4 | 4 | 0 | 4 | 0 | 4 | 0 |
| Veia / seio venoso | 4 | 4 | 0 | 4 | 1 | 3 | 0 |
| Fáscia / aponeurose | 2 | 2 | 0 | 2 | 1 | 1 | 0 |
| Vaso | 1 | 0 | 0 | 1 | 0 | 0 | 1 |

## 4. Quantas estruturas servem a cada tipo de pergunta

O jogo só usa uma estrutura numa pergunta se o campo necessário existir.

| Pergunta | Requisito | Estruturas elegíveis | Dessas, relevantes p/ fono |
|---|---|---:|---:|
| Encontre a estrutura / Que estrutura é esta? | tem malha ou marcador próprio no 3D | 373 | 158 |
| Qual a função? | campo `funcao` | 35 | 12 |
| Qual o nervo que inerva? | `inervado_por_ids` (nervo da base) | 11 | 8 |
| Origem / inserção | `origem` ou `inserção` | 55 | 24 |
| Nome em latim | `nome_latim` | 350 | 158 |

## 5. Regiões (fases do jogo) e ordem sugerida

| Ordem | Região | Estruturas | Relevantes p/ fono |
|---:|---|---:|---:|
| 1 | Ossos do crânio | 31 | 10 |
| 2 | Músculos da mastigação | 9 | 9 |
| 3 | Laringe e pregas vocais | 14 | 14 |
| 4 | Cavidade oral e língua | 32 | 32 |
| 5 | Faringe | 13 | 13 |
| 6 | ATM (temporomandibular) | 3 | 3 |
| 7 | Músculos supra/infra-hióideos | 14 | 14 |
| 8 | Nervos cranianos | 27 | 18 |
| 9 | Músculos faciais (expressão) | 18 | 9 |
| 10 | Músculos do pescoço | 22 | 6 |
| 11 | Vértebras cervicais | 13 | 0 |
| 12 | Cartilagens da orelha e do nariz | 13 | 13 |
| 13 | Músculos extraoculares | 7 | 0 |
| 14 | Músculos suboccipitais | 6 | 0 |
| 15 | Regiões de superfície (pele) | 22 | 3 |
| 16 | Marcos ósseos (forames, canais, suturas) | 36 | 7 |
| 17 | Cérebro | 95 | 9 |

Total relevante para fonoaudiologia (regra automática): **160** de 375. A ordem das regiões é uma sugestão inicial; a Fase 2 pode ajustar.

## 6. Estruturas com campos vazios

A lista completa (uma linha por estrutura, com o que falta) está em [`campos-vazios.csv`](campos-vazios.csv) — abre direto no Excel.

- **Sem nome em latim (25)** e **sem tradução na TA2 — nome em português cai para o inglês (25)**: Posterior transverse collateral sulcus; Anterior occipital sulcus*; Artery of central sulcus; Artery of precentral sulcus; Branch to angular gyrus; Cingulate gyrus (Posteroventral part*); Cingulate gyrus and sulcus (Middle anterior part); Cingulate gyrus and sulcus (Middle posterior part); Cingulate gyrus and sulcus (Posterior dorsal part); Cingulate sulcus (Marginal part*); Inferior occipital gyrus and sulcus*; Insula (Subcentral gyrus and ant. and post. sulci*); Insular branches of middle cerebral artery (M2-segment); Lateral occipital gyrus (Middle occipital gyrus*); Medial occipitotemporal gyrus (Parahippocampal*); Occipitotemporal sulcus (Lateral part*); Orbital gyri (Frontomarginal gyrus and sulcus*); Orbital sulci (Lateral Orbital sulcus*); Paracentral gyrus and sulcus*; Precentral sulcus (inferior part)*; Precentral sulcus (Superior part)*; Straight gyrus (Gyrus rectus); Sulcus interm_prim-Jensen; Superior temporal gyrus (Lateral part); Orbital sulci (H-shaped orbital sulci*)

- **Sem malha nem marcador próprio (2)** — só têm áreas de fixação muscular, então ficam fora de 'Encontre a estrutura': Músculo pterigóideo lateral (Lateral pterygoid muscle); Masseter (Masseter)

- **Avisos de licença (5)** — campo `aviso_licenca` (ver `docs/fase-0/inventario-licencas.md`):
  - Groove for marginal sinus: Descricao traduzida de https://dictionnaire.academie-medecine.fr/index.php?q=sillon%20du%20sinus%20marginal (nao e Wikipedia); licenca dessa fonte nao verificada.
  - Anterior semicircular canal: Ancora/posicao em colecao de ouvido interno do Z-Anatomy (conjunto 'Anatomy of the Inner Ear' e CC-BY-NC-SA); conferir licenca antes de uso comercial.
  - Lateral semicircular canal: Ancora/posicao em colecao de ouvido interno do Z-Anatomy (conjunto 'Anatomy of the Inner Ear' e CC-BY-NC-SA); conferir licenca antes de uso comercial.
  - Posterior semicircular canal: Ancora/posicao em colecao de ouvido interno do Z-Anatomy (conjunto 'Anatomy of the Inner Ear' e CC-BY-NC-SA); conferir licenca antes de uso comercial.
  - Spiral canal of cochlea: Ancora/posicao em colecao de ouvido interno do Z-Anatomy (conjunto 'Anatomy of the Inner Ear' e CC-BY-NC-SA); conferir licenca antes de uso comercial.

Campos esperados que faltam (considerando só o que faz sentido para o tipo — função/latim para todos; origem, inserção e inervação para músculos; 'inerva' para nervos): funcao: 340, inervado_por: 68, insercao: 59, origem: 51, nome_latim: 25, inerva: 17.

## 7. Como a base é mantida

- **Estruturas novas** que entrarem no `manifest.json` aparecem sozinhas ao rodar `python scripts/build_database.py`.
- **Correções/enriquecimento manual** (função, origem, inervação, `revisado: true`...) vão em `data/estruturas_ajustes.json`, por `id`; sobrevivem a cada regeneração.
- **Regras** de região, tipo, relevância para fono e dificuldade estão em `data/regras_base_dados.json` — todas são palpites automáticos e valem `revisado: false`.
