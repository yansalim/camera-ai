# Proposta de prompts (para revisão)

Rascunho para revisar estilo por estilo antes de mudar o código. Os prompts estão em inglês, porque é a língua em que o modelo os recebe.

## Princípios usados

Os modelos Nano Banana não são de difusão no estilo Stable Diffusion. Eles seguem instruções em linguagem natural, não aceitam prompt negativo nem pesos e funcionam mal com listas de tags. Por isso cada prompt:

- começa com o verbo da operação: "Repaint" (repintar) ou "Re-carve" (esculpir de novo);
- é escrito em frases narrativas;
- diz o que muda e o que fica;
- trava a identidade numa frase explícita;
- é formulado em positivo, com pouquíssimas negações;
- nomeia o material: têmpera sobre painel, mármore de Paros, óleo sobre papelão.

Fontes:
- [Ultimate prompting guide for Nano Banana (Google Cloud)](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)
- [Image generation (Google AI Studio)](https://aistudio.google.com/docs/image-generation)
- [Nano Banana Pro prompting guide (Google AI)](https://dev.to/googleai/nano-banana-pro-prompting-guide-strategies-1h9n)
- [How to prompt Gemini 2.5 Flash Image (Google Developers Blog)](https://developers.googleblog.com/en/how-to-prompt-gemini-2-5-flash-image-generation-for-the-best-results/)

## Instrução fixa (substitui as duas frases de `servidor/src/provedores/prompt.ts`)

Enviada sempre:

```
This is a portrait of a real visitor at a school art exhibition, and they must instantly recognize themselves. Keep each person's identity exactly the same as in the photo: face shape, eyes, eyebrows, nose, mouth, skin tone, apparent age, gender presentation, hairstyle and hair colour, facial hair, glasses and any distinctive marks, with their own expression. Keep the same number of people in the same positions and poses, and the photo's framing and crop, so every face stays as large in the frame as in the photo. Hijabs, caps and hats stay on, rendered in the same medium. Everyone stays fully and modestly clothed, and the result is flattering and respectful. Every part of the image, people included, is genuinely re-made in the medium described, with no photographic texture left. The artwork fills the whole image edge to edge as a plain unsigned surface: no frame, border, lettering or signature.
```

Enviada só se a imagem de referência for mantida em algum estilo:

```
Image 2 is a small crop of the original artwork, given only as a sample of its colour palette, brushwork and surface texture. Take nothing else from it: pose, hands, body, face, hair, clothing and background all come from Image 1 and the description above.
```

Mudanças propostas no código:

- **Desligar a imagem de referência por padrão.** No teste, o Nano Banana Pro copiou a pose, as mãos e a roupa da Mona Lisa. O nome da obra no prompt já basta para dar o estilo.
- **Rotular as imagens com uma linha de texto antes de cada uma:** "Image 1: the visitor's photo." e "Image 2: style sample only."
- **Fixar a proporção da saída igual à da selfie,** com `imageConfig.aspectRatio`. Isso protege o enquadramento.

## arte-grega

```
Re-carve this photo as an ancient Greek marble portrait bust from the Classical period (5th century BC), photographed in a museum. Every person becomes polished Parian marble with fine grey veining and a soft translucent glow, their exact face, features and expression carved in the stone. Eyes are sculpted with incised irises and pupils, so the gaze stays alive. Faint traces of the original ancient paint remain: a soft wash matching each person's real skin tone, hair colour, lips and eye colour. Hair and beard become sculpted curls that follow their real hairstyle; clothing becomes a draped chiton or himation. Glasses, hijabs and hats are carved in the same marble. Soft museum spotlight from above-left against a plain charcoal background.
```

- **Tom de pele:** fica como restos da pintura antiga, porque as estátuas gregas eram pintadas.
- **Olhos:** íris e pupila entalhadas, que é o que mais ajuda a pessoa a se reconhecer.
- **Óculos, véu e chapéu:** esculpidos no próprio mármore.
- **Risco:** parecer uma "estátua viva", com pele de foto e textura de mármore por cima.
- **Alternativa:** "The skin is unmistakably stone, with faint chisel marks and veining; any paint is only a faded tint." Se ainda falhar, usar a versão em mármore branco, sem pintura.

## renascimento

```
Repaint this photo as an Italian Renaissance tempera painting on wooden panel by Sandro Botticelli (c. 1485), in the style of The Birth of Venus and Primavera. Use his graceful, precise dark outlines, pale luminous modelling with very soft shadows, and a smooth matte surface with delicate gold-leaf highlights. Each person keeps their real face, skin tone and hairstyle; hair keeps its own colour and length, painted as fine flowing strands touched with thin gold lines. Everyone wears a modest Florentine gown or tunic embroidered with small flowers, like the figures of Primavera. Behind them: a calm pale sea-green sea with stylised V-shaped waves, a pale blue sky and pink roses drifting through the air.
```

- **Roupa:** vem da *Primavera*, em que as figuras estão vestidas. Isso evita a nudez da Vênus.
- **Cabelo:** mantém cor e comprimento. O prompt atual ("golden waves") deixaria todo mundo loiro de cabelo comprido.
- **Pele:** saiu "pale skin", que clarearia peles escuras.
- **Risco:** aparecer a concha, ombros nus ou o rosto alongado da Vênus.
- **Alternativa:** usar só a *Primavera*, com fundo de laranjal escuro e flores.

## cubismo

```
Repaint this photo as a Synthetic Cubist oil painting in the style of Juan Gris's Portrait of Pablo Picasso (1912) and Picasso's works of the 1910s. Break the background, clothing and shoulders into many interlocking geometric planes seen from several viewpoints at once, with angular facets, crisp dark outlines and flat areas of ochre, slate grey, cool blue and muted green. The face is built from a few large, clean planes that follow its real structure: eyes, nose, mouth, glasses and beard stay in their true positions and proportions, so each person is instantly recognisable, with their own skin tone shown as warm and cool facets of the same hue. Matte oil paint with visible brushwork.
```

- **Onde fragmentar:** forte no fundo e na roupa, só em grandes planos no rosto.
- **Referência:** o retrato de Picasso por Juan Gris, que é cubista e ainda reconhecível.
- **Risco 1:** rosto de foto sobre fundo geométrico, com cara de colagem. Alternativa: "one cheek is seen slightly in profile, and light and shadow on the face split into sharp angular planes."
- **Risco 2:** olhos deslocados ao estilo do Picasso dos anos 1930. Alternativa: deixar só Juan Gris no prompt.

## expressionismo

```
Repaint this photo as an Expressionist painting in tempera and oil on cardboard in the style of Edvard Munch's The Scream (1893). Behind each person, a wooden bridge railing runs diagonally under a swirling blood-orange, red and yellow sunset sky above a dark blue fjord. Long, wavy, rhythmic brushstrokes flow through the sky, the water, the clothing and the hair, with raw, intense, unblended colour and visible cardboard texture. The faces stay fully human and true to life, each with the person's own expression, skin tone and features, painted in Munch's loose strokes with warm ochre light and cool blue shadows. The emotional intensity lives in the sky and the swirling lines.
```

- **Expressão e pose:** as da própria pessoa, sem forçar as mãos no rosto (que geram mãos com defeito e o rosto de caveira).
- **Onde fica a angústia:** no céu e nas linhas.
- **Grade da ponte:** é o elemento que faz reconhecer *O Grito*.
- **Risco:** rosto esverdeado ou fantasmagórico.
- **Alternativa:** "Edvard Munch's paintings of the 1890s" no lugar de "The Scream", mais "faces are warmly lit by the sunset."

## van-gogh

```
Repaint this photo as a Vincent van Gogh oil painting from 1889, combining the brushwork of his Saint-Rémy self-portraits with the sky of The Starry Night. Behind each person swirls a deep-blue night sky with glowing yellow stars, a crescent moon, a dark flame-like cypress and a small sleeping village. Everything, faces included, is built from thick impasto strokes of pure colour that follow the forms: short directional dabs model each person's own face, skin tone and features, while long curving strokes flow through hair, clothing and sky. The faces stay calm, clear and true to life, with the swirling energy around them. Richly textured paint with visible ridges.
```

- **Dois quadros:** o rosto vem dos autorretratos e o céu vem da *Noite Estrelada*.
- **Risco 1:** rosto azulado e escuro. Alternativa: "faces are lit by warm golden lamplight."
- **Risco 2:** o modelo pintar o próprio Van Gogh. Alternativa: "his 1889 portraits" no lugar de "self-portraits".

## mona-lisa

```
Repaint this photo as an oil portrait on poplar panel by Leonardo da Vinci, in the manner of the Mona Lisa (1503–1519). Model each person's real face with sfumato: soft, smoky transitions from warm light into deep shadow, without hard edges, in warm muted browns, olive greens and amber. Keep their own pose and hand positions, hairstyle and hair colour; clothing becomes simple dark Renaissance garments of velvet and finely pleated linen, following the shape of their own clothes. Behind them lies a hazy blue-green imaginary landscape with winding paths, a small bridge and distant water, seen from a slightly higher vantage point. The whole surface shows old yellowed varnish and fine craquelure. The face itself shows brushwork, varnish and craquelure like the rest of the panel.
```

- **Pose:** "Keep their own pose and hand positions" corrige o erro do Nano Banana Pro.
- **Roupa:** o veludo que ficou bom no Nano Banana 2.1 agora é pedido de propósito.
- **Rosto:** a última frase (pincelada, verniz e craquelado no próprio rosto) entrou depois do teste de 2026-11-05. Sem ela, o rosto do Nano Banana 2.1 ainda parecia foto.

## Como testar

- **Fotos (8 a 10):** idade, tom de pele, óculos, boné, hijab, careca, cabelo crespo, contraluz, dupla e trio.
- **Ordem:**
  1. Todos os estilos no Nano Banana 2.1, sem referência, 2 vezes por foto.
  2. Os estilos problemáticos nos outros modelos.
  3. Referência ligada contra desligada.
- **Notas de 1 a 5:**
  - se outra pessoa reconhece quem é;
  - se parece arte de verdade;
  - se o rosto e o enquadramento se mantêm;
  - se o número de pessoas é o mesmo;
  - se óculos, véu, barba e tom de pele foram mantidos;
  - se a roupa está modesta;
  - se há defeitos (mãos, texto).
