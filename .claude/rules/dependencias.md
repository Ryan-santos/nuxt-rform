# Versões de pacote

- **`devDependencies` é versão exata, sem `^`**, nos seis `package.json` (raiz,
  `docs`, os quatro playgrounds).
- **`dependencies` e `peerDependencies` do pacote publicado continuam com `^`.**
  Fixar ali muda o que o app de quem instala recebe. Um peer exato faz o
  `npm install` falhar com ERESOLVE em todo app com outro zod 4. Uma dep exata
  duplica `@nuxt/kit`/`@nuxt/icon` quando a versão do app não bate. A única
  exceção é a `maska`, abaixo.
- **Escolha a versão pelo `pnpm outdated -r`, não pelo `npm view`.** O pnpm 11
  daqui para na última versão publicada há mais de 24h: medido, o `outdated`
  listou nuxt 4.6.3 com a 4.6.4 publicada havia 18h. O `npm view <pkg> version`
  não filtra nada, e fixar a versão de hoje desalinha do que o pnpm resolve.
- **Atualizar o lockfile sem regravar os ranges** é `pnpm update -r --no-save`.
  Sem o `--no-save` ele reescreve o `^` das `dependencies` com o piso novo.

## O que fica para trás, e por quê

| pacote                                  | fica em     | por quê                                                                                                                                                                                                    |
| --------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maska` (`dependencies`)                | `3.2.0`     | a 3.2.1 fez o `MaskInput` recusar todo `.type` fora de `text`/`search`/`url`/`tel`/`password` (issue #276 deles), e `<textarea>` é `"textarea"`. O `vMask` vira no-op no `RTextarea`: a 3.2.1 avisa no console, a 3.2.2 (PR #279) recusa calada |
| `typescript`                            | 5.9.x       | o `@nuxt/module-builder` pede `^5.9.3`, e a 7.x (o port nativo) não expõe o `ts.sys` de que o compiler-sfc depende                                                                                          |
| `h3` (docs)                             | 1.x         | o Nuxt 4 roda sobre h3 1; a 2 é a do Nitro 3                                                                                                                                                               |
| `better-sqlite3` (docs)                 | 12.x        | a 13 não publica binário pré-compilado (0 assets da 13.0.0 à 13.0.3) e cai no node-gyp, que pede Python e toolchain C++                                                                                    |
| `@intlify/bundle-utils`                 | 11.2.5      | a 11.2.7 (PR #622 do bundle-tools) passou a deixar intacta a forma antiga do arquivo de locale, e o caso de `test/unit/langFile.test.ts` que prova a quebra deixaria de ter o que provar. Um app no `@nuxtjs/i18n` 10.4 ainda roda o gerador antigo |

**A `maska` já mordeu publicada.** O `^3.2.0` resolvia a 3.2.2 desde setembro de
2026, então todo app que instalou o módulo nesse intervalo recebeu o `RTextarea`
sem máscara. O repo não via, porque o lockfile seguia na 3.2.0. Quem pegou foi o
`test/nuxt/mask.test.ts`, no primeiro `pnpm update`. Para subir a maska, o upstream
tem de voltar a aceitar textarea no `MaskInput` (pedido em
https://github.com/beholdr/maska/issues/281), ou o `vMask` tem de deixar de usá-lo.

## Os que sobem juntos

- **`agents` e `@modelcontextprotocol/server` (docs).** O `dist/mcp` da `agents`
  importa o `server` de forma estática em toda versão. Até a 0.22 ele era peer
  obrigatório, e o pnpm o instalava sozinho. Na 0.32 virou peer **opcional**, com o
  import ainda estático, e o build do Worker morre com
  `Cannot resolve "@modelcontextprotocol/server" … externals are not allowed!`. A
  versão do `server` é a exata que a `agents` declara no `peerDependencies` (2.4.0
  para a 0.32).
- **`oxlint` e `oxlint-tsgolint`.** O oxlint declara `oxlint-tsgolint` como peer
  com piso (`>=7.0.2005` na 1.90).
- **`playwright-core` e o Chromium.** Versão nova pede outro build do browser:
  `pnpm exec playwright-core install chromium` localmente. O CI já roda isso.

## Depois de atualizar

`pnpm run dev:prepare`, `pnpm test`, `pnpm run test:types`, `pnpm run lint` e
`pnpm run docs:build`. **No build do docs, confira a linha
`api.json — N componentes`**: se o `api.json` sair vazio, o build sai com 0
mesmo assim, com um WARN perdido no log, e o site publica a tabela de props vazia
e o `get-component-api` do MCP quebrado. Foi o que a Nuxt 4.6 fez; ver "O
`buildDir` não é o mesmo em todo comando" no `.claude/CLAUDE.md`.
