# rform

Formulários para Nuxt que se montam por composição — e cujo model, tipos e
validação saem do mesmo lugar: o campo.

```vue
<template>
    <RForm v-model="data">
        <RText
            name="nome"
            label="Nome"
            required
            rule="required"
        />
        <RText
            name="cpf"
            label="CPF"
            mask="brCpf"
            rule="brCpf"
        />
    </RForm>
</template>

<script setup lang="ts">
    const { data } = useRForm<{ nome?: string; cpf?: string }>();
</script>
```

`name` liga o campo ao model. `rule` liga o campo à validação. `mask` liga o
campo ao formato. E o tipo de `modelValue` sai do `default` que o próprio
componente declara.

## Instalação

```bash
pnpm add nuxt-rform zod
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
    modules: ["nuxt-rform"]
});
```

O pacote no npm é **`nuxt-rform`** — o prefixo é a convenção do ecossistema
Nuxt. Tudo o mais continua curto: a chave de config é `rform`, o alias é
`#rform` e os seus campos moram em `app/rform/`.

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "#rform/tailwindcss";
```

Essa linha traz as duas coisas: o `@source` dos componentes do módulo (o Tailwind
não varre `node_modules`) e os tokens de tema. Num app sem Tailwind, use
`css: ["nuxt-rform/style.css"]`.

`zod` é peer dependency **obrigatória** — as rules embutidas são schemas zod.

## O que vem na caixa

- **13 campos** — `RText`, `RTextarea`, `RNumber`, `RSelect`, `RSwitch`, `RDate`,
  `RCalendar`, `RHour`, `RColor`, `RFile`, `RPin`, `RArray`, `RObject`.
- **`RForm`** — a raiz da injeção, e o `form` que toda rule enxerga.
- **`RDynamic`** — renderiza um schema como dado; `object` e `array` recursam.
- **`useRForm`** em três modos — schema completo, só zod, ou só TS.
- **Presets** de máscara e validação, com o namespace `br/` completo, e os seus
  em `app/rform/presets`.
- **Campos e utils próprios** em `app/rform/{fields,utils}` — primeira classe:
  entram no `FieldType`, no `components-map` e no `defineFieldDefaults`.
- **Tema por variável** — 16 `--rf-*`; trocar tema é trocar variável, `ui` não se
  mexe.
- **i18n** — nenhum texto cravado, e com `@nuxtjs/i18n` instalado o módulo fala
  pelo store do seu app, sem custo de bundle.

## Documentação

**[rform.ryancode.dev](https://rform.ryancode.dev)** — em pt-BR e en, com demos vivos,
referência de props gerada do fonte e um endpoint MCP em `/mcp` para agentes.

Para rodar o site localmente, o fonte está em [`docs/`](docs/):

```bash
pnpm install
pnpm dev:prepare
pnpm run docs      # :3000 — o `run` não é opcional: `docs` é comando do pnpm
```

## Playgrounds

Quatro apps de rascunho, cada um provando um eixo diferente em condições de app
real:

| comando                | o quê                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm play`            | [`playgrounds/i18n`](playgrounds/i18n/) — troca de idioma, packs do usuário                   |
| `pnpm play:basic`      | [`playgrounds/basic`](playgrounds/basic/) — cadastro, `RDynamic` por rota do Nitro, CRUD      |
| `pnpm play:standalone` | [`playgrounds/standalone`](playgrounds/standalone/) — **sem** `@nuxtjs/i18n`, o motor próprio |
| `pnpm play:ui`         | [`playgrounds/ui`](playgrounds/ui/) — tokens `--rf-*`, `defineFieldDefaults`, `ui` por campo  |

## Desenvolvimento

```bash
pnpm install       # cobre a raiz, o docs e os quatro playgrounds
pnpm dev:prepare   # popula os .nuxt e os #rform
pnpm test          # vitest: unit + nuxt + e2e
pnpm test:types    # vue-tsc nos sete apps
pnpm lint          # oxlint
```

Um `pnpm install` **dentro** de um subprojeto não instala nada — ele resolve para
a raiz e responde "Already up to date", com exit 0. Rode sempre da raiz.

## Licença

[MIT](LICENSE)