import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { demoSourceOf } from "../../docs/app/utils/demoSource";
import { highlight, paint } from "../../docs/app/utils/highlight";
import { searchDocs, type Section } from "../../docs/app/utils/search";

const root = fileURLToPath(new URL("../..", import.meta.url));

const content = join(root, "docs/content");

const demos = join(root, "docs/app/demos");

/** Todo `.md` de uma árvore de conteúdo, com o caminho relativo à raiz do locale. */
async function pages(locale: string): Promise<string[]> {
    const walk = async (dir: string, prefix: string): Promise<string[]> => {
        const entries = await readdir(join(content, locale, dir), { withFileTypes: true });

        const found = await Promise.all(
            entries.map(async (entry) => {
                const path = prefix ? `${prefix}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                    return walk(join(dir, entry.name), path);
                }

                return entry.name.endsWith(".md") ? [path] : [];
            })
        );

        return found.flat();
    };

    return (await walk("", "")).sort();
}

/** Todo `<Componente>/<id>` que existe em `docs/app/demos`. */
async function available(): Promise<Set<string>> {
    const dirs = await readdir(demos, { withFileTypes: true });

    const found = await Promise.all(
        dirs
            .filter((entry) => entry.isDirectory())
            .map(async (entry) =>
                (await readdir(join(demos, entry.name)))
                    .filter((file) => file.endsWith(".vue"))
                    .map((file) => `${entry.name}/${file.slice(0, -".vue".length)}`)
            )
    );

    return new Set(found.flat());
}

/**
 * Bloco cercado e código inline saem antes: a própria página de contribuição
 * mostra `::demo{src="Componente/id"}` como exemplo da sintaxe, e ele não é uma
 * referência a resolver.
 */
const prose = (source: string) => source.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");

/** Todo `src` citado num `::demo{…}` do conteúdo, com a página que o cita. */
async function referenced(): Promise<{ page: string; src: string }[]> {
    const all: { page: string; src: string }[] = [];

    for (const locale of ["pt", "en"]) {
        for (const page of await pages(locale)) {
            const source = prose(await readFile(join(content, locale, page), "utf8"));

            for (const match of source.matchAll(/::demo\{[^}]*src="([^"]+)"/g)) {
                all.push({ page: `${locale}/${page}`, src: match[1] as string });
            }
        }
    }

    return all;
}

describe("demoSourceOf", () => {
    it("desembrulha o `<template>` e desindenta quando não há script", () => {
        const raw = ["<template>", '    <RText name="nome" />', "</template>"].join("\n");

        expect(demoSourceOf(raw)).toBe('<RText name="nome" />');
    });

    it("preserva a indentação relativa entre as linhas", () => {
        const raw = [
            "<template>",
            "    <RArray>",
            '        <RText name="a" />',
            "    </RArray>",
            "</template>"
        ].join("\n");

        expect(demoSourceOf(raw)).toBe(
            ["<RArray>", '    <RText name="a" />', "</RArray>"].join("\n")
        );
    });

    it("devolve o arquivo inteiro quando há `<script setup>`", () => {
        const raw = [
            "<template>",
            "    <RText :rule />",
            "</template>",
            "",
            '<script setup lang="ts">',
            "    const rule = () => undefined;",
            "</script>"
        ].join("\n");

        expect(demoSourceOf(raw)).toBe(raw);
    });

    it("não engole um `</template>` de slot no meio do arquivo", () => {
        const raw = [
            "<template>",
            "    <RText>",
            "        <template #leading> R$ </template>",
            "    </RText>",
            "</template>"
        ].join("\n");

        expect(demoSourceOf(raw)).toBe(
            ["<RText>", "    <template #leading> R$ </template>", "</RText>"].join("\n")
        );
    });
});

describe("paridade pt/en", () => {
    it("toda página de `pt` tem irmã em `en`, e vice-versa", async () => {
        const [pt, en] = await Promise.all([pages("pt"), pages("en")]);

        expect(en).toEqual(pt);
    });

    it("as duas árvores concordam no título de cada seção", async () => {
        const nav = async (locale: string) =>
            (await readdir(join(content, locale), { withFileTypes: true }))
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort();

        expect(await nav("en")).toEqual(await nav("pt"));
    });
});

describe("demos", () => {
    it("todo `::demo{src}` aponta para um arquivo que existe", async () => {
        const files = await available();

        const missing = (await referenced())
            .filter(({ src }) => !files.has(src))
            .map(({ page, src }) => `${page} → ${src}`);

        expect(missing).toEqual([]);
    });

    it("todo demo é citado por alguma página", async () => {
        const cited = new Set((await referenced()).map(({ src }) => src));

        const orphans = [...(await available())].filter((src) => !cited.has(src)).sort();

        expect(orphans).toEqual([]);
    });
});
describe("busca", () => {
    const sections: Section[] = [
        {
            id: "/concepts/presets#masks",
            title: "Masks",
            titles: ["Presets"],
            level: 2,
            content: "Um nome que não bate com preset nenhum vai direto pro maska como pattern cru."
        },
        {
            id: "/fields/text",
            title: "Text",
            titles: [],
            level: 1,
            content: "Campo de texto. Aceita mask e as rules."
        }
    ];

    it("não devolve nada com termo vazio", () => {
        expect(searchDocs(sections, "   ")).toEqual([]);
    });

    it("põe o título na frente do corpo", () => {
        expect(searchDocs(sections, "mask").map((hit) => hit.id)).toEqual([
            "/concepts/presets#masks",
            "/fields/text"
        ]);
    });

    it("exige toda palavra do termo", () => {
        expect(searchDocs(sections, "mask inexistente")).toEqual([]);
    });

    it("ignora acento nos dois lados, e recorta o trecho do texto original", () => {
        const [hit] = searchDocs(sections, "nao bate");

        expect(hit?.id).toBe("/concepts/presets#masks");
        expect(hit?.snippet).toContain("não bate");
    });
});

describe("i18n do site", () => {
    /** Todo caminho pontilhado de um pack, para comparar as duas árvores. */
    const paths = (value: unknown, prefix = ""): string[] =>
        value && typeof value === "object"
            ? Object.entries(value).flatMap(([key, child]) =>
                  paths(child, prefix ? `${prefix}.${key}` : key)
              )
            : [prefix];

    it("os dois packs concordam em toda chave", async () => {
        const pack = async (code: string) =>
            paths(
                JSON.parse(await readFile(join(root, `docs/i18n/locales/${code}.json`), "utf8"))
            ).sort();

        expect(await pack("en")).toEqual(await pack("pt"));
    });

    // O `JSON.parse` engole a chave repetida e fica com a última: um demo passava a
    // mostrar o texto do outro, calado. Toda chave escrita tem de sobreviver ao parse.
    it.each(["pt", "en"])("o pack %s não repete chave", async (code) => {
        const text = await readFile(join(root, `docs/i18n/locales/${code}.json`), "utf8");
        const count = (value: unknown): number =>
            value && typeof value === "object"
                ? Object.values(value).reduce((sum: number, child) => sum + 1 + count(child), 0)
                : 0;

        expect(count(JSON.parse(text))).toBe(text.match(/"(?:[^"\\]|\\.)*"\s*:/g)?.length);
    });
});

describe("realce", () => {
    const read = (path: string) => readFile(join(root, path), "utf8");

    it("o tema tem o que o shiki lê, e sob o nome que o código pede", async () => {
        const theme = JSON.parse(await read("docs/app/assets/shiki/shades-of-purple.json"));

        expect(theme.name).toBe("shades-of-purple");
        expect(theme.tokenColors.length).toBeGreaterThan(100);
        expect(Object.keys(theme.colors)).toEqual(["editor.background", "editor.foreground"]);
    });

    // O fonte de um demo sem script é o miolo do `<template>`, e sem
    // `grammarContextCode` o shiki larga tudo depois do primeiro elemento sem
    // escopo — o segundo campo saía branco.
    it("pinta todo elemento de um recorte de template, não só o primeiro", async () => {
        // Um atributo por linha, que é como todo demo se escreve: é essa forma
        // que a gramática confunde com o bloco de topo de um SFC.
        const element = (name: string) => `<RText\n    name="${name}"\n/>`;

        const html = await highlight([element("a"), element("b")].join("\n"), "vue");

        expect(html.match(/color:#9EFFFF">&#x3C;RText/g)).toHaveLength(2);
        expect(html).not.toContain("color:#FFFFFF");
    });

    it("pinta json na hora, sem esperar por gramática nenhuma", () => {
        expect(paint(`{ "a": 1 }`, "json")).toContain(`<span style="color:`);
    });

    // As duas chaves de `theme` existem porque o `defu` do @nuxt/content mescla
    // com o default do mdc: só o `default` deixaria o github-dark sobreviver.
    it("a prosa lê a variável que o nuxt.config declara", async () => {
        const config = await read("docs/nuxt.config.ts");
        const css = await read("docs/app/assets/css/main.css");

        expect(config).toContain("default: shikiTheme");
        expect(config).toContain("dark: shikiTheme");
        expect(css).toContain("color: var(--shiki-dark)");
    });
});