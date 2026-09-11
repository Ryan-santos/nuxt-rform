import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RSelect } from "#components";

// O mock é do arquivo inteiro, então o caso sem defaults do app mora no
// `Select.test.ts`.
vi.mock("#rform/defaults", () => ({
    default: {
        Select: { search: true }
    }
}));

const open = async (wrapper: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) => {
    await wrapper.get('[aria-haspopup="listbox"]').trigger("click");
};

/**
 * `search: false` mora no `defaults` do componente, então a busca é opt-in e o
 * `defineFieldDefaults` é como um app a liga de uma vez.
 */
describe("a prop search do RSelect", () => {
    it("é ligada no app inteiro pelo defineFieldDefaults", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b"] } as never
        });

        await open(wrapper);

        expect(wrapper.findAll("input[type=search]")).toHaveLength(1);
    });

    // Limite conhecido: a regra "não apaga" do `merger` pula quando o resultado é
    // truthy e o valor novo é falsy, então o `true` do app vence a tag. Desligar
    // num campo só exigiria ler a prop crua, como o `upload` do `RFile`.
    it("não é desligada na tag sobre o que o defineFieldDefaults ligou", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b"], search: false } as never
        });

        await open(wrapper);

        expect(wrapper.findAll("input[type=search]")).toHaveLength(1);
    });
});