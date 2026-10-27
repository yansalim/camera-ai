# Direção visual — "Vire uma obra de arte"

Feita com o tasteskill (`design-taste-frontend`), passos 1 a 5, na Task 11 do plano. A folha completa fica em `site/.taste-skill/direction.json` (reimprimir com `node ~/.claude/skills/design-taste-frontend/scripts/draw.mjs --show`, a partir de `site/`).

## Inventário

O que é deste projeto e de nenhum aplicativo de filtro:

1. **A etiqueta de parede do museu**: título, autor, ano, técnica e número de inventário, ao lado de cada obra. O código da obra (`K7M-3PX`) faz exatamente o papel do número de inventário.
2. **A sala do museu**, com paredes pintadas de cores fundas (vermelho, verde, azul-noite) para a obra se destacar.
3. **A moldura dourada** e a plaqueta de latão que o resultado ganha.
4. **A linha do tempo dos 6 estilos**: Grécia clássica (séc. V a.C.), Botticelli (c. 1485), Mona Lisa (1503–1519), Van Gogh (1889), Munch (1893), cubismo (anos 1910). São 2.400 anos numa tela de celular.
5. **Onde as obras estão**: Louvre (Paris), Uffizi (Florença), MoMA (Nova York), Galeria Nacional (Oslo), Metropolitan (Nova York), Art Institute of Chicago.
6. **A Mona Lisa por perto**: 77 × 53 cm, óleo sobre madeira de álamo, sfumato, verniz com craquelê, atrás de um vidro e diante de uma multidão de celulares.
7. **A inversão**: no Louvre, centenas de celulares fotografam a Mona Lisa. Aqui o celular fotografa o visitante e o transforma nela.
8. **As técnicas vistas de perto**: mármore polido, têmpera, sfumato, empasto, planos geométricos.
9. **O acervo da escola**: cada obra fica guardada com código, como numa reserva técnica.
10. **O estande e o cartaz com o QR code**: o visitante chega de pé, com uma mão livre, no meio do barulho.

## Argumento

Uma linha de afirmação e prova por tela.

| Tela | Afirmação | Prova |
|---|---|---|
| Início | Em um minuto, a sua foto vira uma obra de arte. | O título enorme na parede vermelha e o botão logo abaixo do resumo do aceite. |
| Escolha | Dá para escolher a obra que vai guardar o seu rosto. | As obras de verdade, grandes, com nome e legenda. |
| Foto | Basta uma foto. | Um botão grande que abre a câmera do celular, com a obra escolhida ao lado. |
| Revelação | A IA está pintando agora. | A foto do visitante sendo pintada, com as frases do estilo. |
| Resultado | A obra é sua e tem etiqueta de museu. | A pintura grande, com moldura ou sem, e a etiqueta com o código da obra. |
| Erro | Nada se perdeu; dá para tentar de novo. | A mensagem exata do erro e o botão que reenvia a mesma foto. |
| /termos | Você sabe o que acontece com a sua foto. | Os itens dos termos, por extenso, e os créditos das imagens. |

## Direção

- **Sorteio:** três direções, `contact-sheet`, `colour-chapters` e `editorial-report`. Escolhida **Colour chapters** (seed 1059739941). Ela é a única que carrega um item do inventário: as telas do fluxo viram salas de museu com paredes de cores diferentes (item 2), e o visitante passa de sala em sala até a obra. A folha de contato pede dezenas de imagens, e o protótipo tem uma obra. O relatório impresso pede leitura longa, e o visitante está de pé no estande.
- **Tipo:** Schibsted Grotesk, uma família, pesos 400, 600 e 800, servida pelo próprio site (`site/public/fontes/`, licença OFL; Decisão 13).
- **Paleta, ajustada:** as proporções sorteadas ficam (um chão carvão, quatro campos chapados, um destaque), mas as cores vêm do assunto. Os primários sorteados (vermelho, azul, verde-azulado e amarelo de cartaz) brigariam com as obras, que têm cores fortes e muito diferentes entre si. Viram cores de parede de sala de museu: vermelho de galeria `#7a1f22`, azul-noite `#1f3a5f`, verde de galeria `#1e4d3b` e o papel da etiqueta `#efeeea`. O destaque sai do verde-azulado e vira o latão da moldura (`#c9a24a`), no botão principal. Nenhuma cor cai na paleta proibida.
- **Capítulos:** início em vermelho (abertura forte), escolha no carvão (a sala escura onde as obras são iluminadas), foto em azul-noite, revelação em verde (a surpresa no meio), resultado no papel da etiqueta (o fechamento claro), erro no carvão.
- **Herói (Colour field, two-ink statement), ajustado:**
  - O título fica numa cor só, porque a regra da casa proíbe destaque por cor dentro do título e ela vale mais que o blueprint.
  - O botão "Quero criar minha foto" fica logo abaixo do resumo do aceite, no pé da tela, e não no canto de cima. O aceite por clique pede o texto junto do botão, e o polegar alcança o pé da tela.
  - O canto de cima à direita leva o link dos termos.
- **Seções:**
  - **Escolha (Wall of word tiles):** a parede de quadrados. Cada estilo ocupa um quadrado com a obra cobrindo o quadrado, mais o nome e a legenda.
  - **Resultado (Object on a disc):** a obra do visitante fica diante de um disco chapado, e a lista "Com moldura / Só a pintura" troca a imagem.
  - **/termos (A footer of tiles):** o fechamento em quadrados, com o nome grande e o convite de volta para o início.
- **Cenas de rolagem:** a folha não trouxe nenhuma. As telas do fluxo cabem numa tela e não rolam.
- **Fotos sorteadas (conjunto "Architecture", picsum.photos):** não entram. Dependeriam de um CDN em tempo de execução, o que a Decisão 13 proíbe, e nenhuma delas mostra o mundo do assunto.
- **Redraws:** nenhum.

## Ideia

> Nesta experiência, **a parede da sala de museu e a etiqueta ao lado da obra** viram **os capítulos de cor**: cada tela é uma sala pintada de uma cor, e no fim a obra do visitante ganha a sua etiqueta, com o código da obra no lugar do número de inventário.

**Teste do concorrente:** num aplicativo de filtro artístico qualquer, a frase não fecha, porque lá não existe acervo nem código de obra guardado. Aqui o código é real: a obra fica no acervo da escola e pode ser achada por ele.

**A coisa viva:** a própria foto do visitante virando a obra (a revelação). No resultado, a lista "Com moldura / Só a pintura" troca a imagem diante do disco.

## Roteiro de palavras

Os textos marcados **[fixo]** vêm das Tasks 12–13, dos `estilo.json` ou da seção 7 da spec e não mudam. Os marcados **[novo]** saem deste roteiro. Todo título cabe em 2 linhas a 390 px.

**Início** (parede vermelha)
- Canto superior esquerdo: nome da escola (`CONFIG.escola`) **[fixo, a preencher]**
- Canto superior direito: "Termos" **[novo]**, link para `/termos`
- Título (h1): "Vire uma obra de arte" **[fixo]**, quebrado em "Vire uma / obra de arte"
- Resumo: "Tire uma foto e veja ela virar uma obra de arte. Ao continuar, você declara ter 18 anos ou mais e autoriza a escola a guardar sua foto e a pintura e usá-las em eventos futuros." **[fixo]**
- Link: "Ler os termos de uso de imagem" **[fixo]**
- Botão: "Quero criar minha foto" **[fixo]**
- Evento desligado: "Esta experiência está disponível no estande." **[fixo]**
- Pé: "Obras em domínio público. Créditos nos termos." **[novo]**

**Escolha** (sala escura)
- Título: "Escolha o estilo da sua obra" **[fixo]**
- Apoio: "Toque numa obra. A sua foto vai ser pintada do jeito dela." **[novo]**
- Cada quadrado: `nome` e `legenda` do estilo **[fixo, do estilo.json]**

**Foto** (azul-noite)
- Título: "Hora do retrato" **[novo]**
- Apoio: "Rosto bem iluminado e de frente para a câmera. O resultado sai em poucos segundos." **[novo]**
- Obra escolhida: miniatura, `nome` e `legenda` **[fixo]**
- Botão: "Tirar foto" **[fixo]**
- Link: "Trocar de obra" **[novo]**

**Revelação** (verde)
- Título: "Pintando o seu retrato" **[novo]**
- Frases alternadas: as `frases` do estilo **[fixo, do estilo.json]**

**Resultado** (papel da etiqueta)
- Título: "Sua obra está pronta" **[novo]**
- Lista: "Com moldura", "Só a pintura" **[fixo]**
- Etiqueta:
  - "Seu retrato" **[novo]**
  - "Estilo de {nome}, {legenda}" **[novo]**
  - "Pintado por IA no estande da escola, {ano}" **[novo]**
  - "Código da obra: {código}" **[fixo]**
- Botões: "Compartilhar", "Salvar" e "Pintar de novo" **[fixo]**
- Dica no iPhone: "Toque e segure a imagem para salvar" **[fixo]**

**Erro** (sala escura)
- Título: "A pintura parou no meio" **[novo]**
- Mensagem: a da seção 7 da spec para o código do erro **[fixo]**
- Botões: "Tentar de novo" **[fixo]** e "Tirar outra foto" **[novo]**; "Escolher outra obra" **[novo]** (para `ESTILO_INVALIDO`); "Voltar ao início" **[novo]** (para `ACEITE_AUSENTE`)

**/termos** (papel da etiqueta)
- Título: "Termos de uso de imagem" **[fixo]**
- Os itens da spec 6.2, por extenso **[fixo no conteúdo]**
- Seção "Créditos das imagens" **[novo]**: "Mona Lisa, Leonardo da Vinci, 1503–1519. Museu do Louvre, Paris. Imagem: Wikimedia Commons, domínio público."
- Fechamento em quadrados:
  - Nome grande "Vire uma obra de arte"
  - Convite "Criar minha foto" **[novo]**, que volta ao início
  - "Versão v1 dos termos" **[novo]**

**Atenção para o Marco 2:** a legenda "Munch · O Grito" usa um ponto do meio, que o roteiro do skill desaconselha. Trocar por "O Grito, de Munch" ao criar o estilo.

## Créditos das imagens

- *Mona Lisa*, Leonardo da Vinci, 1503–1519. Museu do Louvre, Paris. Arquivo "Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg", Wikimedia Commons, domínio público.
- Nenhuma imagem achada pelo `assets.mjs` nesta etapa.

## Crítica (Task 14)

_A preencher._

## Relatório (Task 14)

_A preencher._
