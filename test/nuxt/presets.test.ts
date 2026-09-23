import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// @vitest-environment nuxt
import { describe, expect, it } from "vitest";

import { defineMask, defineRule } from "#rform/utils";

// O Vite reescreve `new URL(<template literal>, import.meta.url)`, então os
// caminhos são montados a partir da raiz do repo.
const root = process.cwd();

const read = (path: string) => readFile(join(root, "test/fixtures/basic/.nuxt", path), "utf8");

describe("helpers de preset", () => {
    it("são exports nomeados de #rform/utils", () => {
        expect(defineRule).toBeTypeOf("function");
        expect(defineMask).toBeTypeOf("function");
    });

    it("devolvem o objeto do preset intacto", () => {
        const rule = { available: ["text"], validation: () => undefined } as const;
        const mask = { mask: "###" } as const;

        expect(defineRule(rule)).toBe(rule);
        expect(defineMask(mask)).toBe(mask);
    });

    it("são importados, nunca auto-importados", async () => {
        const imports = await read("imports.d.ts");

        expect(imports).not.toContain("definePreset");
    });
});

describe("barrel #rform/utils", () => {
    const names = async () =>
        (await readdir(join(root, "src/runtime/utils")))
            .filter((file) => file.endsWith(".ts"))
            .map((file) => file.slice(0, -".ts".length));

    it("reexporta os exports nomeados de cada util, não só o default", async () => {
        const utils = await read("rform/utils.ts");

        for (const name of await names()) {
            // Sem extensão de propósito: com `.ts` no specifier o TS exigiria
            // `allowImportingTsExtensions` do app consumidor.
            expect(utils).toContain(`export * from "`);
            expect(utils).toMatch(new RegExp(`export \\* from "[^"]*/utils/${name}"`));
        }
    });

    it("não nomeia o default de um util que não tem default", async () => {
        const utils = await read("rform/utils.ts");

        // `tr.ts` exporta `tr` — o nome do próprio arquivo. Um `import tr from …`
        // seguido de `export { tr }` sombrearia o `export *`, e o barrel entregaria
        // o objeto default no lugar da função.
        expect(utils).not.toContain("import tr from");
        expect(utils).not.toMatch(/^ {3}tr,?$/m);
    });

    it("entrega `tr` como função, não como o objeto default do arquivo", async () => {
        const { tr, trRule } = await import("#rform/utils");

        expect(typeof tr).toBe("function");
        expect(typeof trRule).toBe("function");
    });
});

describe("namespace br", () => {
    // Dois arquivos porque as masks saem num template próprio — é ele que o
    // `useField` importa estaticamente.
    it("prefixa todo preset brasileiro, rules e masks igualmente", async () => {
        const rules = await read("rform/presets.ts");
        const masks = await read("rform/masks.ts");

        for (const name of ["brCpf", "brCnpj", "brCep", "brTelefone"]) {
            expect(rules).toContain(`"${name}"`);
        }

        for (const name of ["brCelular", "brCpfCnpj", "brPlaca", "brData"]) {
            expect(masks).toContain(`"${name}"`);
        }
    });

    it("não deixa preset brasileiro sem prefixo para trás", async () => {
        const sources = [await read("rform/presets.ts"), await read("rform/masks.ts")].join("\n");

        for (const name of ["cpf", "cnpj", "cep", "telefone", "celular", "placa"]) {
            expect(sources).not.toContain(`"${name}":`);
        }
    });

    it("mantém as rules genéricas sem prefixo", async () => {
        const presets = await read("rform/presets.ts");

        for (const name of ["required", "min", "max", "email", "url"]) {
            expect(presets).toContain(`"${name}"`);
        }
    });
});

describe("FieldType", () => {
    it("lista um membro por componente de campo, nas duas raízes", async () => {
        const contents = await read("rform/types/fields.d.ts");
        const generated = [...contents.matchAll(/"([^"]+)"/g)]
            .map((match) => match[1] ?? "")
            .sort((a, b) => a.localeCompare(b));

        const roots = [
            join(root, "src/runtime/components/fields"),
            join(root, "test/fixtures/basic/rform/fields")
        ];

        // Um set: a fixture substitui `Switch`, que é um membro, não dois.
        const expected = [
            ...new Set(
                (await Promise.all(roots.map((dir) => readdir(dir))))
                    .flat()
                    .filter((file) => file.endsWith(".vue"))
                    .map((file) => file.slice(0, -4).toLowerCase())
            )
        ].sort((a, b) => a.localeCompare(b));

        expect(generated).toEqual(expected);
    });

    it("deixa de fora Form e Dynamic, que moram fora de `fields`", async () => {
        const contents = await read("rform/types/fields.d.ts");

        expect(contents).not.toContain(`"form"`);
        expect(contents).not.toContain(`"dynamic"`);
    });

    it("cobre os field types que os componentes com máscara passam ao Element", async () => {
        const contents = await read("rform/types/fields.d.ts");

        expect(contents).toContain(`"text"`);
        expect(contents).toContain(`"textarea"`);
        expect(contents).toContain(`"date"`);
        expect(contents).toContain(`"hour"`);
    });
});