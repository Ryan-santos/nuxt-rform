import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Tipagem não entra no `<template>` — ver "Tipagem não entra no template" no
 * `.claude/CLAUDE.md`. O cast some do olhar de quem lê o markup, o `vue-tsc` o
 * checa num lugar onde ninguém procura, e num demo do site ele vira exemplo.
 */

const ROOTS = [
    path.join("src", "runtime", "components"),
    path.join("docs", "app"),
    path.join("playgrounds", "i18n", "app"),
    path.join("playgrounds", "basic", "app"),
    path.join("playgrounds", "standalone", "app"),
    path.join("playgrounds", "ui", "app"),
    path.join("test", "fixtures", "basic", "rform")
];

const IGNORED = new Set(["node_modules", ".nuxt", ".output", "dist"]);

const files = async (root: string): Promise<string[]> => {
    const found: string[] = [];

    for (const entry of await readdir(root, { withFileTypes: true })) {
        if (IGNORED.has(entry.name)) {
            continue;
        }

        const full = path.join(root, entry.name);

        if (entry.isDirectory()) {
            found.push(...(await files(full)));
        } else if (entry.name.endsWith(".vue")) {
            found.push(full);
        }
    }

    return found;
};

/** O miolo do `<template>` de topo, linha a linha, com o número de linha real. */
const templateLines = (text: string) => {
    const lines = text.split(/\r?\n/);
    const open = lines.findIndex((line) => line.trim().startsWith("<template>"));

    if (open === -1) {
        return [];
    }

    // O fechamento de topo é o único sem indentação; um `</template>` de slot vem
    // recuado.
    const close = lines.findIndex((line, index) => index > open && line === "</template>");

    return lines
        .slice(open + 1, close === -1 ? lines.length : close)
        .map((line, index) => ({ line, number: open + index + 2 }));
};

const OFFENDERS = [
    /\bas\s+(?:unknown|const|[A-Z][\w.]*)/,
    /\bsatisfies\s+[A-Z]/,
    // Anotação no escopo de um slot: `#[name]="scope: Scope"`, `v-slot="{ x }: T"`.
    /(?:#\[?[\w.]+\]?|v-slot(?::[\w[\]]+)?)="[^"]*:\s*[A-Z]/
];

describe("tipagem não entra no template", () => {
    it("não há cast, `satisfies` nem anotação de slot em nenhum `.vue`", async () => {
        const offenses: string[] = [];

        for (const root of ROOTS) {
            for (const file of await files(root)) {
                const text = await readFile(file, "utf8");

                for (const { line, number } of templateLines(text)) {
                    if (OFFENDERS.some((pattern) => pattern.test(line))) {
                        offenses.push(`${file}:${number}: ${line.trim()}`);
                    }
                }
            }
        }

        expect(offenses).toEqual([]);
    });

    it("enxerga um cast quando ele existe", () => {
        const sample = [
            "<template>",
            '    <RDynamic :schema="props.schema as Schema" />',
            "</template>"
        ].join("\n");

        const found = templateLines(sample).filter(({ line }) =>
            OFFENDERS.some((pattern) => pattern.test(line))
        );

        expect(found).toHaveLength(1);
        expect(found[0]!.number).toBe(2);
    });

    it("não confunde `as` de v-for nem chave maiúscula de objeto", () => {
        const sample = [
            "<template>",
            '    <div v-for="(item, key) in list" :class="{ Utils: true }">',
            '        <span :aria-label="asLabel">{{ item }}</span>',
            "    </div>",
            "</template>"
        ].join("\n");

        const found = templateLines(sample).filter(({ line }) =>
            OFFENDERS.some((pattern) => pattern.test(line))
        );

        expect(found).toEqual([]);
    });
});

/**
 * `v-model` não liga elemento nativo — ver "O elemento nativo liga por `:value` +
 * `@input`" no `.claude/CLAUDE.md`. O `mounted` do `vModelText` é post-render
 * effect: um Suspense pendente o represa e, ao resolver, ele reaplica o valor do
 * vnode da montagem por cima do que chegou no meio (issue #6).
 */

const FIELD_ROOTS = [
    path.join("src", "runtime", "components"),
    path.join("docs", "app", "rform"),
    path.join("playgrounds", "i18n", "app", "rform"),
    path.join("test", "fixtures", "basic", "rform")
];

/** Toda tag nativa de formulário com `v-model`, com a linha em que a tag abre. */
const nativeModels = (text: string) => {
    const found: { number: number; tag: string }[] = [];
    const pattern = /<(input|textarea|select)\b[^>]*>/g;

    for (const match of text.matchAll(pattern)) {
        if (/\sv-model(?:[:.][\w.]+)?=/.test(match[0])) {
            found.push({
                number: text.slice(0, match.index).split(/\r?\n/).length,
                tag: match[1]!
            });
        }
    }

    return found;
};

describe("`v-model` não liga elemento nativo", () => {
    it("nenhum `<input>`, `<textarea>` ou `<select>` de campo ou util usa `v-model`", async () => {
        const offenses: string[] = [];

        for (const root of FIELD_ROOTS) {
            for (const file of await files(root)) {
                for (const { number, tag } of nativeModels(await readFile(file, "utf8"))) {
                    offenses.push(`${file}:${number}: <${tag} v-model>`);
                }
            }
        }

        expect(offenses).toEqual([]);
    });

    it("enxerga o `v-model` numa tag de várias linhas, e ignora o de componente", () => {
        const sample = [
            "<template>",
            '    <RUtilsDropdown v-model:open="open">',
            "        <input",
            '            v-model="model"',
            '            type="text"',
            "        />",
            '        <textarea :value="model" />',
            "    </RUtilsDropdown>",
            "</template>"
        ].join("\n");

        expect(nativeModels(sample)).toEqual([{ number: 3, tag: "input" }]);
    });
});

/**
 * As duas composables são síncronas, e o `defaults` chega pelo vite plugin. Um
 * `await` de volta numa delas devolve o componente ao Suspense, e aí o `setRef` do
 * pai roda antes de o `defineExpose` existir (issue #8) e o `rulesList` fica
 * incompleto no mount. Ver "O `RForm` não pode ser async" no `.claude/CLAUDE.md`.
 */
const awaited = (text: string) => {
    const found: { number: number; call: string }[] = [];

    for (const match of text.matchAll(/\bawait\s+(useField|useUtil)\b/g)) {
        found.push({
            number: text.slice(0, match.index).split(/\r?\n/).length,
            call: match[1]!
        });
    }

    return found;
};

describe("nenhum campo ou util abre dependência de Suspense", () => {
    it("nenhum `.vue` aguarda `useField` ou `useUtil`", async () => {
        const offenses: string[] = [];

        for (const root of FIELD_ROOTS) {
            for (const file of await files(root)) {
                for (const { number, call } of awaited(await readFile(file, "utf8"))) {
                    offenses.push(`${file}:${number}: await ${call}()`);
                }
            }
        }

        expect(offenses).toEqual([]);
    });

    it("enxerga o `await` de volta, e não confunde com um await vizinho", () => {
        const sample = [
            "    const { props } = await useUtil<Props>();",
            "    const loaded = await load();",
            "    const { model } = await useField(_props);"
        ].join("\n");

        expect(awaited(sample)).toEqual([
            { number: 1, call: "useUtil" },
            { number: 3, call: "useField" }
        ]);
    });
});