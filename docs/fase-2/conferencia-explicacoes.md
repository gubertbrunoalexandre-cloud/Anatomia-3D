# Conferência das explicações com referências online

As 375 explicações (`data/explicacoes/*.json`) foram escritas por IA a partir de anatomia de
livro-texto. Em seguida foram **conferidas com fontes abertas e reconhecidas** (esta página).
**Isso não substitui a revisão de uma pessoa da área** — veja "Como revisar" no fim.

## Método

1. Para cada região (crânio, laringe, boca, faringe, nervos, músculos, vértebras, orelha,
   encéfalo...), busquei artigos de referência e li as páginas.
2. Comparei as afirmações das explicações (origem, inserção, inervação, função, relações)
   com o texto das fontes, afirmação por afirmação nos pontos de maior risco.
3. Onde uma fonte contradizia o texto, corrigi (ou reescrevi deixando claro que as fontes
   divergem). Onde nenhuma fonte tratava o detalhe, mantive o texto padrão de livro-texto.
4. Registrei, por estrutura, as fontes consultadas (`data/explicacoes/_referencias.json`).
   O painel de cada peça lista as "Referências consultadas" com link.

## Fontes consultadas

| Tipo | Fontes |
|---|---|
| StatPearls (NCBI/NIH) | laringe (músculos e nervos), língua, faringe, palato, tensor do véu palatino, insuficiência velofaríngea, deglutição, cavidade oral, ATM, músculos da mastigação, glândula submandibular, crânio, seios paranasais, cavidade nasal, vértebras cervicais, pescoço, escalenos, nervos cranianos III, XI e VII, corda do tímpano, músculos faciais, músculos extraoculares, suboccipitais, hemisfério cerebral, tronco encefálico, fissura de Sylvius, afasias, artérias cerebrais, síndrome de Wallenberg, artéria meníngea média, foice do cérebro, dura-máter, sistema ventricular, aqueduto, gânglios da base, putame, hipófise, glândula pineal, reflexo oculovestibular, manobra de Dix-Hallpike |
| Kenhub | nervos cranianos, forames do crânio, músculos faciais, nervo facial, músculos suboccipitais, músculos da órbita, áreas da linguagem, esternocleidomastóideo, trapézio, músculos do pescoço, osso hioide, glândulas salivares, faringe, crista de Passavant, ATM, músculos da mastigação, suturas, cóclea, triângulos do pescoço, regiões da cabeça e do pescoço, fórnix |
| Atlas / clássicos | Elsevier Anatomy (músculo tireoepiglótico); Gray's Anatomy 1918 (texto sobre o tireoepiglótico, reprodução da UNSW) |
| Artigos científicos | PMC: embriogênese do lábio e do palato; ligamentos discais da ATM; xerostomia/saliva em repouso |
| Fonoaudiologia (SciELO) | protocolo MBGR de avaliação miofuncional orofacial (Rev CEFAC, 2009); postura, tônus e mobilidade de lábios e língua em respiradores orais (Rev CEFAC); miotomia do cricofaríngeo (Rev Soc Bras Fonoaudiol, 2007) |
| Wikipédia | forame espinhoso; pavilhão auricular |

A lista completa, com título e link de cada uma, está em `data/explicacoes/_referencias.json`.

## O que a conferência mudou (24 textos)

| Estrutura | Antes | O que as fontes mostram | Ajuste |
|---|---|---|---|
| Parte tireoepiglótica do tireoaritenóideo | "auxilia na abertura da entrada da laringe" | Fontes divergem: atlas modernos (Elsevier) dizem que alarga a entrada; o StatPearls a associa ao abaixamento da epiglote; Gray (1918) não diz | Texto cita as duas descrições |
| Filtro labial | "união dos processos nasal medial e maxilares" | Origina-se do segmento intermaxilar (processos nasais mediais), com contribuição dos maxilares nas partes laterais do lábio | Corrigido |
| Glândula submandibular | "grande parte da saliva em repouso" | Cerca de 60–70% (Kenhub: até 70%; revisão PMC: 60–70%); estimativas variam | Número acrescentado, com ressalva |
| Faringe | "12 a 15 cm" | Kenhub: 12–14 cm | Corrigido |
| Constritor inferior | parte cricofaríngea como esfíncter | Algumas fontes (StatPearls) tratam o cricofaríngeo como um músculo à parte | Ressalva acrescentada |
| Cabeça superior do pterigóideo lateral | "insere-se principalmente na cápsula e no disco" | A extensão da inserção no disco varia entre autores | Ressalva acrescentada |
| Canal espiral da cóclea | "duas voltas e três quartos" | Fontes dão 2,5 a 2,75 voltas | "duas voltas e meia a duas e três quartos" |
| Canais semicirculares anterior e posterior | planos/movimentos atribuídos um a um | Os canais verticais ficam a ~45° entre os planos frontal e sagital; os dois respondem a rotações em planos verticais | Texto simplificado e corrigido |
| Trapézio, parte descendente | "até a clavícula e o acrômio" | Inserção no terço lateral da clavícula (Kenhub) | Corrigido |
| Esternocleidomastóideo | só flexão | Bilateral: flexiona o pescoço e estende a cabeça; auxilia a inspiração; inervação acessória + plexo cervical C2–C3 | Acrescentado |
| Mentual | "eleva a pele do queixo" | Enruga a pele do queixo; eleva/protrai o lábio inferior (algumas fontes: everte) | Reescrito |
| Reto superior/inferior, oblíquos | sem torção | Intorsão/extorsão fazem parte das ações; o efeito do oblíquo superior depende da posição do olho | Acrescentado |
| Oblíquo superior | origem no esfenoide | Algumas fontes descrevem a origem no próprio anel tendíneo | Ressalva acrescentada |
| Incisura anterior da orelha | limites afirmados | A literatura descreve limites diferentes (trago–raiz da hélice ou trago–antitrago) | Ressalva acrescentada |
| Suturas límbica e denticulada | exemplos soltos | Límbica = chanfrada (ex.: têmporo-parietal); denteada/serrilhada = nomes variam (sagital) | Alinhado às fontes |
| Língula do cerebelo | "vestibulocerebelo" | Fica no vérmis anterior; as fontes não a atribuem ao vestibulocerebelo | Reescrito |
| Artéria cerebelar posteroinferior | "sua oclusão causa Wallenberg" | Mais comumente a artéria vertebral; a PICA também | Reescrito |
| Ramo meníngeo do nervo maxilar | ambíguo | O ramo meníngeo do mandibular (nervo espinhoso) entra pelo forame espinhoso; o maxilar também emite ramo meníngeo | Esclarecido |
| Orbicular da boca | "pelo nervo facial" | Ramos bucal e marginal mandibular | Detalhado |
| Forame espinhoso | "e o ramo meníngeo" | O ramo meníngeo passa "geralmente" por ele (pode passar pelo forame oval) | Ressalva |

## Pontos em que as próprias fontes divergem (mantive a formulação mais usual)

- **Origem do masseter:** StatPearls descreve a partir do arco zigomático; Gray (1918) e a
  maioria dos textos: processo zigomático da maxila + 2/3 anteriores do arco.
- **Origem do levantador do lábio superior:** margem infraorbital (Gray) × processo zigomático
  da maxila (Kenhub).
- **Ação do mentual:** elevar/protrair o lábio inferior × deprimir/everter (Kenhub).
- **Ligamento lateral da ATM:** espessamento da cápsula (Kenhub) × ligamento do disco
  (estudo histológico PMC).
- **Número de músculos constritores da faringe:** três (clássico) × quatro, contando o
  cricofaríngeo (StatPearls).
- **Origem do oblíquo inferior da cabeça:** processo espinhoso do áxis (StatPearls e textos
  clássicos); a página do Kenhub, na leitura que fiz, indicava outro ponto do áxis.

## Limites desta conferência

- Li as páginas por ferramenta automática e conferi sobretudo origem, inserção, inervação,
  ação e relações. **Não** conferi cada frase de cada uma das 375 estruturas contra uma fonte
  própria; estruturas vasculares pequenas e variações (ramos arteriais, linfonodos) foram
  conferidas pelo conjunto da região.
- Várias páginas do StatPearls estão marcadas "Archived" ou têm inconsistências internas entre
  artigos; usei-as em conjunto com o Kenhub e atlas.
- As notas **"Na fonoaudiologia"** são interpretações clínicas apoiadas em StatPearls
  (deglutição, insuficiência velofaríngea) e em artigos brasileiros (MBGR, cricofaríngeo), mas
  merecem a leitura de quem atua na clínica.
- Gray (1918) foi consultado pela reprodução citada acima (apenas o trecho do tireoepiglótico).

## Como revisar (para a colega fonoaudióloga ou outro especialista)

1. Abra os arquivos de `data/explicacoes/` (um por grupo de regiões).
2. Para cada estrutura revisada, acrescente `"revisado_por": "Nome e registro"`:

   ```json
   "masseter": {"explicacao": "...", "fono": "...", "revisado_por": "Fulana de Tal, CRFa 0-00000"}
   ```

3. Rode `python scripts/build_database.py`. O painel passa a mostrar "Explicação revisada por
   Fulana de Tal" no lugar do aviso de IA, e `fontes.explicacao` vira `revisada_por_pessoa`.
4. Correções de conteúdo: edite o texto no mesmo arquivo e regenere a base.
