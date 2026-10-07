# Fase 0.3 — Inventário de licenças

Fontes: texto "1.Licence" embutido no próprio `Startup.blend`, README do repositório Z-Anatomy (GitHub, `Z-Anatomy/Models-of-human-anatomy`), `data/photos/ATTRIBUTIONS.md` e o código do projeto. **Não sou advogado**: isto é um levantamento técnico, não parecer jurídico.

Legenda: 🟢 uso comercial permitido (com as condições) · 🟡 atenção / falta fazer algo · 🔴 não-comercial (NC) ou sem licença declarada

## 1. Resumo (o que importa decidir)

1. 🔴 **"Brainder" e "White matter" (Universidade de Washington): licença NÃO especificada.** O Z-Anatomy diz ter usado esses modelos "como referência / incluídos e adaptados". Provavelmente originam os giros e sulcos corticais da categoria "Cérebro" (112 dos 181 objetos têm giro/sulco/lóbulo/polo no nome; alguns são ramos arteriais nomeados por sulco, então o número real é menor), mas **o `.blend` não registra a origem por objeto**, então não dá para provar. Sem licença escrita, o uso comercial é arriscado.
2. 🔴 **Dois conjuntos NC** vêm empacotados no Z-Anatomy: "Anatomy of the Inner Ear" (Univ. Dundee, **CC-BY-NC-SA 4.0**) e "Kidney" (Lissie Cowley, **CC-BY-NC 4.0**). **Nenhuma malha exportada pertence às coleções de ouvido interno ou rim** (conferido por coleção e por nome). **Correção (Fase 1):** 4 dos 36 marcadores ósseos — os canais semicirculares anterior/lateral/posterior e o canal espiral da cóclea — são esferas que nós criamos, mas posicionadas em âncoras que ficam dentro das coleções "Vestibule"/"Cochlea" do Z-Anatomy, a área do conjunto NC. Não dá para afirmar de onde vêm as coordenadas dessas âncoras, então estão marcados com `aviso_licenca` na base de dados e valem ser removidos ou confirmados antes de qualquer uso comercial. O risco futuro permanece para cóclea, labirinto, tímpano e ossículos (item de prioridade média na auditoria).
3. 🟡 **Atribuição da Wikipédia incompleta.** Cada descrição do `.blend` termina com o link da página original da Wikipédia, e o README do Z-Anatomy pede que esse link acompanhe a definição. Nosso script corta esse trecho, então hoje só há um crédito geral no rodapé. Dá para corrigir guardando a URL de cada estrutura.
4. 🟡 **Terminologia Anatômica (TA2):** o `TA2.csv` não traz cabeçalho de licença e não consegui abrir o site da FIPAT (editora da TA2) para conferir os termos. A tradução para português é de Ana Teresa Bigio (distribuída pelo Z-Anatomy sob CC BY-SA 4.0). Status da TA2 original: **não verificado**.
5. 🟡 **O repositório não tem arquivo `LICENSE`** nem para o código do app. Os dados 3D e textos exigem CC BY-SA (ShareAlike); o código pode ter outra licença, mas isso precisa ser decidido por você.
6. 🟡 **O app depende de CDN** (Three.js via jsdelivr). Para o PWA offline (Fase 3) isso precisa ser empacotado — não é problema de licença (MIT), mas de funcionamento offline.

Nada **NC** está sendo distribuído hoje. O ponto sensível para a futura cobrança é o item 1.

## 2. Tabela por fonte

| Fonte | O que usamos | Licença | Comercial? | Condições principais | Situação no app |
|---|---|---|---|---|---|
| **BodyParts3D** — The Database Center for Life Science (DBCLS) | A maior parte das malhas (ossos, músculos, órgãos...) | CC BY-SA 2.1 Japan | 🟢 sim | Atribuir exatamente: *"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan"*; distribuir derivados sob a mesma licença | 🟡 Rodapé cita DBCLS/CC BY-SA 2.1, mas não usa o texto exato nem "mixed and modified by Z-anatomy.com" |
| **Z-Anatomy** (Kervyn, Zielinski e colaboradores) | Reparo/organização/nomes das malhas, `Startup.blend` | CC BY-SA 4.0 | 🟢 sim | Atribuição + ShareAlike | 🟢 Citado no rodapé |
| **Cranial Nerves and Foramina** — Univ. Dundee (CAHID) | Nervos cranianos (curvas) e a base dos marcadores de forames | CC BY 4.0 | 🟢 sim | Atribuição | 🟢 Citado no rodapé |
| **"Brainder" e "White matter"** — Univ. of Washington | Provável origem do córtex (giros/sulcos) — não comprovado | **não especificada** | 🔴 incerto | — | 🔴 Em uso (categoria Cérebro) sem licença identificável |
| **Anatomy of the Inner Ear** — Univ. Dundee | Nenhuma malha exportada; 4 marcadores (canais semicirculares, canal espiral da cóclea) ficam em âncoras dessa área | CC-BY-NC-SA 4.0 | 🔴 **não** | — | 🟡 Malhas excluídas; os 4 marcadores têm `aviso_licenca` |
| **Dicionário da Académie nationale de médecine** (França) | 1 descrição ("Groove for marginal sinus"): o texto-fonte do `.blend` cita este site, não a Wikipédia | licença não verificada | 🟡 a confirmar | — | 🟡 Marcada com `aviso_licenca` na base |
| **Kidney** — Lissie Cowley | Nenhum (rim fora do escopo) | CC-BY-NC 4.0 | 🔴 **não** | — | 🟢 Excluído |
| **Descrições em inglês** (blocos de texto do `.blend`, 329 estruturas) | Texto base das descrições | Wikipédia, CC BY-SA 3.0 | 🟢 sim | Atribuir **com link da página de origem**; ShareAlike | 🟡 Link por estrutura não é exibido |
| **Traduções para português** das descrições (474 textos) | Texto exibido no painel | Obra derivada da Wikipédia → CC BY-SA | 🟢 sim | Mesmas condições da fonte; indicar que é adaptação/tradução | 🟡 Traduzido por IA (Claude), **sem revisão humana**; rodapé já diz "adaptadas e traduzidas" |
| **Textos de "conhecimento geral"** (44 estruturas sem artigo) | Descrição quando não há texto-fonte | Escritos para este projeto (sem fonte externa) | 🟢 | Sinalizados no app; **não revisados por especialista** | 🟡 Conteúdo médico sem revisão |
| **Descrições dos 36 marcadores ósseos** (forames/suturas) | Texto dos marcadores | Escritos para este projeto, a partir de conhecimento geral | 🟢 | Idem | 🟡 Sem revisão |
| **Terminologia Anatomica 2 (TA2)** — nomes em latim/inglês | `data/TA2.csv` (copiado do Z-Anatomy) | Status da TA2/FIPAT **não verificado**; arquivo redistribuído sob CC BY-SA 4.0 pelo Z-Anatomy | 🟡 a confirmar | — | 🟡 Pendente de conferência |
| **Tradução PT da TA2** — Ana Teresa Bigio | Nomes em português de ~97% das estruturas | CC BY-SA 4.0 (via Z-Anatomy) | 🟢 sim | Atribuição à autora | 🟢 Citada no rodapé |
| **Fotos explicativas** (12 arquivos, 15 estruturas) — Wikimedia Commons | Imagem no painel | 8 de domínio público (Gray's 1918, Grant's 1962, NCI); 3 CC BY-SA (2.5, 3.0, 4.0); 1 CC BY 2.5 | 🟢 sim | Crédito ao autor; BY-SA exige mesma licença em versões modificadas | 🟢 Lista completa em `data/photos/ATTRIBUTIONS.md`; **nenhuma NC** |
| **Marcadores sintéticos** (36 esferas) | Posição derivada dos objetos-"gancho" do Z-Anatomy | Derivado de CC BY-SA 4.0 | 🟢 | ShareAlike | 🟢 |
| **Three.js r160** + OrbitControls/GLTFLoader | Renderização 3D (via CDN jsdelivr) | MIT | 🟢 | Manter aviso de copyright | 🟡 Aviso não aparece no app; precisa empacotar p/ offline |
| **Blender 5.1** | Só ferramenta de exportação; não distribuímos Blender | GPL (saída dos arquivos não é GPL) | 🟢 | — | 🟢 |
| **Código do app** (`web/`, `scripts/`) | Autoria do projeto | **sem arquivo LICENSE** | — | — | 🟡 Definir licença |

## 3. O que isso significa para a cobrança futura

- **CC BY-SA permite uso comercial**, inclusive cobrar pelo acesso ao app. O que ela exige: crédito às fontes e que os **dados derivados (as malhas `.glb`, os textos e as traduções) continuem sob CC BY-SA** — ou seja, quem tiver acesso pode copiá-los e redistribuí-los. A tela de senha (Fase 4) é só barreira casual; ela não muda isso.
- O que pode impedir ou complicar a cobrança é o item 🔴 do Brainder/White matter (licença não declarada) e qualquer entrada futura do ouvido interno (NC).
- Sugestões (não implementadas, aguardam seu OK):
  1. Contatar a Univ. de Washington / autores do Z-Anatomy para esclarecer a origem e licença do córtex; ou substituir o córtex por malhas do BodyParts3D, ou removê-lo da versão paga.
  2. Criar tela "Sobre / Créditos" com os textos de atribuição exatos (Fase 2 ou 3) e link da Wikipédia por estrutura (campo `fonte_url` na base da Fase 1).
  3. Adicionar `LICENSE`/`NOTICE` ao repositório.
  4. Revisão humana (fonoaudióloga/professor) dos textos antes de qualquer versão paga — marcador `revisado` na Fase 1.
