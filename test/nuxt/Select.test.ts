import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RSelect } from "#components";

// O popover só monta o conteúdo no primeiro `open`, então toda asserção sobre
// opção precisa abri-lo antes — o mesmo clique que um usuário dá.
//
// Pelo `aria-haspopup`, e não por `findAll("div")[1]`: o índice no DOM quebra a
// cada mudança de markup, e o papel é o que o gatilho de fato é.
const open = async (wrapper: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) => {
    await wrapper.get('[aria-haspopup="listbox"]').trigger("click");
};

describe("RSelect", () => {
    it("transforma um array de primitivos em opções", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b", "c"] } as never
        });

        await open(wrapper);

        const items = wrapper.findAll('[role="option"]');
        expect(items).toHaveLength(3);
        expect(items.map((i) => i.text())).toEqual(["a", "b", "c"]);
    });

    it("transforma um objeto {chave: rótulo} em opções", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: { foo: "Foo Label", bar: "Bar Label" } } as never
        });

        await open(wrapper);

        const labels = wrapper.findAll('[role="option"]').map((li) => li.text());
        expect(labels).toContain("Foo Label");
        expect(labels).toContain("Bar Label");
    });

    it("seleciona um item no clique (single, primitivo)", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b"] } as never
        });

        await open(wrapper);
        await wrapper.findAll('[role="option"]')[1]!.trigger("click");
        const emits = wrapper.emitted("update:modelValue");
        expect(emits?.at(-1)?.[0]).toBe("b");
    });

    it("só renderiza a busca quando search é passado", async () => {
        const semBusca = await mountSuspended(RSelect, {
            props: { options: ["a", "b"] } as never
        });

        await open(semBusca);
        expect(semBusca.findAll("input[type=search]")).toHaveLength(0);
        expect(semBusca.findAll('[role="option"]')).toHaveLength(2);

        const comBusca = await mountSuspended(RSelect, {
            props: { options: ["a", "b"], search: true } as never
        });

        await open(comBusca);
        expect(comBusca.findAll("input[type=search]")).toHaveLength(1);
    });

    it("filtra as opções pelo termo digitado", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["alfa", "beta", "gama"], search: true } as never
        });

        await open(wrapper);
        await wrapper.find("input[type=search]").setValue("ga");

        expect(wrapper.findAll('[role="option"]').map((li) => li.text())).toEqual(["gama"]);
    });

    it("reporta o termo digitado pelo @search", async () => {
        const onSearch = vi.fn();

        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["alfa", "beta"], search: true, onSearch } as never
        });

        await open(wrapper);
        await wrapper.find("input[type=search]").setValue("be");

        expect(onSearch).toHaveBeenCalledWith("be");
    });

    // A lista que voltou já é a resposta ao termo. Filtrar de novo esconderia o
    // item que o servidor casou por um campo que não é a label.
    it("deixa o filtro com quem escuta o @search", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: {
                options: ["alfa", "beta", "gama"],
                search: true,
                onSearch: () => {}
            } as never
        });

        await open(wrapper);
        await wrapper.find("input[type=search]").setValue("ga");

        expect(wrapper.findAll('[role="option"]').map((li) => li.text())).toEqual([
            "alfa",
            "beta",
            "gama"
        ]);
    });

    // O termo só nasce no input, então sem isso um `@search` sem `search` ao lado
    // nunca dispararia — calado.
    it("liga a busca sozinho quando há @search", async () => {
        const onSearch = vi.fn();

        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["alfa", "beta"], onSearch } as never
        });

        await open(wrapper);

        const input = wrapper.find("input[type=search]");
        expect(input.exists()).toBe(true);

        await input.setValue("al");
        expect(onSearch).toHaveBeenCalledWith("al");
    });

    it("guarda as seleções num array quando multiple é true", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b"], multiple: true, modelValue: [] } as never
        });

        await open(wrapper);
        await wrapper.findAll('[role="option"]')[0]!.trigger("click");
        const emits = wrapper.emitted("update:modelValue");
        expect(Array.isArray(emits?.at(-1)?.[0])).toBe(true);
        expect(emits?.at(-1)?.[0]).toEqual(["a"]);
    });
});