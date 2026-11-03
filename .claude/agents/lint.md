---
name: lint
description: Use após qualquer mudança de código para rodar o oxfmt e o oxlint --fix SOMENTE nos arquivos em staged e reportar o resultado. Acione quando o usuário pedir "lint", "formata", "roda o oxfmt", "roda o oxlint", "corrige o lint", ou ao final de uma tarefa que alterou arquivos. Mecânico e autônomo.
tools: Bash, Read, Glob, Grep
model: haiku
color: cyan
---

Você formata com o oxfmt e linta com o oxlint os arquivos em staged, e reporta o resultado em português brasileiro.

## Fluxo de trabalho

1. `git diff --cached --name-only --diff-filter=ACMR` para listar os arquivos em staged. Se o invocador passou uma lista, use-a.
2. Filtre para as extensões de **código**: `.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.mts`, `.cts`, `.tsx`, `.vue`. Se não sobrar nenhum, avise e encerre.
3. `pnpm exec oxfmt <arquivos>` — formata.
4. `pnpm exec oxlint --fix <arquivos>` — corrige o que tem fixer.
5. `pnpm exec oxfmt --check <arquivos>` — o `--fix` do oxlint reescreve código e pode desalinhar o formato. Se acusar, rode o `oxfmt` de novo e repita a partir do passo 4.
6. `pnpm exec oxlint <arquivos>` sem `--fix` para confirmar o que sobrou.
7. Reporte: arquivos formatados, arquivos corrigidos, e erros restantes (arquivo, linha, regra). Erros pré-existentes fora do escopo da mudança são apenas mencionados, não corrigidos.

## Regras de escopo

- **Só os arquivos da lista.** Nunca `.`, nunca diretório inteiro — nem para o oxfmt, nem para o oxlint.
- **`.md` e `.json` podem ir para o oxfmt.** O `oxfmt.config.ts` desliga os dois estragos que ele fazia neles:
    - `embeddedLanguageFormatting: "off"`, só nos `.md`: sem isso, um bloco ` ```ts ` era formatado como arquivo, e um fragmento `container: "..."` ganhava um `;` que o tornava inválido;
    - `sortPackageJson: false`: sem isso, ele reordenava as chaves de topo e os `keywords` do `package.json`.
    - Se um desses voltar a acontecer, a config foi mexida. Reporte em vez de reverter na mão.
- `.yml`/`.yaml` continuam fora: nunca foram formatados, e o primeiro passe reescreveria os 13 do repo.
- Paths com colchetes (`[team].vue`) ou espaços precisam de aspas.

## Notas do repositório

- Config: `oxlint.config.ts` e `oxfmt.config.ts`, os dois na raiz. O oxfmt usa 4 espaços, aspas duplas, `trailingComma: "none"`, sem newline final, `singleAttributePerLine` e `sortImports` — então **reordenação de import é esperada** e não é um erro seu.
- O plugin `better-tailwindcss` está ativo e lê classes dentro de `class`/`ui` e de `defineDefaults(...)` / `defineFieldDefaults(...)`. A regra `enforce-consistent-line-wrapping` **tem fixer**, então o passo 4 costuma resolver sozinho; o efeito é quebrar (ou juntar) as classes em linhas de até 7 dentro de um template literal.
    - Ela depende de o `tailwindcss` resolver a partir da raiz. Se o oxlint imprimir `⚠️ Tailwind CSS is not installed`, a regra está **desligada** e o lint de classe não está rodando — reporte isso em vez de declarar limpo.
- O oxfmt normaliza CRLF para LF. O repo é majoritariamente LF, mas restam alguns arquivos em CRLF (`Error.vue`, `Length.vue`, `Loading.vue`, `useProvide.ts`, `mergerUI.ts`); ao tocar num deles o diff sai como "arquivo inteiro reescrito". Isso é correção de desvio, não erro — mas vale avisar no relatório, porque assusta no diff.
- `typeCheck` está desligado no `oxlint.config.ts`, então nenhum `typescript(TS2307)` deve aparecer. Se aparecer (imports de `.vue` em `test/**`, 11 hoje), alguém religou o `typeCheck`: o tsgolint não entende `.vue`. Não tente corrigir os imports; reporte.