import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RText } from "#components";

vi.mock("#rform/defaults", () => ({
    default: {
        Text: { required: false }
    }
}));

/** Um `false` do app desliga a derivação para o tipo inteiro; a tag ainda religa. */
describe("o required derivado, com o defineFieldDefaults", () => {
    it("é desligado pelo default do app", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { label: "~~Nome", rule: "required" } as never
        });

        expect(wrapper.find("label").text()).not.toContain("*");
    });

    it("volta com o required da tag", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { label: "~~Nome", rule: "required", required: true } as never
        });

        expect(wrapper.find("label").text()).toContain("*");
    });
});