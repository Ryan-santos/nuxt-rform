import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";

import useField from "../../src/runtime/composables/useField";
import useUtil from "../../src/runtime/composables/useUtil";
// Por caminho, não por `#components`: estes moram na fixture, e o type-check do
// módulo resolve `#components` contra os tipos gerados dele.
import RRating from "../fixtures/basic/rform/fields/Rating.vue";
import RSwitch from "../fixtures/basic/rform/fields/Switch.vue";

// O Vite reescreve `new URL(<template literal>, import.meta.url)`, então os
// caminhos são montados a partir da raiz do repo.
const root = process.cwd();

const read = (path: string) => readFile(join(root, "test/fixtures/basic/.nuxt", path), "utf8");

// A fixture traz `fields/Rating.vue` (campo que o módulo não tem),
// `fields/Switch.vue` (substituição de um que ele tem) e `utils/Hint.vue`.
describe("um campo de app/rform/fields", () => {
    it("é registrado sob o prefixo R e renderiza", async () => {
        const wrapper = await mountSuspended(RRating);

        expect(wrapper.find("[data-testid='rating-1']").exists()).toBe(true);
    });

    it("ganha os próprios defaults, não os de outro componente", async () => {
        const wrapper = await mountSuspended(RRating);

        // `max: 5` vem do `defineDefaults` do próprio arquivo.
        expect(wrapper.findAll("[data-testid^='rating-']")).toHaveLength(5);
        expect(wrapper.find("div").classes()).toContain("rating");
    });

    it("aceita uma prop declarada só naquele arquivo", async () => {
        const wrapper = await mountSuspended(RRating, {
            props: { max: 3 } as never
        });

        expect(wrapper.findAll("[data-testid^='rating-']")).toHaveLength(3);
    });

    it("conduz um model como qualquer campo embutido", async () => {
        const wrapper = await mountSuspended(RRating, {
            props: { modelValue: 0 } as never
        });

        await wrapper.find("[data-testid='rating-4']").trigger("click");

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe(4);
    });
});

describe("um util de app/rform/utils", () => {
    it("renderiza dentro do campo que o inclui, lendo as props do pai", async () => {
        const wrapper = await mountSuspended(RRating, {
            props: { hint: "escolha de 1 a 5" } as never
        });

        expect(wrapper.find("[data-testid='hint']").text()).toBe("escolha de 1 a 5");
    });

    it("sai da frente quando o pai não passa nada", async () => {
        const wrapper = await mountSuspended(RRating);

        expect(wrapper.find("[data-testid='hint']").exists()).toBe(false);
    });
});

describe("um arquivo com o nome de um embutido", () => {
    it("substitui o embutido — a tag R resolve para o componente do usuário", async () => {
        const wrapper = await mountSuspended(RSwitch);

        expect(wrapper.find("[data-testid='custom-switch']").exists()).toBe(true);
        // O embutido renderiza um checkbox; a substituição não.
        expect(wrapper.find("input").exists()).toBe(false);
    });

    it("consegue partir do original pelo #rform/builtin", async () => {
        const wrapper = await mountSuspended(RSwitch);

        // O `default: true` é da substituição; chegar ao botão já prova que o spread
        // do `defaults` embutido resolveu.
        expect(wrapper.find("[data-testid='custom-switch-toggle']").text()).toBe("on");
        expect(wrapper.find("[data-testid='custom-switch']").classes()).toContain("custom-switch");
    });
});

describe("os artefatos gerados", () => {
    // O registry guarda só nomes — quem carrega o caminho é o `components-map`, que
    // importa cada campo estaticamente. É lá que a substituição se prova.
    it("resolvem um componente substituído para o arquivo do usuário, uma vez só", async () => {
        const registry = await read("rform/registry.ts");
        const map = await read("rform/components-map.ts");

        expect([...registry.matchAll(/^ {4}"Switch"/gm)]).toHaveLength(1);

        expect(map).toContain("rform/fields/Switch.vue");
        expect(map).not.toContain("src/runtime/components/fields/Switch.vue");
    });

    it("listam os componentes do usuário ao lado dos embutidos", async () => {
        const registry = await read("rform/registry.ts");

        expect(registry).toContain(`"Rating"`);
        expect(registry).toContain(`"Hint"`);
        expect(registry).toContain(`"Text"`);
    });

    // O `vue-tsc` lê o SFC antes da reescrita do plugin, então o `defaults` injetado
    // só é conferido aqui. Tem de ser `.ts`: o `skipLibCheck` do Nuxt não olha para
    // `.d.ts`, e lá a asserção passaria batida — medido.
    it("conferem contra Base o defaults que o plugin injeta, inclusive o do usuário", async () => {
        const components = await read("rform/types/components/index.ts");
        const utils = await read("rform/types/components/utils/index.ts");

        expect(components).toMatch(
            /Assert<Injected<typeof import\("[^"]*rform\/fields\/Rating\.vue"\)>>/
        );
        expect(utils).toMatch(/Assert<Injected<typeof import\("[^"]*rform\/utils\/Hint\.vue"\)>>/);
    });

    it("registram os componentes do usuário sob os prefixos R e RUtils", async () => {
        const components = await read("components.d.ts");

        expect(components).toContain("export const RRating:");
        expect(components).toContain("export const RUtilsHint:");
    });

    it("apontam a tag R de um componente substituído para o arquivo do usuário", async () => {
        const components = await read("components.d.ts");
        const line = components
            .split("\n")
            .find((entry) => entry.startsWith("export const RSwitch:"));

        expect(line).toContain("rform/fields/Switch.vue");
        expect(line).not.toContain("src/runtime/components");
    });

    it("deixam o RDynamic resolver o campo novo pelo type", async () => {
        const map = await read("rform/components-map.ts");

        expect(map).toContain(`"rating": Rating`);
    });

    it("dão uma entrada de Props ao campo e ao util novos", async () => {
        const components = await read("rform/types/components/index.ts");
        const utils = await read("rform/types/components/utils/index.ts");

        expect(components).toContain("export type Rating =");
        expect(utils).toContain("export type Hint =");
    });

    it("expõem o util novo como um espaço em `ui.Utils` de todo campo", async () => {
        const props = await read("rform/types/components/utils/props.ts");

        expect(props).toContain(`Hint?: Utils["Hint"]["ui"]`);
    });
});

describe("um nome de componente que não resolve", () => {
    // Síncrono nos dois, não como rejeição: o nome é injetado em build time, então a
    // falta dele é falha de build e não há o que aguardar antes de dizer.
    it("falha alto no useField em vez de tomar emprestado os defaults do Text", () => {
        expect(() => useField({})).toThrow(/could not resolve a component name/);

        expect(() => useField({}, undefined, { name: "Nope" as never })).toThrow(/got "Nope"/);
    });

    it("falha alto no useUtil em vez de tomar emprestado os defaults do Label", () => {
        expect(() => useUtil()).toThrow(/could not resolve a component name/);

        expect(() => useUtil({ name: "Nope" as never })).toThrow(/got "Nope"/);
    });
});