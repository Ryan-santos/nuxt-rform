import { describe, expect, it } from "vitest";
import { z } from "zod";

import hasRequiredRule from "../../src/runtime/utils/hasRequiredRule";

describe("hasRequiredRule", () => {
    it("reconhece o preset pelo nome, por referência e dentro de um array", () => {
        expect(hasRequiredRule("required")).toBe(true);
        expect(hasRequiredRule({ name: "required" })).toBe(true);
        expect(hasRequiredRule([{ name: "min", min: 3 }, "required"])).toBe(true);
    });

    it("não reconhece outro preset nem rule vazia", () => {
        expect(hasRequiredRule(undefined)).toBe(false);
        expect(hasRequiredRule(null)).toBe(false);
        expect(hasRequiredRule([])).toBe(false);
        expect(hasRequiredRule("email")).toBe(false);
        expect(hasRequiredRule([{ name: "min", min: 3 }])).toBe(false);
    });

    // Só o preset: o resto não diz "obrigatório" de um jeito legível.
    it("ignora função, zod e o preset schema", () => {
        expect(hasRequiredRule(({ value }: { value: unknown }) => (value ? undefined : "x"))).toBe(
            false
        );
        expect(hasRequiredRule(z.string().min(1))).toBe(false);
        expect(hasRequiredRule({ name: "schema", schema: { type: "string", minLength: 1 } })).toBe(
            false
        );
    });
});