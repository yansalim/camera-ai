# Decisões

## 2026-11-05: modelo de imagem = Nano Banana 2.1

**Escolha:** `gemini-nano-banana-2.1`, no Vertex AI, região `global`. Fica em `MODELO_IMAGEM`.

**Como foi decidido.** Uma foto real foi testada nos 6 estilos com os prompts de [proposta-prompts.md](proposta-prompts.md), em duas versões do pedido: sem imagem de referência e com a proporção da saída igual à da foto. Os modelos comparados foram o Nano Banana 2.1 e o Pro. Num teste anterior, só no estilo Mona Lisa, o Nano Banana 2 (`gemini-3.1-flash-image`) foi descartado: ele transformou pouco e o resultado parecia uma colagem.

| Modelo | Custo por imagem | Tempo médio | Qualidade |
|---|---|---|---|
| Nano Banana 2.1 | US$ 0,040 | ~16 s | Identidade mantida nos 6 estilos; Cubismo mais marcado que o do Pro |
| Nano Banana Pro | US$ 0,140 | ~19 s | Equivalente; Arte Grega um pouco mais "estátua" |

**Como o custo foi calculado:** pelos tokens que o Vertex AI devolve em cada resposta (`usageMetadata`), com os preços da [tabela oficial](https://cloud.google.com/vertex-ai/generative-ai/pricing) consultada em 2026-11-05. Para o 2.1, por milhão de tokens:

- entrada: US$ 1,50
- texto e raciocínio: US$ 7,50
- imagem de saída: US$ 30

Uma imagem de saída de 1K consome cerca de 1.120 tokens. As 12 imagens do teste custaram US$ 1,08.

**Estimativa para o evento:** 2.000 fotos × US$ 0,040 dão cerca de **US$ 80**. O crédito da avaliação gratuita é de US$ 300; com o Pro, a mesma conta daria cerca de US$ 280.

**Por que o 2.1:** custa 3,5 vezes menos que o Pro, com qualidade equivalente depois do refinamento dos prompts.

**Mona Lisa:** com o prompt novo, o rosto ainda parecia foto. A variante reserva acrescenta pincelada, verniz e craquelado no próprio rosto, foi testada 2 vezes contra o prompt base e passou a ser o prompt do estilo.

**Risco para o evento: limite de cota.** No mesmo dia, depois de cerca de 20 chamadas, o Vertex AI passou a responder **HTTP 429 (RESOURCE_EXHAUSTED)** até com uma chamada por vez. Esperando de 20 a 40 s, todas acabaram passando.

O servidor já trata o 429 como erro temporário e tenta de novo uma vez. Num estande com várias pessoas ao mesmo tempo, porém, isso pode virar fila e erro na tela. Antes do evento:

- conferir a cota do modelo no console, em IAM e administrador → Cotas, filtrando por "nano-banana", e pedir aumento se for baixa;
- fazer um teste de carga com `CONCORRENCIA` igual à do evento.
