import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RSelect } from "#components";

// O mock é do arquivo inteiro, então os casos sem defaults do app moram no
// `selectFooter.test.ts`.
vi.mock("#rform/defaults", () => ({
    default: {
        Select: { clearable: false }
    }
}));

const open = async (wrapper: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) => {
    await wrapper.get('[aria-haspopup="listbox"]').trigger("click");
};

const users = [
    { id: 1, name: "Ana" },
    { id: 2, name: "Bruno" }
];

const pick = { value: "id", label: "name" };

const x = (wrapper: { find: (s: string) => { exists: () => boolean } }) =>
    wrapper.find('[aria-haspopup="listbox"] button[aria-label="Limpar"]');

/**
 * `clearable` fica **fora** do `defaults`, então as duas direções passam — ao
 * contrário do `search`, que mora no `defaults` e só liga.
 */
describe("a prop clearable do RSelect", () => {
    it("é desligada no app inteiro pelo defineFieldDefaults", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, pick } as never
        });

        expect(x(wrapper).exists()).toBe(false);

        await open(wrapper);

        expect(wrapper.text()).not.toContain("Limpar");
    });

    it("é religada na tag sobre o que o defineFieldDefaults desligou", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, clearable: true, pick } as never
        });

        expect(x(wrapper).exists()).toBe(true);

        await open(wrapper);

        expect(wrapper.text()).toContain("Limpar");
    });
});