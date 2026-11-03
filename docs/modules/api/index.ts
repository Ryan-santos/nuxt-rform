/**
 * Gera `.nuxt/docs/api.json` — a tabela de props do site, lida do fonte pelo
 * `vue-component-meta`.
 *
 * Nasce em todo `dev`, `build` e `prepare`, como o do `mcp`. Ver o CLAUDE.md.
 */
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { defineNuxtModule, useLogger } from "@nuxt/kit";

import { buildApi } from "./data.ts";

export default defineNuxtModule({
    meta: {
        name: "rform-docs-api"
    },

    setup(_options, nuxt) {
        const logger = useLogger("rform-docs-api");

        const dir = join(nuxt.options.buildDir, "docs");

        // Mesmo mkdir e mesmo par de aliases do módulo `mcp` — ver os comentários
        // de lá; os dois módulos fazem isto para não depender de ordem entre eles.
        mkdirSync(dir, { recursive: true });

        nuxt.options.alias["#docs"] = dir;
        nuxt.options.nitro.alias ??= {};
        nuxt.options.nitro.alias["#docs"] = dir;

        const out = join(dir, "api.json");

        // `typesDir`, não `buildDir`: desde a Nuxt 4.6 o `nuxi build` compila no
        // cache, mas o tsconfig continua no `.nuxt` do app.
        const tsconfig = join(nuxt.options.typesDir, "tsconfig.app.json");

        /**
         * `build:before`, e **não** um `addTemplate`: os `.vue` do módulo entram no
         * programa do TypeScript pelo `components.d.ts` e pelos tipos `#rform/*`,
         * que são templates. O `getContents` de um template roda no meio do
         * `generateApp`, quando esses irmãos ainda não estão no disco — e o checker
         * falha com "is not part of the project". Este hook roda depois de todos.
         *
         * A escrita ainda é antes do `builder.bundle()`, que é o que importa: o
         * Vite e o nitro resolvem `#docs/api.json` pelo arquivo já no disco.
         */
        nuxt.hook("build:before", async () => {
            // O `nuxi build` escreve o tsconfig antes do `buildNuxt`, e o `dev`
            // herda o do prepare anterior. Só o `nuxi prepare` o escreve depois —
            // ali a lista sai vazia, e não faz falta, porque nada renderiza. O cast
            // no call site é o que mantém isso compilando.
            if (!existsSync(tsconfig)) {
                if (!nuxt.options._prepare) {
                    logger.warn(
                        "api.json vazio: `.nuxt/tsconfig.app.json` não existe. Rode `nuxi prepare docs`."
                    );
                }

                await writeFile(out, "[]\n", "utf8");

                return;
            }

            const all = buildApi(tsconfig);

            await writeFile(out, `${JSON.stringify(all, null, 4)}\n`, "utf8");

            logger.info(`api.json — ${all.length} componentes`);
        });
    }
});