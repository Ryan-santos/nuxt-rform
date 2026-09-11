import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RSelect } from "#components";

// O mock é do arquivo inteiro, então o caso sem defaults do app mora no
// `selectRemote.test.ts`.
vi.mock("#rform/defaults", () => ({
    default: {
        Select: { debounce: 500 }
    }
}));

const open = async (wrapper: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) => {
    await wrapper.get('[aria-haspopup="listbox"]').trigger("click");
};

const settle = async (wrapper: { vm: { $nextTick: () => Promise<void> } }, ms = 0) => {
    await new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 6; i++) {
        await Promise.resolve();
    }

    await wrapper.vm.$nextTick();
};

const users = [{ id: 1, name: "Ana" }];

const pick = { value: "id", label: "name" };

/**
 * `debounce` fica **fora** do `defaults` do componente — um `300` ali seria um
 * resultado truthy e a regra "não apaga" do `merger` engoliria todo
 * `:debounce="0"`. O `defineFieldDefaults` continua valendo, e é a leitura da prop
 * crua que devolve o `0` à tag.
 */
describe("a prop debounce do RSelect", () => {
    it("é padronizada no app inteiro pelo defineFieldDefaults", async () => {
        const options = vi.fn(() => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("an");
        await settle(wrapper, 200);

        // 200ms ainda não são os 500 que o app pediu.
        expect(options).toHaveBeenCalledTimes(1);

        await settle(wrapper, 400);

        expect(options).toHaveBeenCalledTimes(2);
    });

    // É este o caso que a leitura da prop crua existe para salvar: o `500` do app é
    // o resultado truthy que a regra "não apaga" protegeria.
    it("é desligada na tag sobre o que o defineFieldDefaults padronizou", async () => {
        const options = vi.fn(() => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("an");
        await settle(wrapper);

        expect(options).toHaveBeenCalledTimes(2);
    });
});