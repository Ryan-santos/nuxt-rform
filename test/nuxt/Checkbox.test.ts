import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { h, nextTick, ref, type Component } from "vue";

import { RCheckbox, RForm } from "#components";

describe("RCheckbox sem options", () => {
    it("é um booleano, rotulado pelo placeholder", async () => {
        const wrapper = await mountSuspended(RCheckbox, {
            props: { placeholder: "rform.presets.rules.required" } as never
        });

        expect(wrapper.findAll("input[type=checkbox]")).toHaveLength(1);
        expect(wrapper.text()).toContain("Campo obrigatório.");

        await wrapper.find("input").setValue(true);

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe(true);
    });

    it("lê o model booleano", async () => {
        const wrapper = await mountSuspended(RCheckbox, {
            props: { modelValue: true } as never
        });

        expect(wrapper.find<HTMLInputElement>("input").element.checked).toBe(true);
    });
});

describe("RCheckbox com options", () => {
    it("marca e desmarca montando uma lista nova", async () => {
        const wrapper = await mountSuspended(RCheckbox, {
            props: { options: ["seg", "ter", "qua"], modelValue: ["ter"] } as never
        });

        const inputs = wrapper.findAll<HTMLInputElement>("input");
        expect(inputs.map((input) => input.element.checked)).toEqual([false, true, false]);

        await inputs[0]!.trigger("change");
        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual(["ter", "seg"]);

        await wrapper.setProps({ modelValue: ["ter", "seg"] } as never);
        await inputs[1]!.trigger("change");
        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual(["seg"]);
    });

    it("lê um array de objetos pelo pick, e guarda o valor", async () => {
        const wrapper = await mountSuspended(RCheckbox, {
            props: {
                options: [
                    { id: 10, name: "Leitura" },
                    { id: 20, name: "Escrita" }
                ]
            } as never
        });

        expect(wrapper.text()).toContain("Escrita");

        await wrapper.findAll("input")[1]!.trigger("change");
        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual([20]);
    });

    it("transforma um objeto {chave: rótulo} em opções", async () => {
        const wrapper = await mountSuspended(RCheckbox, {
            props: { options: { a: "Alfa", b: "Beta" } } as never
        });

        await wrapper.findAll("input")[0]!.trigger("change");
        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual(["a"]);
    });

    it("parte de lista vazia quando o model não é array", async () => {
        const wrapper = await mountSuspended(RCheckbox, {
            props: { options: ["a"] } as never
        });

        await wrapper.find("input").trigger("change");
        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual(["a"]);
    });

    it("repassa disabled a cada input", async () => {
        const wrapper = await mountSuspended(RCheckbox, {
            props: { options: ["a", "b"], disabled: true } as never
        });

        const inputs = wrapper.findAll("input");
        expect(inputs.every((input) => input.attributes("disabled") !== undefined)).toBe(true);
    });

    it("escreve no model do RForm pelo name", async () => {
        const data = ref<Record<string, unknown>>({});

        const wrapper = await mountSuspended(RForm, {
            props: {
                modelValue: data.value,
                "onUpdate:modelValue": (value: Record<string, unknown>) => {
                    data.value = value;
                }
            } as never,
            slots: {
                default: () =>
                    h(
                        RCheckbox as unknown as Component,
                        { name: "dias", options: ["seg", "ter"] } as never
                    )
            }
        });

        await wrapper.findAll("input")[1]!.trigger("change");
        await nextTick();

        expect(data.value.dias).toEqual(["ter"]);
    });

    it("parte de [] no model do RForm, sem tocar o campo", async () => {
        const data = ref<Record<string, unknown>>({});

        await mountSuspended(RForm, {
            props: {
                modelValue: data.value,
                "onUpdate:modelValue": (value: Record<string, unknown>) => {
                    data.value = value;
                }
            } as never,
            slots: {
                default: () =>
                    h(
                        RCheckbox as unknown as Component,
                        { name: "dias", options: ["seg", "ter"] } as never
                    )
            }
        });
        await nextTick();

        expect(data.value.dias).toEqual([]);
    });

    it("mantém o default em lista que o call site escreveu", async () => {
        const data = ref<Record<string, unknown>>({});

        await mountSuspended(RForm, {
            props: { modelValue: data.value } as never,
            slots: {
                default: () =>
                    h(
                        RCheckbox as unknown as Component,
                        {
                            name: "dias",
                            options: ["seg", "ter"],
                            default: ["ter"]
                        } as never
                    )
            }
        });
        await nextTick();

        expect(data.value.dias).toEqual(["ter"]);
    });
});