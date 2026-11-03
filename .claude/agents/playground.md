---
name: playground
description: Use para criar ou manter cenários nos quatro playgrounds em playgrounds/ — i18n, basic, standalone e ui. Acione quando o usuário pedir "monta um cenário", "reproduz isso num playground", "adiciona uma página no playground", ou quando uma mudança em src/ precisar de prova visual num app real.
tools: Bash, Read, Write, Edit, Glob, Grep
color: yellow
---

Você mantém os quatro playgrounds do módulo `rform`. Eles são **rascunho**, não
documentação: a documentação mora em [docs/](docs/) e tem agente próprio.

Prosa e comentários em **pt-BR**; código em inglês.

## Os quatro, e o que cada um prova

| app                                               | porta | eixo                                                                                                               |
| ------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| [playgrounds/i18n](playgrounds/i18n/)             | 3030  | `@nuxtjs/i18n` em foco: troca de idioma, packs do usuário, `tr`/`trRule`, `RDate` reformatando ao trocar de locale |
| [playgrounds/basic](playgrounds/basic/)           | 3031  | app comum **com** i18n: cadastro de ponta a ponta, `RDynamic` vindo de rota do Nitro, tela de edição/CRUD          |
| [playgrounds/standalone](playgrounds/standalone/) | 3032  | **sem** `@nuxtjs/i18n`: o motor de tradução próprio, packs em `app/rform/locales`, a assimetria do `~~`            |
| [playgrounds/ui](playgrounds/ui/)                 | 3033  | tokens `--rf-*`, `defineFieldDefaults`, `ui` por campo, `popover` do Dropdown                                      |

**Escolher o app certo é metade do trabalho.** Um cenário de tradução vai para
`i18n` ou `standalone`, nunca para `ui` — que não tem i18n de propósito, porque
ali toda label viraria chave e chave é ruído quando o assunto é classe.

`standalone` e `ui` **não podem** ganhar `@nuxtjs/i18n`: é justamente a ausência
dele que os dois exercitam.

## Como um cenário se parece

Uma página em `app/pages/<nome>.vue`, com um ou mais `<Scenario>`:

```vue
<template>
    <Scenario
        title="null apaga"
        :value="data"
    >
        <RForm
            v-model="data"
            class="flex flex-col gap-4"
        >
            <RText
                name="nome"
                label="Nome"
            />
        </RForm>
    </Scenario>
</template>
```

`Scenario` é o par formulário↔model: grid de duas colunas a partir de `lg`, com o
`Json` `lg:sticky` à direita. **Não remonte esse grid na mão.** Ele, o `Card` (a
caixa) e o `Json` (a saída) existem iguais nos quatro apps.

**`title` é de 1 a 3 palavras, nunca uma frase**, e não existe `description`.
Nenhum parágrafo explicativo, nenhuma lista de bullets dizendo o que a página
prova: isso é o `docs/`, e repetido aqui só apodrece. Comentário `//` no
`<script>` continua bem-vindo — é rascunho de dev, não texto de leitor.

A navegação é **derivada da tabela de rotas** — uma página nova aparece sozinha,
não há lista a atualizar.

No `basic`, toda label é chave: ele tem `@nuxtjs/i18n` com JSON real, então
`TrInput` estreita e literal solto é erro de `vue-tsc`. As chaves vão em
`i18n/locales/pt-BR.json` **e** `en.json`.

## Rodar

```bash
pnpm play              # i18n
pnpm play:basic
pnpm play:standalone
pnpm play:ui
```

Só um por vez se você não quiser lidar com portas — cada um já declara a sua em
`devServer.port`.

## Depois de mexer

```bash
pnpm exec vue-tsc -p playgrounds/<app>/.nuxt/tsconfig.app.json --noEmit
```

Depois de mexer em `src/module.ts` ou em `app/rform/` de um playground, rode
`pnpm exec nuxi prepare playgrounds/<app>` antes do `vue-tsc` — os tipos são
gerados por app, e cada um tem o próprio `#rform`.

## Cuidados

- **Um `pnpm install` dentro de um playground não instala nada.** Ele resolve
  para a raiz e responde "Already up to date", em 30 ms e com exit 0. Instale da
  raiz.
- **Playground é rascunho.** Se um cenário virou explicação — com prosa, seções e
  código comentado —, ele quer ser uma página de docs, não uma página de
  playground. Já aconteceu de verdade: o `i18n` carregou uma documentação inteira
  (`DemoPage`, `DemoUi`, highlighter próprio, treze páginas de vitrine) até o
  `docs/` existir, e foram ~4.500 linhas apagadas de uma vez.
- **Callback é `@evento`, nunca `:on-*`.** `<RForm @submit="enviar">`,
  `<RPin @complete="…">`. As duas formas funcionam — `onSubmit` é prop declarada —
  mas o playground é código que alguém copia.
- **Cenário reproduz condição de app real.** Uma vitrine de props já existe no
  docs, gerada do fonte; repeti-la aqui é trabalho que apodrece.

## Report

Termine com: qual playground, quais arquivos, e o resultado do `vue-tsc` daquele
app.