# Módulo de estilos

Cada pasta aqui é um estilo da tela de escolha. O nome da pasta é o `id` do estilo. Incluir ou esconder um estilo não exige mudar código.

```
estilos/
  mona-lisa/
    estilo.json      textos e prompt (obrigatório)
    miniatura.jpg    imagem do cartão (obrigatória)
    referencia.jpg   enviada à IA como referência de estilo (opcional)
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

O pintor não precisa saber da regra de preservar o rosto: ela é acrescentada a todo prompt pelo servidor.

## Incluir um estilo

1. Copie uma pasta existente com o novo `id` (letras minúsculas e hífens, por exemplo `arte-grega`).
2. Edite o `estilo.json`.
3. Gere as imagens a partir da obra de referência (domínio público ou CC0), dentro de `servidor/`:

   ```bash
   npx tsx scripts/preparar-estilo.ts <imagem-da-obra> ../estilos/<id> [x,y,largura,altura]
   ```

   O recorte é opcional, em pixels da imagem original. O script gera `miniatura.jpg` (lado maior 480 px) e `referencia.jpg` (lado maior 1024 px).
4. Reinicie o pintor para recarregar o catálogo:

   ```bash
   docker compose -f deploy/docker-compose.yml restart pintor
   ```

Uma pasta com `estilo.json` inválido ou sem `miniatura.jpg` é ignorada, com um aviso no log do pintor que diz o motivo.
