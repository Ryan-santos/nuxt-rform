import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { compileScript, parse, registerTS } from "vue/compiler-sfc";

/**
 * Um campo do usuário que estende o `Props` de um embutido faz o
 * `@vue/compiler-sfc` seguir o tipo até o `.d.vue.ts` **dentro de `node_modules`**
 * — e, para resolver o `#rform/types` que ele importa, procurar um tsconfig
 * subindo a partir desse arquivo e escolher, entre os referenciados, o que o
 * **inclui**. Nenhum inclui `node_modules`, e o fallback é a raiz, sem `paths`.
 * Era a issue #5, e só aparece com o pacote instalado: com o módulo por caminho
 * relativo a busca acha o tsconfig deste repo, que tem o alias. Ver "O consumidor
 * precisa incluir os `.d.vue.ts` do pacote" no `.claude/CLAUDE.md`.
 */

registerTS(() => ts);

const ROOT = path.join(import.meta.dirname, "..", "..");
const COMPONENTS = path.join(ROOT, "src", "runtime", "components");

/** O pacote como o pnpm o instala: arquivos reais sob `.pnpm`, link em `node_modules`. */
const REAL = "node_modules/.pnpm/nuxt-rform@0.0.0/node_modules/nuxt-rform";
const REAL_COMPONENTS = `../${REAL}/dist/runtime/components`;

const temps: string[] = [];

afterAll(async () => {
    await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Um app consumidor mínimo, com o `include` do `tsconfig.app.json` escolhido pelo caso. */
const consumer = async (include: string[]) => {
    const root = await mkdtemp(path.join(tmpdir(), "rform-builtin-"));

    temps.push(root);

    const write = async (rel: string, text: string) => {
        const file = path.join(root, rel);

        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, text);
    };

    await write(`${REAL}/package.json`, JSON.stringify({ name: "nuxt-rform", type: "module" }));
    await write(
        `${REAL}/dist/runtime/type.d.ts`,
        "export type Element<D> = { name?: string; label?: string; modelValue?: D };"
    );
    await write(
        `${REAL}/dist/runtime/components/fields/Select.d.vue.ts`,
        [
            `import type { Element } from "#rform/types";`,
            "export declare const defaults: { default: null };",
            "export type Props<Opts = unknown[]> = Element<typeof defaults> & { options: Opts; search?: boolean };",
            `declare const _default: import("vue").DefineComponent<Props>;`,
            "export default _default;"
        ].join("\n")
    );
    await symlink(path.join(root, REAL), path.join(root, "node_modules", "nuxt-rform"), "junction");

    // O que o Nuxt gera: `#rform/types` é do app, e só o tsconfig dele o conhece.
    await write(
        ".nuxt/rform/types/index.d.ts",
        `export type { Element } from "../../../${REAL}/dist/runtime/type";`
    );
    await write(".nuxt/nuxt.d.ts", "export {}");
    await write(
        ".nuxt/tsconfig.app.json",
        JSON.stringify({
            compilerOptions: {
                module: "preserve",
                moduleResolution: "Bundler",
                allowArbitraryExtensions: true,
                skipLibCheck: true,
                noEmit: true,
                paths: {
                    "#rform/builtin": [REAL_COMPONENTS],
                    "#rform/builtin/*": [`${REAL_COMPONENTS}/*`],
                    "#rform": ["./rform"],
                    "#rform/*": ["./rform/*"]
                }
            },
            include: ["./nuxt.d.ts", "../app/**/*", ...include],
            exclude: ["../node_modules", "../dist", "../.output"]
        })
    );
    await write(
        "tsconfig.json",
        JSON.stringify({ files: [], references: [{ path: "./.nuxt/tsconfig.app.json" }] })
    );

    return root;
};

/** O campo do usuário da issue: estende o `Props` do `RSelect` e tira duas chaves. */
const FIELD = [
    `<script lang="ts">`,
    `    import type { Props as SelectProps } from "#rform/builtin/fields/Select.vue";`,
    `    export type Props = Omit<SelectProps<string[]>, "options" | "search"> & { route: string };`,
    "</script>",
    `<script setup lang="ts">`,
    "    const props = defineProps<Props>();",
    "</script>",
    "<template><div>{{ props.route }}</div></template>"
].join("\n");

const compile = async (root: string) => {
    const filename = path.join(root, "app", "rform", "fields", "SelectApi.vue");

    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, FIELD);

    const { descriptor } = parse(FIELD, { filename });

    return compileScript(descriptor, { id: "select-api", fs: ts.sys }).content;
};

describe("estender o Props de um embutido no app instalado", () => {
    it("sem o include, o compiler-sfc não resolve o #rform/types do .d.vue.ts", async () => {
        const root = await consumer([]);

        await expect(compile(root)).rejects.toThrow(
            /Failed to resolve import source "#rform\/types"/
        );
    });

    it("com os .d.vue.ts do pacote no include, o Props estendido enumera as props do embutido", async () => {
        const root = await consumer([`${REAL_COMPONENTS}/**/*.d.vue.ts`]);
        const content = await compile(root);

        expect(content).toContain("label: { type: String, required: false }");
        expect(content).toContain("route: { type: String, required: true }");
        expect(content).not.toContain("options:");
    });

    it("o include precisa ser o caminho real: pelo link de node_modules não casa", async () => {
        // O compiler-sfc resolve o `.d.vue.ts` pelo `realpath`, então um padrão
        // escrito pelo symlink nunca casa com o arquivo que ele de fato lê.
        const root = await consumer([
            "../node_modules/nuxt-rform/dist/runtime/components/**/*.d.vue.ts"
        ]);

        await expect(compile(root)).rejects.toThrow(
            /Failed to resolve import source "#rform\/types"/
        );
    });
});

describe("o módulo empurra o include para o consumidor", () => {
    it("o tsconfig.app.json da fixture inclui os .d.vue.ts de runtime/components", async () => {
        const buildDir = path.join(ROOT, "test", "fixtures", "basic", ".nuxt");
        const tsconfig = JSON.parse(
            await readFile(path.join(buildDir, "tsconfig.app.json"), "utf8")
        ) as { include?: string[] };
        const entry = `${path.relative(buildDir, COMPONENTS).split(path.sep).join("/")}/**/*.d.vue.ts`;

        expect(tsconfig.include).toContain(entry);
    });
});