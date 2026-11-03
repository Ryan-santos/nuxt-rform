import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";

import { RText, RTextarea } from "#components";

const fields = import.meta.glob<{ defaults: { ui?: { container?: string } } }>(
    "../../src/runtime/components/fields/*.vue",
    { eager: true }
);

const GROWTH = new Set(["grow", "flex-1", "flex-auto"]);

const roots = Object.entries(fields).map(([file, mod]) => ({
    name: file.split("/").pop()!.replace(".vue", ""),
    classes: (mod.defaults.ui?.container ?? "").split(/\s+/).filter(Boolean)
}));

/**
 * O happy-dom não tem layout, então nada aqui mede caixa: a guarda é a classe que
 * sai do merge. Ver "O container raiz não cresce" e "O placeholder parado precisa
 * de caixa" no `.claude/CLAUDE.md`.
 */
describe("container raiz dos campos", () => {
    it("varre todos os campos", () => {
        expect(roots.map(({ name }) => name)).toEqual(
            expect.arrayContaining(["Text", "Textarea", "Select", "File", "Array"])
        );
    });

    // O pai natural é o RForm, que é coluna: crescer ali é crescer na altura.
    it.each(roots)("$name não cresce no eixo do pai", ({ classes }) => {
        expect(classes.filter((token) => GROWTH.has(token))).toEqual([]);
    });
});

describe("placeholder parado", () => {
    it("no RTextarea, fica na área de texto e recorta o que não couber", async () => {
        const wrapper = await mountSuspended(RTextarea, {
            props: { label: "Prompt", placeholder: "Uma frase longa o bastante para quebrar" }
        });
        const placeholder = wrapper.get(".RUtilsPlaceholder");
        const classes = placeholder.classes();

        expect(classes).toEqual(
            expect.arrayContaining(["absolute", "inset-3", "h-auto", "overflow-hidden"])
        );
        expect(classes).not.toContain("relative");
        expect(classes).not.toContain("h-0");
        expect(classes).not.toContain("top-3");
        expect(classes).not.toContain("left-3");
        expect(placeholder.element.parentElement!.classList).toContain("relative");
    });

    it("no RText, fica numa linha só, cortada na área do input", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { label: "Nome", placeholder: "Uma frase mais larga que o próprio input" }
        });
        const placeholder = wrapper.get(".RUtilsPlaceholder");
        const classes = placeholder.classes();

        // Sem o teto, `truncate` não corta nada: sem quebra de linha a largura
        // do util vira a do texto inteiro.
        expect(classes).toEqual(
            expect.arrayContaining([
                "absolute",
                "top-3",
                "left-3",
                "h-auto",
                "max-w-[calc(100%-1.5rem)]",
                "truncate"
            ])
        );
        expect(classes).not.toContain("relative");
        expect(classes).not.toContain("h-0");
        expect(placeholder.element.parentElement!.classList).toContain("relative");
    });

    // Sem label, o rótulo flutuante em letra pequena quebraria e desceria sobre o texto.
    it("flutuando, fica numa linha só", async () => {
        const wrapper = await mountSuspended(RTextarea, {
            props: { modelValue: "algo", placeholder: "Uma frase longa o bastante para quebrar" }
        });
        const placeholder = wrapper.get(".RUtilsPlaceholder");

        expect(placeholder.attributes("data-floating")).toBeDefined();
        expect(placeholder.classes()).toEqual(
            expect.arrayContaining(["max-w-[calc(100%-1rem)]", "truncate"])
        );
    });
});