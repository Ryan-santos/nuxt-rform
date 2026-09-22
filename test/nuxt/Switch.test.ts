import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

// O fixture substitui o `Switch` embutido, então a tag `RSwitch` resolve para o
// componente do usuário — o embutido só chega aqui pelo alias.
import RSwitch from "#rform/builtin/fields/Switch.vue";

describe("RSwitch", () => {
    it("resolve o placeholder pelo tr em vez de imprimir a chave", async () => {
        const wrapper = await mountSuspended(RSwitch, {
            props: { placeholder: "rform.presets.rules.required" } as never
        });

        expect(wrapper.text()).toContain("Campo obrigatório.");
        expect(wrapper.text()).not.toContain("rform.presets.rules.required");
    });

    it("escreve no model o que o checkbox marca", async () => {
        const wrapper = await mountSuspended(RSwitch, {
            props: { modelValue: false } as never
        });

        await wrapper.find("input").setValue(true);
        await nextTick();

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe(true);
    });
});