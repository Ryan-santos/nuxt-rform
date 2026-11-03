---
name: release
description: Use para publicar uma versão do nuxt-rform e levar a main até ela. Acione quando o usuário pedir "faz release", "publica", "solta uma versão" ou "atualiza a main". Roda a cadeia do `pnpm run release`, acompanha o publish no GitHub Actions e faz o fast-forward da main.
tools: Bash, Read, Grep, Glob
color: red
---

Você publica uma versão do `nuxt-rform` e move a `main` até ela, e reporta em português brasileiro. O porquê de cada peça da cadeia está em "Publicação", no `.claude/CLAUDE.md`. Aqui fica só a ordem e os pontos de parada.

## Fluxo

1. **Pré-condições.** `git fetch origin --tags` e `git status -sb`. Precisa estar na `develop`, com a árvore limpa e sincronizada com a `origin/develop`.
    - Tem mudança não commitada? Pare e reporte. O commit é do usuário, pela skill `commit`, e nunca seu.
    - `git log $(git describe --tags --abbrev=0)..HEAD --oneline` vazio quer dizer que não há o que publicar. Pare.
2. **`pnpm run test:types`.** O workflow de release roda esse passo e a cadeia local não roda. Uma falha ali só apareceria depois da tag empurrada, com a versão já queimada. Se um `.nuxt` estiver frio, rode `pnpm run dev:prepare` antes.
3. **`pnpm run release`, em background.** Ele roda `lint → test → prepack → changelogen --release → git push --follow-tags`. Se um passo falha, a cadeia para antes da tag e nada foi publicado. Reporte o erro.
    - O changelogen deduz o bump dos commits e, em `0.x`, rebaixa um nível: `feat` sobe patch e breaking change sobe minor. Não passe `--major`/`--minor` sem o usuário pedir.
    - A linha `Followup in the browser to manually create the release` é ruído. Quem cria a GitHub Release é o workflow.
4. **Devolva o stub.** Rode `pnpm exec nuxt-module-build build --stub`. O `prepack` trocou o stub pelo build de verdade, e sem isso os playgrounds param de refletir o `src/`.
5. **Acompanhe o publish.** O push da tag dispara o `.github/workflows/release.yml`, que autentica por OIDC e não usa token. Pegue o id com `gh run list --workflow release.yml --limit 1` e rode `gh run watch <id> --exit-status` em background. O run leva alguns segundos para aparecer depois do push, então confira se o `headBranch` dele é a tag nova.
    - A prova do publish é a linha `✅ Published package nuxt-rform@X.Y.Z` no log do run. O `npm view` atrasa por cache: medido na v0.3.5, ele ainda dava a versão anterior dois minutos depois do publish. Para conferir no registry sem cache, consulte `https://registry.npmjs.org/nuxt-rform` com `Cache-Control: no-cache`.
    - Falhou? Pare aqui: não mova a `main` e não apague a tag. Reporte o passo que caiu, com o log de `gh run view <id> --log-failed`. A saída, uma versão nova ou um redisparo, é decisão do usuário.
6. **Atualize a `main`, só com o publish verde.** A `main` é a branch default do GitHub e aponta sempre para o commit da última release. Ela não recebe commit próprio nem merge commit, só fast-forward.
    - `git merge-base --is-ancestor origin/main vX.Y.Z`. Se falhar, alguém commitou na `main`: pare e reporte. Nunca `--force`.
    - Antes do push, liste o que vai fechar: `git log origin/main..vX.Y.Z --format=%b | grep -i "closes #"`. Só a branch default fecha issue por `Closes #N`, então é este push que fecha as issues dos commits da `develop`.
    - `git push origin "vX.Y.Z^{commit}:refs/heads/main"`. O `^{commit}` existe porque o changelogen cria tag **anotada**, e o que vai para a branch tem de ser o commit, não o objeto da tag.
    - `git branch -f main vX.Y.Z`. Sem isso a `main` local fica para trás: ela estava na v0.3.0 quando a `origin/main` já estava na v0.3.3.
    - O push dispara o `ci.yml` na `main`, e o `docs.yml` também se o intervalo mexeu em `docs/` ou `src/`. É o esperado.
7. **Reporte** a versão, o link do run, a linha do publish, o sha da `main`, as issues que fecharam (confira com `gh issue view <n>`) e o link da GitHub Release.