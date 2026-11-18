import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, reactive } from "vue";
import { z } from "zod";

import { RArray, RForm, RText } from "#components";

describe("RArray", () => {
    it("renderiza um <li> por item, mais o botão de adicionar", async () => {
        const Item = defineComponent({
            props: ["item", "index"],
            setup: (p) => () => h("span", { "data-testid": `item-${p.index}` }, String(p.item))
        });

        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: ["x", "y"] } as never,
            slots: {
                default: (scope: { item: unknown; index: number }) =>
                    h(Item, { item: scope.item, index: scope.index })
            }
        });

        expect(wrapper.findAll('[data-testid^="item-"]')).toHaveLength(2);
        expect(wrapper.find('[data-action="add"]').exists()).toBe(true);
    });

    it("empurra uma entrada nova no array do model ao clicar em adicionar", async () => {
        const arr: unknown[] = ["a"];
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: arr } as never,
            slots: { default: () => h("span") }
        });

        await wrapper.get('[data-action="add"]').trigger("click");
        await nextTick();
        expect(arr).toHaveLength(2);
    });

    it("esconde o botão de adicionar quando o max é atingido", async () => {
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: ["a", "b"], max: 2 } as never,
            slots: { default: () => h("span") }
        });

        expect(wrapper.find('[data-action="add"]').exists()).toBe(false);
    });

    it("esconde o botão de remover quando o tamanho iguala o min", async () => {
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: ["only"], min: 1 } as never,
            slots: { default: () => h("span") }
        });

        expect(wrapper.findAll('[data-action="remove"]')).toHaveLength(0);
    });

    it("renderiza o erro do próprio container, e não só o dos filhos", async () => {
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: ["a"], error: "rform.presets.rules.required" } as never,
            slots: { default: () => h("span") }
        });

        expect(wrapper.find(".RUtilsError").text()).toBe("Campo obrigatório.");
    });
});

describe("RArray, remover e reordenar", () => {
    const text = (scope: { item: unknown; index: number }) =>
        h("span", { class: "item" }, String(scope.item));

    it("remove o item da linha clicada, não o último", async () => {
        // Reativo, como o pai de um `v-model` entrega: cru, o DOM não acompanharia.
        const arr = reactive(["a", "b", "c"]);
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: arr } as never,
            slots: { default: text }
        });

        await wrapper.findAll('[data-action="remove"]')[1]!.trigger("click");
        await nextTick();

        expect(arr).toEqual(["a", "c"]);
        expect(wrapper.findAll(".item").map((item) => item.text())).toEqual(["a", "c"]);
    });

    it("o remover é um botão com rótulo, e respeita o disabled", async () => {
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: ["a"], disabled: true } as never,
            slots: { default: text }
        });

        const remove = wrapper.get('[data-action="remove"]');
        expect(remove.element.tagName).toBe("BUTTON");
        expect(remove.attributes("aria-label")).toBe("Remover");
        expect(remove.attributes("disabled")).toBeDefined();
    });

    it("sem sortable não há botões de mover", async () => {
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: ["a", "b"] } as never,
            slots: { default: text }
        });

        expect(wrapper.find('[data-action="up"]').exists()).toBe(false);
    });

    it("com sortable, desce e sobe o item, e trava nas pontas", async () => {
        const arr = ["a", "b", "c"];
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: arr, sortable: true } as never,
            slots: { default: text }
        });

        const ups = wrapper.findAll('[data-action="up"]');
        const downs = wrapper.findAll('[data-action="down"]');
        expect(ups[0]!.attributes("disabled")).toBeDefined();
        expect(downs[2]!.attributes("disabled")).toBeDefined();

        await downs[0]!.trigger("click");
        await nextTick();
        expect(arr).toEqual(["b", "a", "c"]);

        await wrapper.findAll('[data-action="up"]')[2]!.trigger("click");
        await nextTick();
        expect(arr).toEqual(["b", "c", "a"]);
    });
});

describe("RArray, o erro segue o item", () => {
    type Scope = { setErrors: (input?: Record<string, unknown>) => Promise<void> };

    const mount = async (sortable: boolean) => {
        let scope: Scope | undefined;
        const data = { itens: ["a", "b", "c"] };

        const wrapper = await mountSuspended(RForm, {
            props: { modelValue: data } as never,
            slots: {
                default: (received: Record<string, unknown>) => {
                    scope = received as unknown as Scope;
                    return h(RArray, { name: "itens", sortable } as never, {
                        default: ({ index }: { index: number }) =>
                            h(RText, { name: index } as never)
                    });
                }
            }
        });

        const settle = async () => {
            await nextTick();
            await nextTick();
        };

        await scope!.setErrors({ "itens.2": "Erro do c" });
        await settle();

        const rowWithError = () =>
            wrapper.findAll("li").findIndex((row) => row.text().includes("Erro do c"));

        return { wrapper, data, settle, rowWithError };
    };

    it("remover uma linha acima renumera o erro", async () => {
        const { wrapper, data, settle, rowWithError } = await mount(false);
        expect(rowWithError()).toBe(2);

        await wrapper.findAll('[data-action="remove"]')[1]!.trigger("click");
        await settle();

        expect(data.itens).toEqual(["a", "c"]);
        expect(rowWithError()).toBe(1);
    });

    it("remover a linha com erro leva o erro junto", async () => {
        const { wrapper, settle } = await mount(false);

        await wrapper.findAll('[data-action="remove"]')[2]!.trigger("click");
        await settle();

        expect(wrapper.text()).not.toContain("Erro do c");
    });

    it("mover a linha leva o erro junto", async () => {
        const { wrapper, data, settle, rowWithError } = await mount(true);

        await wrapper.findAll('[data-action="up"]')[2]!.trigger("click");
        await settle();

        expect(data.itens).toEqual(["a", "c", "b"]);
        expect(rowWithError()).toBe(1);
    });
});
describe("RArray, arrastar", () => {
    const text = (scope: { item: unknown; index: number }) =>
        h("span", { class: "item" }, String(scope.item));

    // O happy-dom não tem layout: cada linha ganha 40px, empilhadas a partir do 0.
    const layout = (wrapper: { findAll: (selector: string) => { element: Element }[] }) => {
        wrapper.findAll("li").forEach(({ element }, index) => {
            element.getBoundingClientRect = () =>
                ({
                    top: index * 40,
                    height: 40,
                    bottom: index * 40 + 40,
                    left: 0,
                    width: 200
                }) as DOMRect;
        });
    };

    const pointer = (type: string, clientY: number) =>
        new PointerEvent(type, {
            pointerId: 1,
            button: 0,
            clientX: 10,
            clientY,
            bubbles: true,
            pointerType: "mouse"
        });

    it("solta a primeira linha depois da última", async () => {
        const arr = reactive(["a", "b", "c"]);
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: arr, sortable: true } as never,
            slots: { default: text },
            attachTo: document.body
        });
        layout(wrapper);

        const handle = wrapper.findAll('[data-action="drag"]')[0]!.element;
        handle.dispatchEvent(pointer("pointerdown", 20));
        handle.dispatchEvent(pointer("pointermove", 110));
        await nextTick();

        expect(document.querySelector("[data-drag-ghost]")).not.toBeNull();
        expect(wrapper.findAll("li")[2]!.classes()).toContain("after:bg-(--rf-color-primary)");

        handle.dispatchEvent(pointer("pointerup", 110));
        await nextTick();

        expect(arr).toEqual(["b", "c", "a"]);
        expect(document.querySelector("[data-drag-ghost]")).toBeNull();
        wrapper.unmount();
    });

    it("soltar no mesmo lugar não muda nada, e um toque sem arrastar também não", async () => {
        const arr = reactive(["a", "b", "c"]);
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: arr, sortable: true } as never,
            slots: { default: text }
        });
        layout(wrapper);

        const handle = wrapper.findAll('[data-action="drag"]')[1]!.element;
        handle.dispatchEvent(pointer("pointerdown", 60));
        handle.dispatchEvent(pointer("pointermove", 70));
        handle.dispatchEvent(pointer("pointerup", 70));
        await nextTick();
        expect(arr).toEqual(["a", "b", "c"]);

        handle.dispatchEvent(pointer("pointerdown", 60));
        handle.dispatchEvent(pointer("pointerup", 60));
        await nextTick();
        expect(arr).toEqual(["a", "b", "c"]);
    });

    it("Escape cancela o arraste", async () => {
        const arr = reactive(["a", "b", "c"]);
        const wrapper = await mountSuspended(RArray, {
            props: { modelValue: arr, sortable: true } as never,
            slots: { default: text }
        });
        layout(wrapper);

        const handle = wrapper.findAll('[data-action="drag"]')[0]!.element;
        handle.dispatchEvent(pointer("pointerdown", 20));
        handle.dispatchEvent(pointer("pointermove", 110));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        handle.dispatchEvent(pointer("pointerup", 110));
        await nextTick();

        expect(arr).toEqual(["a", "b", "c"]);
        expect(document.querySelector("[data-drag-ghost]")).toBeNull();
    });
});
describe("RArray, sortable escolhe a forma", () => {
    const text = (scope: { item: unknown; index: number }) => h("span", String(scope.item));

    const mount = (sortable: unknown) =>
        mountSuspended(RArray, {
            props: { modelValue: ["a", "b"], sortable } as never,
            slots: { default: text }
        });

    const forms = (wrapper: Awaited<ReturnType<typeof mount>>) => ({
        arrows: wrapper.find('[data-action="up"]').exists(),
        drag: wrapper.find('[data-action="drag"]').exists()
    });

    it("true liga as setas e o arrastar", async () => {
        expect(forms(await mount(true))).toEqual({ arrows: true, drag: true });
    });

    it('"arrows" liga só as setas', async () => {
        expect(forms(await mount("arrows"))).toEqual({ arrows: true, drag: false });
    });

    it('"drag" liga só o arrastar', async () => {
        expect(forms(await mount("drag"))).toEqual({ arrows: false, drag: true });
    });

    // `Boolean` antes de `String`: o atributo sem valor chega `true`, e não `""`.
    it("a forma curta vale true", () => {
        const decl = (RArray as { props?: Record<string, { type?: unknown }> }).props;

        expect(decl?.sortable?.type).toEqual([Boolean, String]);
    });
});
describe("RArray, min e max saem da rule", () => {
    const mount = (props: Record<string, unknown>) =>
        mountSuspended(RArray, {
            props: props as never,
            slots: { default: () => h("span") }
        });

    const rule = [
        { name: "min", min: 2 },
        { name: "max", max: 2 }
    ];

    it("sem as props, o limite vem do preset da rule", async () => {
        const wrapper = await mount({ modelValue: ["a", "b"], rule });

        expect(wrapper.find('[data-action="remove"]').exists()).toBe(false);
        expect(wrapper.find('[data-action="add"]').exists()).toBe(false);
    });

    it("a prop escrita vence a rule", async () => {
        const wrapper = await mount({ modelValue: ["a", "b"], rule, min: 0, max: 5 });

        expect(wrapper.find('[data-action="remove"]').exists()).toBe(true);
        expect(wrapper.find('[data-action="add"]').exists()).toBe(true);
    });

    it("um schema zod também dá o limite", async () => {
        const wrapper = await mount({
            modelValue: ["a", "b"],
            rule: z.array(z.string()).min(2).max(2)
        });

        expect(wrapper.find('[data-action="remove"]').exists()).toBe(false);
        expect(wrapper.find('[data-action="add"]').exists()).toBe(false);
    });

    it("um preset sozinho, fora de array, também conta", async () => {
        const wrapper = await mount({ modelValue: ["a"], rule: { name: "min", min: 1 } });

        expect(wrapper.find('[data-action="remove"]').exists()).toBe(false);
    });
});
describe("RArray vindo de schema", () => {
    it("o RDynamic entrega a rule, e os limites saem dela nos três formatos", async () => {
        const child = { type: "text" };
        const wrapper = await mountSuspended(RForm, {
            props: {
                modelValue: { preset: ["a", "b"], zod: ["a", "b"], json: ["a", "b"] },
                schema: {
                    preset: { type: "array", rule: { name: "min", min: 2 }, children: child },
                    zod: { type: "array", rule: z.array(z.string()).min(2), children: child },
                    json: {
                        type: "array",
                        rule: { name: "schema", schema: { type: "array", minItems: 2 } },
                        children: child
                    }
                }
            } as never
        });
        await nextTick();

        const arrays = wrapper.findAll(".RArray");
        expect(arrays).toHaveLength(3);
        for (const array of arrays) {
            expect(array.findAll("li")).toHaveLength(3);
            expect(array.find('[data-action="remove"]').exists()).toBe(false);
        }
    });
});

describe("RArray, o min semeia as linhas", () => {
    const mount = (props: Record<string, unknown>) =>
        mountSuspended(RArray, {
            props: props as never,
            slots: { default: () => h("span") }
        });

    it("a lista vazia nasce com min linhas", async () => {
        const arr = reactive<unknown[]>([]);
        const wrapper = await mount({ modelValue: arr, min: 2 });

        expect(arr).toHaveLength(2);
        // Duas linhas mais a do Adicionar.
        expect(wrapper.findAll("li")).toHaveLength(3);
    });

    it("o min que sai da rule também semeia", async () => {
        const arr = reactive<unknown[]>(["a"]);
        await mount({ modelValue: arr, rule: z.array(z.string()).min(3) });

        expect(arr).toEqual(["a", undefined, undefined]);
    });

    it("não mexe numa lista que já cumpre o min", async () => {
        const arr = reactive(["a", "b", "c"]);
        await mount({ modelValue: arr, min: 2 });

        expect(arr).toEqual(["a", "b", "c"]);
    });

    it("volta a semear quando o model encolhe por fora", async () => {
        const arr = reactive(["a", "b"]);
        await mount({ modelValue: arr, min: 2 });

        arr.splice(0, 2);
        await nextTick();

        expect(arr).toHaveLength(2);
    });
});