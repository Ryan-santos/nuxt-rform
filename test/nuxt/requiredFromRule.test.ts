import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";

import { RDynamic, RForm, RText } from "#components";

import useRForm from "../../src/runtime/composables/useRForm";

const asterisk = (wrapper: { find: (s: string) => { text: () => string } }) =>
    wrapper.find("label").text().includes("*");

/**
 * A prop `required` sai da `rule` quando o call site não a escreve. O caso do
 * `defineFieldDefaults` mora em `requiredFromRuleDefaults.test.ts`, porque o mock é
 * do arquivo inteiro.
 */
describe("o required derivado da rule", () => {
    it("liga o asterisco com o preset required, em qualquer forma", async () => {
        for (const rule of [
            "required",
            { name: "required" },
            [{ name: "min", min: 3 }, "required"]
        ]) {
            const wrapper = await mountSuspended(RText, {
                props: { label: "~~Nome", rule } as never
            });
            expect(asterisk(wrapper)).toBe(true);
        }
    });

    it("não liga com outra rule, nem sem rule", async () => {
        const email = await mountSuspended(RText, {
            props: { label: "~~Nome", rule: "email" } as never
        });
        const none = await mountSuspended(RText, { props: { label: "~~Nome" } as never });

        expect(asterisk(email)).toBe(false);
        expect(asterisk(none)).toBe(false);
    });

    it('perde para o :required="false" da tag', async () => {
        const wrapper = await mountSuspended(RText, {
            props: { label: "~~Nome", rule: "required", required: false } as never
        });

        expect(asterisk(wrapper)).toBe(false);
    });

    it("acompanha a rule quando ela muda", async () => {
        const wrapper = await mountSuspended(RText, { props: { label: "~~Nome" } as never });

        await wrapper.setProps({ rule: "required" } as never);
        expect(asterisk(wrapper)).toBe(true);

        await wrapper.setProps({ rule: undefined } as never);
        expect(asterisk(wrapper)).toBe(false);
    });

    it("vale no modo schema", async () => {
        const form = useRForm({ nome: { type: "text", label: "~~Nome", rule: "required" } });

        const Host = defineComponent({
            setup: () => () =>
                h(RForm, { modelValue: form.data.value } as never, {
                    default: () => h(RDynamic, { schema: form.schema } as never)
                })
        });

        const wrapper = await mountSuspended(Host);
        await nextTick();

        expect(asterisk(wrapper)).toBe(true);
    });
});