# Anatomia 3D — Cabeça e Pescoço (Fonoaudiologia)

Ferramenta de estudo de anatomia 3D em português, cobrindo cabeça e pescoço por
completo: cérebro, ossos do crânio, vértebras cervicais, músculos do pescoço
(incluindo suboccipitais, supra/infra-hióideos, mastigação, faciais/expressão e
extraoculares), laringe/pregas vocais, cavidade oral e língua, faringe, ATM,
cartilagens da orelha e do nariz, marcos ósseos (forames, canais, suturas), os
11 nervos cranianos do currículo de Fonoaudiologia (I–V, VII, IX–XII) e regiões
de superfície (o mais próximo que o dataset fonte tem de "pele", que não existe
como malha separada).

## Como rodar

```bash
python anatomia-fono-3d/scripts/dev_server.py 8080
```

Depois abra `http://localhost:8080/web/index.html` no navegador.

`dev_server.py` é um servidor simples igual ao `python -m http.server`, mas manda
`Cache-Control: no-store` — assim o navegador nunca mostra uma versão antiga do
JavaScript depois de uma alteração (o `http.server` comum deixa o navegador
guardar o `main.js` em cache). O `python -m http.server 8080 --directory
anatomia-fono-3d` continua funcionando, só que pode exigir Ctrl+Shift+R.

(O `.claude/launch.json` do projeto pai já tem essa configuração pronta como
"anatomia-fono-3d" para quem estiver usando o Claude Code / Claude Desktop.)

Relatórios de auditoria (cobertura do dataset e licenças): pasta `docs/fase-0/`.

## Como abrir no celular

A interface já é responsiva (barra lateral vira uma gaveta, painel de detalhes
ocupa a tela toda, toque longo numa peça abre o mesmo menu do botão direito).
Faltam só decidir **como o celular alcança o app**:

**Opção A — GitHub Pages (recomendado, funciona de qualquer lugar, sem PC ligado)**

O repositório é público, então é só ativar uma vez:
1. No GitHub, abra o repositório → **Settings → Pages**.
2. Em "Build and deployment" → Source, escolha **Deploy from a branch**.
3. Branch: **main**, pasta: **/ (root)** → Save.
4. Em 1-2 minutos o site fica disponível em
   `https://gubertbrunoalexandre-cloud.github.io/Anatomia-3D/`
   (o repositório foi renomeado de `Anatomia-fono-3D` para `Anatomia-3D`)
   (a página raiz redireciona automaticamente pra `web/index.html`).

Depois disso, qualquer atualização enviada (`git push`) pro branch `main`
atualiza o site automaticamente — não precisa repetir esse processo.

**Opção B — Mesma rede Wi-Fi (só funciona com o PC ligado e o servidor rodando)**

1. Descubra o IP local do PC (`ipconfig` no Windows, procure "Endereço IPv4").
2. Rode o servidor normalmente (`python -m http.server 8080 --directory anatomia-fono-3d`).
3. No celular, na mesma rede Wi-Fi, abra `http://<IP-DO-PC>:8080/web/index.html`.
4. Pode precisar liberar a porta 8080 no firewall do Windows na primeira vez.

## Estrutura do projeto

```
anatomia-fono-3d/
├── data/
│   ├── blender_source/Startup.blend        # fonte original do Z-Anatomy (306 MB, nao versionar)
│   ├── TA2.csv                              # Terminologia Anatomica multi-idioma (Z-Anatomy)
│   ├── descriptions_pt_overrides.json       # traducoes PT-BR (persiste entre reexportacoes)
│   ├── descriptions_fallback.json           # textos de conhecimento geral p/ estruturas sem artigo
│   ├── photos.json                          # config de fotos por estrutura (ver abaixo)
│   ├── photos/                              # arquivos de imagem referenciados por photos.json
│   ├── nomes_pt_ajustes.json                # nomes em portugues do Brasil que substituem ingles/latim da TA2
│   ├── explicacoes/                         # explicacoes completas por estrutura (escritas por IA, conferidas com referencias)
│   └── glb/                                 # modelos exportados (26 arquivos .glb + manifest.json)
├── docs/fase-0/                             # auditoria de cobertura e inventário de licenças
├── scripts/
│   ├── export_head_neck.py                  # script headless do Blender que gera os .glb
│   ├── audit_head_neck.py                   # auditoria (somente leitura) dataset x app
│   ├── extract_source_meta.py               # Blender: sistema/coleções e links da Wikipédia -> data/source_meta.json
│   ├── build_database.py                    # gera data/estruturas.json (base do jogo) e docs/fase-1/
│   └── dev_server.py                        # servidor local sem cache
├── web/
│   ├── index.html
│   ├── css/game.css                         # estilos do modo jogo
│   ├── js/main.js                           # visualizador Three.js
│   ├── js/game.js                           # modo jogo: telas, 3D, progresso
│   ├── js/game-core.js                      # modo jogo: perguntas, Leitner, pontos (logica pura)
│   └── tests/                               # testes do motor do jogo (abrir no navegador)
└── README.md
```

## Categorias exportadas (26)

Laringe e pregas vocais · Cavidade oral e língua · Faringe · ATM · Nervos
cranianos I, II, III, IV, V, VII, IX, X, XI, XII (cada um sua própria categoria)
· Cérebro · Ossos do crânio · Vértebras cervicais · Músculos do pescoço ·
Músculos suboccipitais · Músculos supra/infra-hióideos · Músculos da
mastigação · Músculos faciais (expressão) · Músculos extraoculares · Regiões
de superfície · Cartilagens da orelha e nariz · Marcos ósseos (forames,
canais, suturas).

375 estruturas únicas (nome+descrição), ~25,8 MB no total (carregados sob
demanda por categoria, não tudo de uma vez). **100% das 375 estruturas têm
descrição em português** (real ou de conhecimento geral, ver seção de
descrições abaixo).

## Funcionalidades do visualizador

- **Seleção visual na própria malha**: clicar numa peça (no 3D, na lista ou
  pelo menu de contexto) troca o material dela por um destaque azul emissivo —
  não desenha caixa delimitadora ao redor. Volta ao material normal ao
  desselecionar.
- **A lista lateral acompanha a seleção**: ao selecionar uma peça no modelo
  3D, a categoria correspondente abre sozinha na lista e rola até o item
  destacado — não precisa caçar peça por peça na árvore lateral.
- **Menu de contexto (botão direito, ou toque longo no celular)**: clicar com
  o botão direito (ou manter o dedo pressionado ~0,5s) numa peça do modelo 3D
  abre um menu com Selecionar, Ocultar, Isolar, Mostrar tudo e Pesquisar sobre
  a estrutura — sem precisar ir até a barra de ferramentas ou a lista lateral.
- **Responsivo para celular**: em telas estreitas a lista lateral vira uma
  gaveta (botão ☰ no canto superior esquerdo) que fecha sozinha ao selecionar
  uma peça, e o painel de detalhes ocupa a tela toda. Controles de câmera por
  toque (um dedo gira, dois dedos afasta/aproxima) já vêm prontos do Three.js.
- **Ocultar/mostrar peças individualmente**: cada item da lista lateral tem um
  ícone de olho (👁 / 🚫) que alterna a visibilidade daquela malha específica
  sem descarregá-la da cena. "Mostrar tudo", "Isolar selecionada" e o menu de
  contexto sincronizam esses ícones.
- **Painel de informação**: nome em português (Terminologia Anatomica) com o
  nome em inglês e em latim como referência, **explicação completa** (o que é,
  onde fica, para que serve), função, origem, inserção, inervação, o que a
  estrutura inerva e **"Na fonoaudiologia"** (por que importa para a clínica),
  seguidos da descrição original da Wikipédia, foto ilustrativa (15
  estruturas já têm — ver "Fotos explicativas" abaixo — as demais mostram um
  placeholder) e um botão que abre uma busca do Google (`nome + anatomia
  função`) em nova aba. As explicações vêm de `data/explicacoes/`, são escritas
  por IA, **conferidas com referências abertas** (StatPearls/NIH, Kenhub, SciELO —
  lista em "Referências consultadas" no próprio painel) e ainda **não revisadas por um
  especialista** — o painel avisa. Detalhes da conferência: `docs/fase-2/conferencia-explicacoes.md`.
- **⌖ Centralizar peça**: botão na barra de ferramentas e no painel de detalhes.
  Com uma peça selecionada, aproxima a câmera dela; sem seleção, enquadra tudo o
  que está visível. Em tela de celular o enquadramento afasta a câmera para não
  cortar as laterais.
- **👁 Ver através**: desenha a peça selecionada por cima das outras (útil para
  músculos e cartilagens que ficam atrás de outras estruturas). Clique de novo
  para voltar ao normal.
- **Busca** por nome (português ou inglês) na lista lateral.
- **Tudo em português do Brasil:** nomes, descrições, explicações, perguntas e botões. Nomes que
  vieram em inglês ou latim da fonte foram trocados (`data/nomes_pt_ajustes.json`, aplicado pelo
  `build_database.py` e pelo exportador); o inglês e o latim aparecem só como referência
  ("inglês: … · latim: …") sob o título. As imagens ilustrativas cujos rótulos estão em inglês
  trazem uma **legenda em português** (`_legendas_pt` em `data/photos.json`).
- **Marcos ósseos como pinos clicáveis**: forames, canais e suturas do crânio
  não têm malha própria no dataset fonte (ver seção dedicada abaixo) — são
  representados como pequenas esferas laranja posicionadas exatamente no
  ponto anatômico correto, clicáveis como qualquer outra peça.
- **Alfinetes de anotação livre (📌)**: para fissuras, canais e outros pontos
  que nem têm um marco pré-cadastrado, dá pra cravar um alfinete em qualquer
  lugar da superfície do modelo — clique com o botão direito (ou toque longo)
  na peça desejada e escolha "Colocar alfinete aqui". O alfinete mostra as
  informações da peça em que foi colocado (nome, categoria, descrição), pode
  ser arrastado para reposicionar (botão esquerdo do mouse, arrastar) e vários
  podem coexistir ao mesmo tempo. O alfinete selecionado fica amarelo, os
  demais ficam magenta; clicar num alfinete o seleciona e mostra suas
  informações (com o selo "📌 Via alfinete" no painel). Dois botões cuidam da
  limpeza: "🗑 Remover este alfinete" (no painel de detalhes, remove só o
  selecionado) e "📌 Remover alfinetes" (na barra de ferramentas, remove
  todos de uma vez).

## Fotos explicativas

15 estruturas já têm foto (via Wikimedia Commons, domínio público ou CC
BY/CC BY-SA compatível — ver `data/photos/ATTRIBUTIONS.md` para fonte, autor
e licença de cada uma): cartilagem tireoide, cricoide, aritenoide, epiglote,
língua, faringe (+ oro/naso/laringofaringe), palato mole, disco articular da
ATM, e os nervos trigêmeo, facial, vago e hipoglosso. As demais ~360
estruturas mostram o placeholder "foto em breve".

**Como adicionar mais fotos** (sem precisar mexer em nenhum código):

1. Coloque o arquivo de imagem (jpg/png/webp/svg) em `data/photos/`.
2. Abra `data/photos.json` e adicione uma linha:
   `"nome da estrutura em ingles": "nome-do-arquivo.jpg"`
   (o nome-chave é normalizado automaticamente — minúsculas, sem pontuação —
   então não precisa se preocupar com maiúsculas/acentos exatos, mas use o
   nome em inglês que aparece como "(en: ...)" no painel de detalhes).
3. Anote a fonte/autor/licença em `data/photos/ATTRIBUTIONS.md`.
4. Salve e recarregue a página. Se o arquivo não existir ou o nome não bater,
   o placeholder "foto em breve" continua aparecendo — nunca quebra a página.

## Modo jogo (🎮 Jogar)

Botão **🎮 Jogar** na barra de ferramentas (o modo de estudo continua igual). Ao entrar,
a pessoa escolhe **como quer jogar**:

| Modo | Como funciona |
|---|---|
| 🪜 **Fases** | Sobe de nível: cada fase é uma região (ossos do crânio, músculos da mastigação, laringe, língua...) e 1 estrela libera a próxima. |
| 🎯 **Treino por parte** | Escolhe qualquer parte (ossos, músculos, nervos...) e joga sem passar de fase e sem bloqueios. |
| 🎲 **Tudo misturado** | 10 perguntas sorteadas de todos os conteúdos: uma de ossos, outra de nervos, outra de músculos... (sorteio balanceado por região). |

Cada rodada tem 10 perguntas sorteadas da base `data/estruturas.json`, nunca de listas
fixas no código.

**Crânio completo em todas as fases:** como nas provas práticas de sala de aula (o
professor entrega o crânio inteiro e pergunta sobre cada parte), o crânio aparece
inteiro em todas as fases — sólido na fase de ossos e, nas demais, como um crânio
translúcido de contexto onde a região da fase se destaca. Botões do jogo:
**💀 Crânio sólido / transparente / oculto** (alterna a cada toque), **⌖ Crânio inteiro** e
**🔍 Só a região**.

**Jogadores e ranking (sem servidor):** vários jogadores no mesmo aparelho, cada um com
seu progresso (**👤 trocar**). O **🏆 Ranking** soma os jogadores do aparelho e os
**cartões de pontuação** dos colegas (cada um gera o seu em *Ranking → 📤 Compartilhar
meu cartão de pontuação*, e os demais usam *📥 Importar cartão de colega*). Não há verificação — depende da honestidade de quem gera o
cartão. Esta versão serve para **testar a ideia**; o plano é ligar o ranking a um banco
online (Supabase).

*Ponto de encaixe para o Supabase:* toda a tela de ranking lê `rankingEntries()` em
`web/js/game.js` (hoje: jogadores do aparelho + cartões importados). Para o ranking online,
essa função passaria a buscar as linhas da tabela remota, e `shareCard` passaria a gravar
a pontuação nela. Sugestão de tabela `placar` (um registro por jogador): `id` (uuid),
`nome` (apelido, máx. 24), `pontos`, `estrelas`, `respostas`, `acertos`,
`melhor_sequencia`, `melhor_rodada`, `atualizado_em`. Cuidados a decidir antes: políticas
RLS (leitura pública, escrita só do próprio registro), pontuação calculada/validada no
servidor para evitar forjar (a chave `anon` do navegador é pública), e privacidade/LGPD
(usar apelido em vez do nome real e permitir apagar o registro).

Tipos de pergunta:

- **Encontre a estrutura** — aparece um nome e você toca na peça no 3D (toque de novo no
  mesmo ponto para alternar entre peças sobrepostas; botão direito/toque longo oculta a
  peça da frente; **💡 Dica** aproxima a câmera, mas vale metade dos pontos).
- **Que estrutura é esta?** — a peça aparece destacada em azul (mesmo atrás de outras)
  e você escolhe entre 4 nomes.
- **Função, origem, inserção e inervação** — múltipla escolha, só onde a base tem texto
  curado (112 estruturas; textos escritos por IA, `revisado: false`).
- Depois de cada resposta: certo/errado, explicação curta, a peça certa em verde no 3D e
  um bloco **Explicação completa** (com "Na fonoaudiologia") para aprofundar.
- **Pontos e estrelas:** 100/125/150 por pergunta (dificuldade 1/2/3) + bônus de
  sequência; ≥50% = 1 estrela, ≥70% = 2, ≥90% = 3. Uma estrela libera a próxima fase.
- **Revisão espaçada (Leitner):** quem erra volta na rodada seguinte; acertos espaçam o
  retorno (1, 2, 4, 8, 16 rodadas). O botão **Revisar meus erros** junta só os pendentes.
- **Progresso** salvo no navegador (`localStorage`), com exportar/importar arquivo JSON
  (📊 Progresso e backup) para trocar de aparelho.
- **🎯 Região isolada** mostra só as peças da fase; **↺ Mostrar tudo** reexibe o que você ocultou.

Testes do motor (rodam no navegador): abra `web/tests/game-core.test.html`.

## Base de dados única (`data/estruturas.json`)

Uma linha por estrutura (375, esquerdo/direito juntos), gerada a partir do que o
projeto já tem. É a fonte que o modo jogo lê — nunca há listas de perguntas fixas no código.
Campos: `id`, `nome_pt`, `nome_en`, `nome_latim`, `tipo`, `sistema`, `regiao`,
`descricao`, `funcao`, `relacoes` (origem/inserção/inervação, só quando a descrição
traz), `relevancia_fono`, `dificuldade` (1–3), `revisado` (sempre `false` até uma
pessoa conferir), `objetos` (as malhas do app) e `fontes` (de onde veio cada campo,
inclusive o link da Wikipédia).

```bash
python scripts/build_database.py      # regenera data/estruturas.json + docs/fase-1/
```

- Estruturas novas no `manifest.json` entram sozinhas (rode antes
  `scripts/extract_source_meta.py` no Blender se vierem do `.blend`).
- Correções manuais por estrutura: `data/estruturas_ajustes.json` (sobrevivem à regeneração).
- Explicações completas: `data/explicacoes/*.json` (`{"explicacoes": {"<id>": {"explicacao": "...",
  "fono": "..."}}}`). Todas as 375 estruturas têm explicação; `fono` existe onde faz sentido
  para a clínica. Escritas por IA a partir de anatomia de livro-texto e **conferidas com
  referências** (`data/explicacoes/_referencias.json`: fontes por região e por estrutura;
  `fontes.explicacao = "ia_conferida_com_referencias"` e campo `referencias` na base).
  **Peça revisão de um especialista antes de usar como material oficial:** quem revisar
  acrescenta `"revisado_por": "Nome, registro"` na estrutura e roda o `build_database.py`
  — o painel passa a mostrar a revisão no lugar do aviso de IA (passo a passo em
  `docs/fase-2/conferencia-explicacoes.md`). Um `id` ou fonte inexistente é apontado pelo
  `build_database.py`.
- Regras de região, tipo, relevância para fono e dificuldade: `data/regras_base_dados.json`.
- Relatório com contagens e campos vazios: `docs/fase-1/`.

## Pipeline de dados

1. Fonte: [Z-Anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) —
   atlas 3D de anatomia humana de código aberto, construído sobre o BodyParts3D
   e enriquecido com o conjunto "Cranial Nerves and Foramina" da University of
   Dundee (CAHID). Tudo vive num único arquivo `Startup.blend` (306 MB, ~7.184
   objetos no total).
2. `scripts/export_head_neck.py` roda dentro do Blender (headless) e:
   - Identifica os objetos relevantes por categoria via palavras-chave no nome.
   - Descarta objetos sem geometria real (`has_real_geometry`) — o Z-Anatomy usa
     objetos-"gancho" de 2 vértices/0 faces (sufixo `.j`) só para ancorar rótulos
     de texto flutuante; sem esse filtro eles entram na lista mas o exportador
     glTF os descarta silenciosamente (a estrutura "sumia" sem explicação).
   - Converte nervos/vasos (objetos do tipo `CURVE`) para malha antes de exportar,
     já que glTF não suporta curvas nativamente. Cada curva é convertida **uma
     única vez** (não por categoria) via um lookup compartilhado, para não
     desperdiçar trabalho quando a mesma estrutura aparece em mais de uma
     categoria (ex.: nervo glossofaríngeo em "faringe" e em sua própria categoria).
   - Remove o parentesco de cada objeto antes de exportar (mantendo a posição no
     mundo via matriz), e esconde **todos** os objetos já preparados antes de
     tornar visível só o subconjunto da categoria atual. Sem isso, o exportador
     glTF em modo `--background` parecia usar a visibilidade acumulada da cena
     como escopo real de exportação (mais do que a seleção em si) — cada
     categoria ia "vazando" objetos de todas as anteriores, crescendo
     categoria após categoria até a última sair com quase tudo dentro.
   - Grava o nome original de cada objeto como propriedade customizada
     (`orig_name`) antes de exportar, porque o exportador glTF do Blender
     sanitiza nomes (troca espaço por `_`, remove `.`) — o app web lê essa
     propriedade via `extras` para recuperar o nome real.
   - Traduz o nome de cada estrutura para português via `data/TA2.csv`
     (Terminologia Anatomica oficial, tradução de Ana Teresa Bigio para o
     Z-Anatomy) — cobertura de ~97% dos nomes do dataset inteiro.
   - Extrai descrições anatômicas dos blocos de texto internos do `.blend`
     (`bpy.data.texts`, um artigo por estrutura, derivado da Wikipédia) e grava
     tudo em `manifest.json` como `descriptions_en`.
   - Cria pequenas esferas-marcador (`create_landmark_markers`) na posição
     exata dos ~36 forames/canais/suturas do crânio e da coluna cervical
     confirmados no dataset fonte, já que esses "buracos" e juntas ósseas não
     têm malha própria (ver seção dedicada abaixo) — e as injeta no pipeline
     normal como se fossem objetos comuns.
   - Exporta um `.glb` por categoria.
   - No final, **mescla automaticamente** `data/descriptions_pt_overrides.json`
     (traduções PT-BR reais) e `data/descriptions_fallback.json` (textos de
     conhecimento geral para estruturas sem artigo-fonte) para dentro do
     `manifest.json`, como `descriptions_pt` e `descriptions_fallback`. Esses
     dois arquivos **não são gerados pelo script** — são mantidos à parte
     justamente para sobreviver a reexportações sem precisar retraduzir nada.
     O app usa `descriptions_pt` primeiro, cai para `descriptions_fallback`
     (mostrando um aviso de "baseado em conhecimento geral"), e só usa
     `descriptions_en` como último recurso, se alguma estrutura nova for
     adicionada e ainda não tiver sido traduzida.

Para regerar os `.glb` depois de qualquer ajuste no script (as traduções
existentes são preservadas automaticamente):

```bash
"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background ^
  "data\blender_source\Startup.blend" --python "scripts\export_head_neck.py"
```

Se novas categorias/estruturas forem adicionadas, suas descrições só existirão
em `descriptions_en` até alguém traduzir e adicionar a chave correspondente
(nome normalizado: minúsculo, sem acentos/pontuação) em
`descriptions_pt_overrides.json` ou `descriptions_fallback.json`.

## Licenciamento e atribuição (obrigatório manter visível no app)

- **BodyParts3D** — Database Center for Life Science (DBCLS), CC BY-SA 2.1 Japan.
- **Z-Anatomy** — CC BY-SA 4.0.
- **Cranial Nerves and Foramina** — University of Dundee, CAHID, CC-BY 4.0.
- **Terminologia em português** — tradução de Ana Teresa Bigio para o Z-Anatomy.
- **Descrições textuais** — adaptadas da Wikipédia (CC BY-SA 3.0) e traduzidas
  para português; um pequeno conjunto (44 estruturas) usa texto de conhecimento
  anatômico geral escrito para este projeto, sinalizado como tal no app.
- **Fotos explicativas** — Wikimedia Commons, domínio público (a maioria,
  Gray's Anatomy 1918 e Grant's Atlas 1962) ou CC BY/CC BY-SA (ver
  `data/photos/ATTRIBUTIONS.md` para a lista completa, imagem por imagem).

Uso comercial é permitido em todas essas licenças, desde que a atribuição seja
mantida e qualquer obra derivada continue sob licença compatível (ShareAlike).

**Atenção**: dois conjuntos específicos empacotados dentro do Z-Anatomy são
**não-comerciais** e foram deliberadamente **excluídos** deste subconjunto:
"Anatomy of the Inner Ear" (Univ. Dundee, CC-BY-NC-SA 4.0) e "Kidney" (Lissie
Cowley, CC-BY-NC 4.0). Se o escopo do app um dia incluir ouvido interno, essas
peças precisam ser substituídas por outra fonte compatível com uso comercial.

## Cartilagens de orelha, nariz e olho — investigação

Verificado diretamente no dataset fonte (não só no recorte já exportado):

- **Orelha**: existe cartilagem real (não placeholder) para hélice, anti-hélice,
  crura da anti-hélice, trago e antitrago, com contagem de polígonos consistente
  com geometria de verdade (39 a 466 faces cada). Incluídas na categoria
  "Cartilagens da orelha e nariz", junto com pontos de referência de superfície
  do mesmo complexo cartilaginoso (concha, cymba conchae, eminência da concha,
  lóbulo da aurícula).
- **Nariz**: existe cartilagem septal nasal, cartilagem alar maior e processo
  lateral da cartilagem septal nasal, todas com geometria real (344–360 faces).
  Também incluídas.
- **Olho**: **não existe cartilagem** no dataset, e isso é anatomicamente
  correto — a estrutura de sustentação da pálpebra (por vezes chamada de forma
  imprecisa de "cartilagem tarsal") é na verdade tecido conjuntivo fibroso
  denso, não cartilagem hialina/elástica. A ausência não é uma lacuna do
  dataset, é a anatomia real. Nenhuma estrutura foi forçada nesse ponto.

## Fissuras, canais, forames e suturas do crânio — investigação

Verificado diretamente no dataset fonte, antes de tentar incluir: **quase
nenhum forame, canal ou sutura nomeada do crânio tem malha 3D própria**. Isso
faz sentido anatomicamente — um forame é ausência de osso, não um volume — mas
o dataset nem chega a modelar a superfície ao redor do buraco: cada um existe
só como um objeto "gancho" de 2 vértices e 0 faces, usado internamente pelo
Z-Anatomy para ancorar um rótulo de texto flutuante.

Busquei no `.blend` inteiro por todo objeto com "foramen/canal/fissure/
suture/meatus/notch/aperture/groove/incisure/hiatus" no nome: **135
correspondências no corpo todo, e nenhuma com geometria real** nos itens
específicos do crânio/pescoço (as poucas exceções com malha de verdade, como
incisuras da aurícula, já estavam nas categorias de orelha/superfície).
Também não existem no dataset como objeto algum — nem gancho, nem malha —
vários marcos muito conhecidos: forame jugular, forame lácero, forame
mandibular, forame supraorbital/infraorbital, meato acústico externo/interno,
e as suturas coronal/sagital/lambdóidea por nome próprio (só existem 4
entradas genéricas descrevendo *tipos* de sutura: denteada, plana, serreada,
limbosa).

**Solução adotada**: para os 36 marcos que existem no dataset (mesmo sem
malha, incluindo canal da artéria vertebral, forame transverso, faceta do
dente do áxis e sulco do nervo espinhal nas vértebras cervicais), criei uma
pequena esfera-marcador exatamente na posição 3D do ponto de ancoragem
original e a tratei como uma peça normal no pipeline — aparece como um pino
laranja clicável no modelo, com nome e descrição. Estão na categoria "Marcos
ósseos". Para os que **não existem em lugar nenhum do dataset** (forame
jugular, meato acústico etc.), não há posição 3D de referência alguma para
ancorar um marcador — para esses casos (ou qualquer outra fissura/canal sem
marco pré-cadastrado), use o **alfinete de anotação livre (📌)** descrito
acima, que pode ser posicionado em qualquer ponto da superfície do modelo.

## Limitações conhecidas / próximos passos

- **Não existe malha de pele/integumento** no dataset fonte (BodyParts3D nunca
  modelou isso — é um atlas de ossos/músculos/órgãos, não de anatomia de
  superfície). A categoria "Regiões de superfície" usa as subdivisões
  topográficas oficiais da cabeça/pescoço (região frontal, região parotídea,
  triângulo carotídeo etc.) como o substituto mais próximo disponível.
- **Cores por tipo de tecido são heurísticas** (definidas em `main.js` via regex
  no nome da estrutura: nervo=amarelo, músculo=vermelho, cartilagem=cinza-azulado,
  etc.), não a paleta original do Z-Anatomy — o material original do Blender usa
  um shader customizado que não é traduzido corretamente pelo exportador glTF
  padrão (veio com `emissive` branco puro, estourando tudo pra branco).
- **Malhas de nervos são relativamente pesadas** (curvas com bevel convertidas
  para malha) — pode valer a pena decimar no Blender se a performance em
  dispositivos mais fracos for um problema.
- Nervos cranianos VI (abducente) e VIII (vestibulococlear) existem no dataset
  fonte mas não foram incluídos por não estarem no escopo original — fácil de
  adicionar depois (bastaria uma nova categoria em `CATEGORIES` no script de
  exportação, seguindo o mesmo padrão dos outros nervos).
- O modo jogo já existe (ver acima). Ainda **não** há modo offline/PWA nem tela de senha;
  o ranking é local (cartões de pontuação), sem servidor.
- Só 15 das ~375 estruturas têm foto ilustrativa por enquanto (ver seção
  "Fotos explicativas" acima) — as demais mostram o placeholder.
