import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RSelect } from "#components";

// O mock é do arquivo inteiro, então os casos sem defaults do app moram no
// `Select.test.ts`.
vi.mock("#rform/defaults", () => ({
    default: {
        Select: { closeOnSelect: true }
    }
}));

const trigger = '[aria-haspopup="listbox"]';

const pickFirst = async (wrapper: {
    get: (s: string) => { trigger: (e: string) => Promise<void> };
    findAll: (s: string) => { trigger: (e: string) => Promise<void> }[];
}) => {
    await wrapper.get(trigger).trigger("click");
    await wrapper.findAll('[role="option"]')[0]!.trigger("click");
};

/**
 * O app padroniza, e o `false` da tag vence o `true` dele: o `merger` só pula
 * `undefined`.
 */
describe("closeOnSelect do RSelect pelo defineFieldDefaults", () => {
    it("o app liga, e o multiple fecha", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b"], multiple: true, modelValue: [] } as never
        });

        await pickFirst(wrapper);

        expect(wrapper.get(trigger).attributes("aria-expanded")).toBe("false");
    });

    it("false na tag vence o true do app", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b"], closeOnSelect: false } as never
        });

        await pickFirst(wrapper);

        expect(wrapper.get(trigger).attributes("aria-expanded")).toBe("true");
    });
});