# Módulo de estilos

Cada pasta aqui é um estilo da tela de escolha. O nome da pasta é o `id` do estilo. Incluir ou esconder um estilo não exige mudar código.

```
estilos/
  mona-lisa/
    estilo.json      textos e prompt (obrigatório)
    miniatura.jpg    imagem do cartão (obrigatória)
    referencia.jpg   recorte da obra; vai à IA só com "usarReferencia": true (opcional)
```

## `estilo.json`

| Campo | Tipo | Uso |
|---|---|---|
| `nome` | texto | Nome no cartão ("Mona Lisa") |
| `legenda` | texto | Linha abaixo do nome ("Leonardo da Vinci") |
| `prompt` | texto | Instrução para a IA, em inglês |
| `frases` | lista de textos | Frases que alternam na animação enquanto a IA trabalha (ao menos uma) |
| `ordem` | número | Posição na tela de escolha (menor primeiro) |
| `ativo` | `true` / `false` | `false` esconde o estilo sem apagá-lo |
| `usarReferencia` | `true` / `false` (opcional) | `true` envia a `referencia.jpg` à IA como amostra de paleta e pincelada. Padrão `false`: no teste, a referência fez o modelo copiar pose e roupa da obra |

O prompt do estilo não precisa falar de preservar o rosto: o servidor acrescenta a todo prompt uma instrução fixa de identidade, enquadramento, roupa modesta e saída sem moldura nem assinatura (`servidor/src/provedores/prompt.ts`). Escreva o prompt em frases completas, começando pelo verbo ("Repaint this photo as…"), dizendo o material, a luz e o que vira o fundo e a roupa. Exemplos e o raciocínio de cada estilo estão em [docs/proposta-prompts.md](../docs/proposta-prompts.md).

## Incluir um estilo

1. Copie uma pasta existente com o novo `id` (letras minúsculas e hífens, por exemplo `arte-grega`).
2. Edite o `estilo.json`.
3. Gere as imagens a partir da obra de referência (domínio público ou CC0), dentro de `servidor/`:

   ```bash
   npx tsx scripts/preparar-estilo.ts <imagem-da-obra> ../estilos/<id> [x,y,largura,altura]
   ```

   O recorte é opcional, em pixels da imagem original. O script gera `miniatura.jpg` (lado maior 1080 px) e `referencia.jpg` (lado maior 1024 px). Os cartões da tela de escolha são quadrados, então prefira um recorte quadrado.

   Anote a obra, a fonte, a licença e o recorte em [`FONTES.md`](FONTES.md).
4. Reinicie o pintor para recarregar o catálogo:

   ```bash
   docker compose -f deploy/docker-compose.yml restart pintor
   ```

Uma pasta com `estilo.json` inválido ou sem `miniatura.jpg` é ignorada, com um aviso no log do pintor que diz o motivo.
