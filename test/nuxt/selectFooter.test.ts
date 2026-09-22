import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RSelect } from "#components";

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

const users = [
    { id: 1, name: "Ana" },
    { id: 2, name: "Bruno" },
    { id: 3, name: "Carla" }
];

const pick = { value: "id", label: "name" };

type Button = {
    text: () => string;
    trigger: (e: string) => Promise<void>;
    attributes: (n: string) => string | undefined;
};

/** O botão de limpar do rodapé. O X do campo não tem texto, só `aria-label`. */
const footerClear = (wrapper: { findAll: (s: string) => Button[] }): Button => {
    const found = wrapper.findAll("button").find((b) => b.text() === "Limpar");

    if (!found) {
        throw new Error("clear button not found");
    }

    return found;
};

/**
 * O rodapé do painel: o total de linhas e um botão que esvazia a seleção. Existe
 * em todo `RSelect`, remoto ou não — limpar é o único gesto que a lista não tinha.
 */
describe("o rodapé do RSelect", () => {
    it("mostra o total de linhas, no plural certo", async () => {
        const tres = await mountSuspended(RSelect, {
            props: { options: users, pick } as never
        });

        await open(tres);

        expect(tres.text()).toContain("3 itens");

        const um = await mountSuspended(RSelect, {
            props: { options: users.slice(0, 1), pick } as never
        });

        await open(um);

        expect(um.text()).toContain("1 item");
        expect(um.text()).not.toContain("1 itens");
    });

    it("o total acompanha o filtro local", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, search: true, pick } as never
        });

        await open(wrapper);

        await wrapper.find("input[type=search]").setValue("an");
        await settle(wrapper);

        expect(wrapper.text()).toContain("1 item");
    });

    it("limpar esvazia a seleção: null sem multiple, [] com", async () => {
        const single = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, pick } as never
        });

        await open(single);

        await footerClear(single).trigger("click");

        expect(single.emitted("update:modelValue")?.at(-1)?.[0]).toBeNull();

        const multiple = await mountSuspended(RSelect, {
            props: { options: users, multiple: true, modelValue: [1, 2], pick } as never
        });

        await open(multiple);

        await footerClear(multiple).trigger("click");

        expect(multiple.emitted("update:modelValue")?.at(-1)?.[0]).toEqual([]);
    });

    it("o limpar fica desabilitado sem seleção", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, pick } as never
        });

        await open(wrapper);

        expect(footerClear(wrapper).attributes("disabled")).toBeDefined();
    });

    it("o slot footer substitui o rodapé inteiro e recebe count e clear", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 1, pick } as never,
            slots: {
                footer: `<template #footer="{ count, clear }"><button class="meu" @click="clear">{{ count }}</button></template>`
            }
        });

        await open(wrapper);

        expect(wrapper.text()).not.toContain("Limpar");
        expect(wrapper.get(".meu").text()).toBe("3");

        await wrapper.get(".meu").trigger("click");

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBeNull();
    });

    it("em modo remoto o total é o que já foi carregado", async () => {
        const options = vi.fn(() => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(wrapper.text()).toContain("3 itens");
    });

    it("…ou o que a API mandou no envelope { items, total }", async () => {
        const options = vi.fn(() => ({ items: users, total: 480 }));

        const wrapper = await mountSuspended(RSelect, {
            props: { options, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(wrapper.text()).toContain("480 itens");
        expect(wrapper.findAll('[role="option"]')).toHaveLength(3);
    });
});

/**
 * O X do campo: o mesmo `clear` do rodapé, sem abrir o painel. Só aparece com
 * seleção, e nunca com `disabled`.
 */
describe("o X de limpar no campo do RSelect", () => {
    const x = (wrapper: { find: (s: string) => { exists: () => boolean } }) =>
        wrapper.find('[aria-haspopup="listbox"] button[aria-label="Limpar"]');

    it("só existe com seleção", async () => {
        const vazio = await mountSuspended(RSelect, {
            props: { options: users, pick } as never
        });

        expect(x(vazio).exists()).toBe(false);

        const cheio = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, pick } as never
        });

        expect(x(cheio).exists()).toBe(true);
    });

    it("limpa sem abrir o painel", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, pick } as never
        });

        await wrapper.get('[aria-haspopup="listbox"] button[aria-label="Limpar"]').trigger("click");

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBeNull();
        expect(wrapper.get('[aria-haspopup="listbox"]').attributes("aria-expanded")).toBe("false");
    });

    it("some com disabled", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, disabled: true, pick } as never
        });

        expect(x(wrapper).exists()).toBe(false);
    });
});
/**
 * `clearable: false` recusa o gesto nos dois lugares, e tira os dois `<button>`
 * do DOM — esconder por classe deixaria a intenção numa camada de `ui`.
 */
describe("a prop clearable do RSelect", () => {
    const x = (wrapper: { find: (s: string) => { exists: () => boolean } }) =>
        wrapper.find('[aria-haspopup="listbox"] button[aria-label="Limpar"]');

    it("tira o X do campo", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, clearable: false, pick } as never
        });

        expect(x(wrapper).exists()).toBe(false);
    });

    it("tira o botão do rodapé do DOM, não o desabilita", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, clearable: false, pick } as never
        });

        await open(wrapper);

        expect(wrapper.findAll("button").some((b) => b.text() === "Limpar")).toBe(false);
    });

    it("mantém o total do rodapé", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, clearable: false, pick } as never
        });

        await open(wrapper);

        expect(wrapper.text()).toContain("3 itens");
    });
});