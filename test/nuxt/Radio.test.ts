import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { h, nextTick, ref, type Component } from "vue";

import { RForm, RRadio } from "#components";

describe("RRadio", () => {
    it("renderiza um array de primitivos", async () => {
        const wrapper = await mountSuspended(RRadio, {
            props: { options: ["a", "b", "c"] } as never
        });

        expect(wrapper.findAll("input[type=radio]")).toHaveLength(3);
        expect(wrapper.findAll("label").map((label) => label.text())).toEqual(["a", "b", "c"]);
    });

    it("lê um array de objetos pelo pick e escreve o valor, não a string do DOM", async () => {
        const wrapper = await mountSuspended(RRadio, {
            props: {
                options: [
                    { codigo: 1, nome: "Básico" },
                    { codigo: 2, nome: "Pro" }
                ],
                pick: { value: "codigo", label: "nome" }
            } as never
        });

        expect(wrapper.text()).toContain("Básico");

        await wrapper.findAll("input")[1]!.trigger("change");

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe(2);
    });

    it("transforma um objeto {chave: rótulo} em opções", async () => {
        const wrapper = await mountSuspended(RRadio, {
            props: { options: { pf: "Pessoa física", pj: "Pessoa jurídica" } } as never
        });

        expect(wrapper.text()).toContain("Pessoa jurídica");

        await wrapper.findAll("input")[1]!.trigger("change");

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe("pj");
    });

    it("marca a opção que está no model, e só ela", async () => {
        const wrapper = await mountSuspended(RRadio, {
            props: { options: ["a", "b"], modelValue: "b" } as never
        });

        const inputs = wrapper.findAll<HTMLInputElement>("input");
        expect(inputs[0]!.element.checked).toBe(false);
        expect(inputs[1]!.element.checked).toBe(true);
    });

    it("agrupa os inputs pelo mesmo name nativo", async () => {
        const wrapper = await mountSuspended(RRadio, {
            props: { options: ["a", "b"] } as never
        });

        const names = wrapper.findAll("input").map((input) => input.attributes("name"));
        expect(names[0]).toBeTruthy();
        expect(names[0]).toBe(names[1]);
    });

    it("repassa disabled a cada input", async () => {
        const wrapper = await mountSuspended(RRadio, {
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
                        RRadio as unknown as Component,
                        { name: "plano", options: ["mensal", "anual"] } as never
                    )
            }
        });

        await wrapper.findAll("input")[1]!.trigger("change");
        await nextTick();

        expect(data.value.plano).toBe("anual");
    });

    it("entrega a opção e o estado ao slot", async () => {
        const wrapper = await mountSuspended(RRadio, {
            props: { options: ["a"], modelValue: "a" } as never,
            slots: {
                default: (scope: { option: { label: unknown }; checked: boolean }) =>
                    `${String(scope.option.label)}:${scope.checked}`
            }
        });

        expect(wrapper.text()).toContain("a:true");
    });
});