import { defineConfig } from "oxlint";

export default defineConfig({
    options: {
        typeAware: true,

        // Desligado: o `typeCheck` é experimental e despeja os diagnósticos crus do
        // tsc, e o tsgolint não tem o plugin do Vue — todo import de `.vue` volta
        // como `TS2307: Cannot find module`. São 11 hoje, numa árvore limpa, e é o
        // que fazia `pnpm run lint` sair com 1 e abortar a cadeia do `release`.
        // Quem manda em tipo aqui é o `test:types`, que roda vue-tsc nos oito
        // projetos e enxerga `.vue`. O `typeAware` fica: as regras que ele liga
        // não passam por resolução de módulo.
        typeCheck: false
    },
    rules: {
        eqeqeq: ["error", "always"],
        curly: "error",
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "logical-assignment-operators": "error",
        "no-implied-eval": "error",
        "func-name-matching": "error",
        "prefer-arrow-callback": "warn",
        "vue/return-in-computed-property": "error",
        // Prop com o nome de um binding do `<script setup>` reduz o componente a
        // `never` no vue-tsc; ver o `search`/`term` no `.claude/CLAUDE.md`.
        "vue/no-dupe-keys": "error",
        "typescript/no-generated-empty-object-type": "warn",
        "import/newline-after-import": "warn",
        "unicorn/no-useless-iterator-to-array": "warn",
        "better-tailwindcss/enforce-consistent-line-wrapping": [
            "warn",
            {
                printWidth: 0,
                classesPerLine: 7,
                indent: 4
            }
        ],
        "jsdoc/check-tag-names": "error",
        "jsdoc/empty-tags": "error",
        "jsdoc/no-defaults": "error",
        "jsdoc/check-access": "error"
    },
    plugins: ["eslint", "typescript", "unicorn", "oxc", "vue", "import", "jsdoc"],
    jsPlugins: ["eslint-plugin-better-tailwindcss"],
    settings: {
        "better-tailwindcss": {
            entryPoint: "playgrounds/i18n/app/assets/css/main.css",
            selectors: [
                {
                    kind: "attribute",
                    name: "^:?(class|ui)$",
                    callTarget: "all",
                    match: [{ type: "strings" }, { type: "objectKeys" }]
                },
                {
                    kind: "callee",
                    path: "^(defineDefaults|defineFieldDefaults)$",
                    match: [{ type: "objectValues", path: "(^|\\.)ui(\\.|$)" }]
                }
            ]
        }
    }
});