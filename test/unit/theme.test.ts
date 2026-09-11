import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const COMPONENTS = path.join("src", "runtime", "components");
const STYLESHEET = path.join("src", "runtime", "style.css");
/** Onde os templates do módulo saem — o mesmo `.nuxt/rform` que o vitest.config aliasa. */
const FIXTURE = path.join("test", "fixtures", "basic", ".nuxt", "rform");

/**
 * Toda cor e todo radius do módulo vêm de `--rf-*`, e não de um token `@theme` que
 * só o playground define. Estes testes existem porque as duas formas de quebrar
 * isso são silenciosas, e a lint não cobre nenhuma — ver "Tema: cores e radius" no
 * `.claude/CLAUDE.md`.
 */

const sources = async () => {
    // `internal/` é a terceira categoria sob `components/`: não é campo nem util, não
    // passa por `useField`/`useUtil` e não é registrada pelo `addComponentsDir` — mas
    // carrega classe Tailwind, então tem de entrar na varredura como as outras duas.
    const roots = [
        COMPONENTS,
        path.join(COMPONENTS, "fields"),
        path.join(COMPONENTS, "utils"),
        path.join(COMPONENTS, "internal")
    ];
    const found: { file: string; text: string }[] = [];

    for (const root of roots) {
        for (const entry of await readdir(root, { withFileTypes: true })) {
            if (entry.isFile() && entry.name.endsWith(".vue")) {
                const file = path.join(root, entry.name);

                found.push({ file, text: await readFile(file, "utf8") });
            }
        }
    }

    return found;
};

// Tokeniza o arquivo inteiro, não linha a linha: as classes quebram linha dentro dos
// template strings, e um regex por linha erraria nas bordas do wrap.
const classTokens = (text: string) =>
    text
        .split(/\s+/)
        // Tira a pontuação que delimita a string, senão a última classe de cada literal
        // escapa de todo padrão ancorado em `$`. Só nas pontas: parêntese e colchete
        // fazem parte da sintaxe, e o `!` final também precisa sobreviver.
        .map((token) => token.replace(/^[`'"{[,;]+/, "").replace(/[`'"},;:]+$/, ""))
        .filter(Boolean);

// Tira variante, o `!` final e o `/NN` final antes de casar. Normalizar primeiro é o
// que impede o padrão de pegar a própria arbitrary property.
const core = (token: string) =>
    token
        .replace(/^(?:[a-z0-9-]+|[a-z-]+\[[^\]]*\]|(?:group|peer)-[a-z-]+):(?=\S)/g, "")
        .replace(/!+$/, "")
        .replace(/\/\d+$/, "");

const BANNED = [
    // Tokens `@theme` que só o playground define.
    /^(?:bg|text|border|divide|outline|ring|fill|stroke|from|via|to|decoration|accent|caret|placeholder|shadow)-(?:background|contrast|primary|secondary|success|warn|danger)(?:-\d{2,3})?$/,
    /**
     * Texto sobre fundo `primary`/`danger` é `--rf-color-*-fg`, para o par acompanhar
     * a cor herdada do app. `border-white` fica de fora de propósito: o anel dos
     * marcadores do color picker (`fields/Color.vue`) é branco por desenho, para
     * contrastar com uma cor arbitrária escolhida pelo usuário.
     */
    /^(?:text|bg)-(?:white|black)$/,
    // A escala de radius também é token; `full`/`none` são estruturais e ficam.
    /^rounded(?:-[trblxyse]{1,2})?-(?:xs|sm|md|lg|xl|2xl|3xl|4xl)$/,
    /**
     * Borda de repouso é `--rf-color-border`, não "contrast a 10%" nem `current`
     * reescrito em cada componente. Só a de repouso: `border-(--rf-color-primary)` num
     * `hover:` é estado, e passa.
     */
    /^(?:border|divide)(?:-[trblxyse]{1,2})?-(?:current|\(--rf-color-(?:contrast|background(?:-\d{3})?)\))$/
];

describe("tokens de tema", () => {
    it("mantém toda cor e todo radius numa variável --rf-*", async () => {
        const offenders: string[] = [];

        for (const { file, text } of await sources()) {
            for (const token of classTokens(text)) {
                const bare = core(token);

                if (BANNED.some((pattern) => pattern.test(bare))) {
                    offenders.push(`${file}: ${token}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    it("declara todo --rf-* que os componentes leem, e lê todo o que declara", async () => {
        const used = new Set<string>();

        for (const { text } of await sources()) {
            // `match[0]` é `string`; um grupo capturado seria `string | undefined`.
            for (const match of text.matchAll(/\(--rf-[a-z0-9-]+\)/g)) {
                used.add(match[0].slice(1, -1));
            }
        }

        const stylesheet = await readFile(STYLESHEET, "utf8");
        const declared = new Set(
            [...stylesheet.matchAll(/--rf-[a-z0-9-]+(?=\s*:)/g)].map((match) => match[0])
        );

        // Degraus que existem para o app, não para o módulo: a escala é oferecida
        // inteira. Fora desta lista, token declarado sem uso é bug. O
        // `--rf-color-background-200` saiu daqui ao virar o trilho da barra de
        // progresso do RUtilsFileItem; o `2xl` entrou quando o overlay do RFile passou
        // a casar o raio da própria dropzone.
        const orphans = new Set<string>(["--rf-radius-2xl"]);

        // Os dois sentidos: nada usado sem declarar (renderiza transparente, calado),
        // nada declarado sem uso (token morto que ninguém sabe que não faz nada).
        expect([...used].filter((name) => !declared.has(name))).toEqual([]);
        expect([...declared].filter((name) => !used.has(name) && !orphans.has(name))).toEqual([]);

        // E a lista não pode envelhecer: um `ui` que passe a ler o token tira ele daqui.
        expect([...orphans].filter((name) => used.has(name) || !declared.has(name))).toEqual([]);
    });

    it("gera um #rform/tailwindcss com o @source e os tokens", async () => {
        // A única linha que um app escreve no CSS dele. `@source` faltando ou errado
        // é a falha pior: compila, nada avisa, e todo campo renderiza sem estilo.
        // Sem comentários: o do template cita `@import "tailwindcss"` e entraria no match.
        const source = (await readFile(path.join(FIXTURE, "tailwind.css"), "utf8")).replace(
            /\/\*[\s\S]*?\*\//g,
            ""
        );

        const sources = [...source.matchAll(/@source\s+"([^"]+)"/g)];

        expect(sources).toHaveLength(1);

        const target = sources[0]?.[1] ?? "";

        expect(path.isAbsolute(target)).toBe(true);
        // Sem `\` — em CSS a barra invertida do Windows seria escape.
        expect(target).not.toContain("\\");

        // O diretório tem de existir e ser mesmo o dos componentes do módulo.
        const listing = await readdir(target);

        expect(listing).toContain("fields");
        expect(listing).toContain("utils");
        expect(listing).toContain("Form.vue");

        // E os tokens, que desde a mudança vêm por aqui e não por `nuxt.options.css`.
        const imports = [...source.matchAll(/@import\s+"([^"]+)"/g)];

        expect(imports).toHaveLength(1);

        const tokens = imports[0]?.[1] ?? "";

        expect(tokens).toMatch(/\/style\.css$/);
        expect(tokens).not.toContain("\\");
        expect(await readFile(tokens, "utf8")).toContain("--rf-color-primary");
    });

    it("declara todo token dentro da @layer rform", async () => {
        // A invariante que faz o override funcionar independente de onde o app põe o
        // `@import`. Um `:root` solto aqui inverteria tudo, calado.
        const stylesheet = await readFile(STYLESHEET, "utf8");
        const stripped = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");

        // Remove os blocos `@layer rform { … }` e não deve sobrar token nenhum fora.
        let depth = 0;
        let inLayer = false;
        let outside = "";

        for (const part of stripped.split(/(\{|\})/)) {
            if (part === "{") {
                depth++;
            } else if (part === "}") {
                depth--;
                if (depth === 0) {
                    inLayer = false;
                }
            } else {
                if (depth === 0 && /@layer\s+rform\s*$/.test(part)) {
                    inLayer = true;
                }
                if (!inLayer) {
                    outside += part;
                }
            }
        }

        expect(outside).not.toContain("--rf-");

        // E a layer tem de ser declarada antes de qualquer bloco, para registrar cedo.
        expect(stripped.trimStart()).toMatch(/^@layer\s+rform\s*;/);
    });

    it("impede a folha de contribuir token de tema do Tailwind", async () => {
        // O arquivo é `@import`ado do entry, então `@theme` e `@apply` ali seriam
        // processados — e despejariam variáveis no design system do app.
        const stylesheet = await readFile(STYLESHEET, "utf8");
        const stripped = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
        const atRules = [...stripped.matchAll(/@[a-z-]+/g)].map((match) => match[0].slice(1));

        expect(
            [...new Set(atRules)].filter((rule) => !["layer", "media", "supports"].includes(rule))
        ).toEqual([]);
    });
});