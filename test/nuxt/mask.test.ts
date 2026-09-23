import { mountSuspended } from "@nuxt/test-utils/runtime";
import { mount } from "@vue/test-utils";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";

import { RDate, RHour, RText, RTextarea } from "#components";

import vMask from "../../src/runtime/utils/vMask";

const typeInto = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return el.value;
};

describe("mask no RText", () => {
    // Sem `await` nenhum entre montar e ler: as masks são importadas estaticamente,
    // então o preset já está resolvido no primeiro render. Antes elas vinham do
    // `#rform/presets`, e esperá-las era o último motivo de o `setup` ser async — o
    // nome cru iria para o maska por um tique. Ver "useField" no `.claude/CLAUDE.md`.
    it("resolve o preset já no primeiro render, sem passar por um tique", () => {
        const wrapper = mount(RText, {
            props: { mask: "brCpf", modelValue: "" } as never
        });

        // `mount` síncrono e nenhum `await` até aqui: com o preset ainda por carregar,
        // o maska teria recebido a string "brCpf" como pattern, toda de literais.
        expect(typeInto(wrapper.find("input").element, "52998224725")).toBe("529.982.247-25");
    });

    it("formata por nome de preset", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { mask: "brCpf", modelValue: "" } as never
        });

        const input = wrapper.find("input");
        await input.setValue("52998224725");

        expect((input.element as HTMLInputElement).value).toBe("529.982.247-25");
    });

    it("formata por pattern maska cru", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { mask: "(##) #####-####", modelValue: "" } as never
        });

        const input = wrapper.find("input");
        await input.setValue("11987654321");

        expect((input.element as HTMLInputElement).value).toBe("(11) 98765-4321");
    });

    it("deixa o valor em paz quando nenhuma mask é passada", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { modelValue: "" } as never
        });

        const input = wrapper.find("input");
        await input.setValue("52998224725");

        expect((input.element as HTMLInputElement).value).toBe("52998224725");
    });
});

describe("mask no RTextarea", () => {
    it("formata por nome de preset", async () => {
        const wrapper = await mountSuspended(RTextarea, {
            props: { mask: "brCpf", modelValue: "" } as never
        });

        const textarea = wrapper.find("textarea");
        await textarea.setValue("52998224725");

        expect((textarea.element as HTMLTextAreaElement).value).toBe("529.982.247-25");
    });

    it("formata por pattern maska cru", async () => {
        const wrapper = await mountSuspended(RTextarea, {
            props: { mask: "(##) #####-####", modelValue: "" } as never
        });

        const textarea = wrapper.find("textarea");
        await textarea.setValue("11987654321");

        expect((textarea.element as HTMLTextAreaElement).value).toBe("(11) 98765-4321");
    });

    it("deixa o valor em paz quando nenhuma mask é passada", async () => {
        const wrapper = await mountSuspended(RTextarea, {
            props: { modelValue: "" } as never
        });

        const textarea = wrapper.find("textarea");
        await textarea.setValue("linha um\nlinha dois");

        expect((textarea.element as HTMLTextAreaElement).value).toBe("linha um\nlinha dois");
    });

    it("emite o valor mascarado pelo update:modelValue", async () => {
        const wrapper = await mountSuspended(RTextarea, {
            props: { mask: "brCpf", modelValue: "" } as never
        });

        await wrapper.find("textarea").setValue("52998224725");

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe("529.982.247-25");
    });
});

describe("o vMask liga só no elemento em que está", () => {
    it("não alcança um campo filho a partir de um wrapper", () => {
        const Wrapper = defineComponent({
            directives: { mask: vMask },
            template: `<div v-mask="'##-##'"><input></div>`
        });

        const wrapper = mount(Wrapper);
        const input = wrapper.find("input").element as HTMLInputElement;

        expect(typeInto(input, "5678")).toBe("5678");
    });

    it("avisa em vez de falhar calado quando posto num elemento que não é campo", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const Wrapper = defineComponent({
            directives: { mask: vMask },
            template: `<div v-mask="'##-##'"><input></div>`
        });

        mount(Wrapper);

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("v-mask"), expect.anything());

        warn.mockRestore();
    });

    it("para de mascarar o campo quando a diretiva desmonta", () => {
        const Host = defineComponent({
            directives: { mask: vMask },
            template: `<input v-mask="'##-##'">`
        });

        const wrapper = mount(Host, { attachTo: document.body });
        const input = wrapper.find("input").element as HTMLInputElement;

        expect(typeInto(input, "5678")).toBe("56-78");

        wrapper.unmount();

        expect(typeInto(input, "1234")).toBe("1234");
    });

    it("não deixa listener vivo num filho quando o wrapper desmonta", () => {
        const show = ref(true);

        const Wrapper = defineComponent({
            directives: { mask: vMask },
            setup: () => ({ show }),
            template: `<div v-mask="'##-##'"><input v-if="show"></div>`
        });

        const wrapper = mount(Wrapper, { attachTo: document.body });
        const input = wrapper.find("input").element as HTMLInputElement;

        wrapper.unmount();

        expect(typeInto(input, "5678")).toBe("5678");
    });
});

describe("mask mudando em runtime", () => {
    it("reformata o valor que já está no campo", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { mask: "brCpf", modelValue: "" } as never
        });

        const input = wrapper.find("input");
        await input.setValue("52998224725");
        expect((input.element as HTMLInputElement).value).toBe("529.982.247-25");

        await wrapper.setProps({ mask: "brCnpj" } as never);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect((input.element as HTMLInputElement).value).toBe("52.998.224/725");
    });

    it("para de mascarar quando a mask é removida", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { mask: "brCpf", modelValue: "" } as never
        });

        const input = wrapper.find("input");
        await wrapper.setProps({ mask: undefined } as never);

        await input.setValue("52998224725");

        expect((input.element as HTMLInputElement).value).toBe("52998224725");
    });
});

describe("mask nos componentes de data e hora", () => {
    it("mascara o campo de hora", async () => {
        const wrapper = await mountSuspended(RHour, { props: {} as never });

        const input = wrapper.find("input");
        await input.setValue("1230");

        expect((input.element as HTMLInputElement).value).toBe("12:30");
    });

    it("mascara o campo de data", async () => {
        const wrapper = await mountSuspended(RDate, { props: {} as never });

        const input = wrapper.findAll("input").at(-1)!;
        await input.setValue("01012026");

        expect((input.element as HTMLInputElement).value).toBe("01/01/2026");
    });

    it("alarga a mask de data quando time é ligado", async () => {
        const wrapper = await mountSuspended(RDate, {
            props: { name: "quando", time: true } as never
        });

        const input = wrapper.find('input[name="quando"]');
        await input.setValue("010120261430");

        expect((input.element as HTMLInputElement).value).toBe("01/01/2026 14:30");
    });

    it("para de mascarar o campo de hora quando o componente desmonta", async () => {
        const wrapper = await mountSuspended(RHour, { props: {} as never });

        const input = wrapper.find("input").element as HTMLInputElement;
        expect(typeInto(input, "1230")).toBe("12:30");

        wrapper.unmount();

        expect(typeInto(input, "0945")).toBe("0945");
    });
});