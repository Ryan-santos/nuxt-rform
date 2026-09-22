import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import { RColor } from "#components";

describe("RColor", () => {
    it("escreve no model o hex digitado no painel, ao sair do input", async () => {
        const wrapper = await mountSuspended(RColor, {
            props: { modelValue: "#000000" } as never
        });

        await wrapper.get(".RField > div").trigger("click");
        const hex = wrapper.get('input[maxlength="7"]');

        await hex.setValue("#ff0000");
        await hex.trigger("blur");
        await nextTick();

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe("#FF0000");
    });
});