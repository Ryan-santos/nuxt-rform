import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import schema from "../../src/runtime/presets/rules/schema";

// Espião sobre a conversão, delegando ao zod de verdade: é o que mede o cache.
vi.mock("zod", async (importOriginal) => {
    const actual = await importOriginal<typeof import("zod")>();

    return { ...actual, z: { ...actual.z, fromJSONSchema: vi.fn(actual.z.fromJSONSchema) } };
});

const run = (value: unknown, args: Record<string, unknown>) =>
    (schema.validation as (c: Record<string, unknown>) => unknown)({ ...args, value, form: {} });

describe("preset schema", () => {
    beforeEach(() => {
        vi.mocked(z.fromJSONSchema).mockClear();
    });

    it("valida pattern", () => {
        const pedido = { schema: { type: "string", pattern: "^PED-[0-9]{6}$" } };

        expect(run("PED-123456", pedido)).toBeUndefined();
        expect(run("PED-12", pedido)).toContain("pattern");
    });

    it("valida integer com minimum e maximum", () => {
        const quantidade = { schema: { type: "integer", minimum: 1, maximum: 999 } };

        expect(run(0, quantidade)).toBeTypeOf("string");
        expect(run(1.5, quantidade)).toBeTypeOf("string");
        expect(run(5, quantidade)).toBeUndefined();
    });

    it("deixa o vazio para o required", () => {
        const args = { schema: { type: "string", minLength: 3 } };

        for (const value of [undefined, null, "", "  "]) {
            expect(run(value, args)).toBeUndefined();
        }
    });

    it("troca qualquer issue pelo message", () => {
        const args = {
            schema: { type: "string", pattern: "^PED-" },
            message: "Formato PED-000000."
        };

        expect(run("x", args)).toBe("Formato PED-000000.");
        expect(run("PED-1", args)).toBeUndefined();
    });

    it("aceita schema booleano", () => {
        expect(run("x", { schema: false })).toBeTypeOf("string");
        expect(run("x", { schema: true })).toBeUndefined();
    });

    it("lança nomeando o motivo quando o zod não converte", () => {
        expect(() =>
            // `then` é keyword do JSON Schema, não um thenable.
            // oxlint-disable-next-line unicorn/no-thenable
            run("a", { schema: { if: { type: "string" }, then: { minLength: 2 } } })
        ).toThrow(/\[rform\].*Conditional/);
        expect(() => run("a", { schema: { $ref: "http://x/y" } })).toThrow(
            /\[rform\].*External \$ref/
        );
    });

    it("lança mesmo com o campo vazio", () => {
        expect(() => run("", { schema: { type: "strng" } })).toThrow(/\[rform\].*strng/);
    });

    it("converte uma vez por objeto de schema", () => {
        const same = { type: "string" };

        run("a", { schema: same });
        run("b", { schema: same });
        expect(z.fromJSONSchema).toHaveBeenCalledTimes(1);

        run("a", { schema: { type: "string" } });
        expect(z.fromJSONSchema).toHaveBeenCalledTimes(2);
    });
});