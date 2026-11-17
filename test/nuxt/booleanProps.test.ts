// @vitest-environment nuxt
import { describe, expect, it } from "vitest";

type PropOptions = { type?: unknown; default?: unknown };

const components = import.meta.glob<{ default: { props?: Record<string, PropOptions> } }>(
    ["../../src/runtime/components/fields/*.vue", "../../src/runtime/components/Form.vue"],
    { eager: true }
);

const isBoolean = (type: unknown) =>
    type === Boolean || (Array.isArray(type) && type.includes(Boolean));

const booleans = Object.entries(components).flatMap(([file, mod]) =>
    Object.entries(mod.default.props ?? {})
        .filter(([, options]) => isBoolean(options?.type))
        .map(([prop, options]) => ({
            name: `${file.split("/").pop()!.replace(".vue", "")}.${prop}`,
            options
        }))
);

/**
 * Sem `default` declarado, o boolean casting do Vue faz a prop ausente chegar
 * `false`, e o `merger` aceita `false`: ela apagaria o `defaults` e o
 * `defineFieldDefaults` de todo campo que não a escrevesse. O `undefined` no
 * `withDefaults` é o que mantém "não declarei" distinto de "declarei desligado".
 */
describe("props booleanas dos campos", () => {
    it("varre os campos", () => {
        expect(booleans.map(({ name }) => name)).toEqual(
            expect.arrayContaining(["Select.multiple", "File.multiple", "Form.focusError"])
        );
    });

    it.each(booleans)("$name declara default undefined", ({ options }) => {
        expect(Object.hasOwn(options, "default")).toBe(true);
        expect(options.default).toBeUndefined();
    });
});