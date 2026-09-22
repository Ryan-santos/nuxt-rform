import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";

import { RNumber } from "#components";

const typed = async (text: string, modelValue: unknown = 0) => {
    const wrapper = await mountSuspended(RNumber, {
        props: { modelValue } as never
    });

    await wrapper.find("input").setValue(text);
    await nextTick();

    return wrapper.emitted("update:modelValue")?.at(-1)?.[0];
};

describe("RNumber", () => {
    it("emite número, com decimais, a partir do que se digita", async () => {
        expect(await typed("3.5")).toBe(3.5);
    });

    it("emite 0 quando se digita 0, sem cair no default", async () => {
        expect(await typed("0", 7)).toBe(0);
    });

    it("emite vazio quando o campo é limpo — o default não volta por cima", async () => {
        expect(await typed("", 7)).toBe("");
    });
});