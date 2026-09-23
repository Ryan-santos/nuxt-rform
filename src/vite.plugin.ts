import type { Plugin } from "vite";

// Id do Vite é sempre com barra normal; `resolve()` e `join()` devolvem barra
// invertida no Windows, e comparar os dois crus faz toda raiz do usuário errar.
const normalize = (path: string) => path.split("\\").join("/");

// Lista de argumentos de tipo, capturada para a reescrita devolvê-la: rodando antes
// do plugin do Vue, o que se vê é `useUtil<Props>()` com o generic ainda no meio.
const GENERIC = String.raw`\s*(<[^<>]*(?:<[^<>]*>[^<>]*)*>)?\s*`;

/** Os argumentos de uma chamada, tolerando um nível de parênteses aninhado. */
const ARGS = String.raw`\(([^()]*(?:\([^()]*\)[^()]*)*)\)`;

/**
 * O `defaults` que o componente exporta do `<script lang="ts">`. É a convenção que
 * o registry já exigia, então procurá-la aqui não pede nada de novo a ninguém.
 */
const DECLARES_DEFAULTS = /\bexport\s+const\s+defaults\b/;

/**
 * Quantos argumentos a chamada tem: vírgulas de **topo**, com comentário fora da
 * conta. Contar por lookahead pegava a vírgula de dentro de um `//` no corpo de um
 * `opts`, e aí a injeção do nome simplesmente não acontecia.
 */
const countArgs = (params: string): number => {
    const clean = params.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    if (!clean.trim()) {
        return 0;
    }

    let depth = 0;
    let count = 1;

    for (const char of clean) {
        if (char === "(" || char === "[" || char === "{") {
            depth += 1;
        } else if (char === ")" || char === "]" || char === "}") {
            depth -= 1;
        } else if (char === "," && depth === 0) {
            count += 1;
        }
    }

    return count;
};

/**
 * O componente declara `export const defaults` e tem um nome de arquivo; o build
 * conhece os dois, então nenhum dos dois se repete na chamada. Um
 * `useField(props)` vira `useField(props, undefined, { name: "Text", defaults })`.
 *
 * @param roots Diretórios cujos `.vue` recebem a injeção — os componentes do módulo
 * mais `app/rform/{fields,utils}`.
 */
export default (roots: string[]): Plugin => {
    const prefixes = roots.map((root) => `${normalize(root).replace(/\/+$/, "")}/`);

    return {
        name: "rform-component-name-injector",

        // Antes do plugin do Vue, não depois: depois, o id `.vue` já virou import de
        // um sub-request, e reescrever o que sobrou não muda nada.
        enforce: "pre",

        transform(code, id) {
            const path = normalize(id);

            if (!path.endsWith(".vue") || !prefixes.some((prefix) => path.startsWith(prefix))) {
                return;
            }

            const fileName = path.split("/").pop()!.replace(".vue", "");

            // O identificador, não o objeto: o `<script setup>` divide escopo com o
            // `<script>`, então basta citá-lo. Quem não o declara fica sem a chave, e
            // a composable cai no `{}` de sempre.
            const injected = DECLARES_DEFAULTS.test(code)
                ? `{ name: "${fileName}", defaults }`
                : `{ name: "${fileName}" }`;

            const replaceCode = code
                // Global de propósito: uma segunda chamada não reescrita cairia
                // calada nos defaults de outro componente.
                .replace(
                    new RegExp(`\\buseField${GENERIC}${ARGS}`, "g"),
                    (match, generic = "", params) => {
                        const paramCount = countArgs(params);

                        switch (paramCount) {
                            case 1:
                                return `useField${generic}(${params}, undefined, ${injected})`;
                            case 2:
                                return `useField${generic}(${params}, ${injected})`;
                            default:
                                return match;
                        }
                    }
                )
                // Um `defaults` escrito à mão vira a chave do objeto: continua
                // rodando, e só o type-check se perde. Ver "Ele injeta o `defaults`"
                // no `.claude/CLAUDE.md`.
                .replace(
                    new RegExp(`\\buseUtil${GENERIC}${ARGS}`, "g"),
                    (match, generic = "", params: string) => {
                        const paramCount = countArgs(params);

                        switch (paramCount) {
                            case 0:
                                return `useUtil${generic}(${injected})`;
                            case 1:
                                return `useUtil${generic}({ name: "${fileName}", defaults: ${params.trim()} })`;
                            default:
                                return match;
                        }
                    }
                );

            if (replaceCode !== code) {
                return {
                    code: replaceCode,
                    map: null
                };
            }
        }
    };
};