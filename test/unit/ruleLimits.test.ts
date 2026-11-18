import { describe, expect, it } from "vitest";
import { z } from "zod";

import ruleLimits from "../../src/runtime/utils/ruleLimits";

describe("ruleLimits", () => {
    it("lê o preset por referência, solto ou num array", () => {
        expect(ruleLimits({ name: "min", min: 2 })).toEqual({ min: 2 });
        expect(ruleLimits([{ name: "min", min: 2 }, { name: "max", max: 4 }, "required"])).toEqual({
            min: 2,
            max: 4
        });
    });

    it("lê minItems e maxItems do JSON Schema do preset schema", () => {
        expect(
            ruleLimits({ name: "schema", schema: { type: "array", minItems: 2, maxItems: 4 } })
        ).toEqual({
            min: 2,
            max: 4
        });
        expect(ruleLimits({ name: "schema", schema: true })).toEqual({});
    });

    it("lê min, max, length e nonempty de um array zod", () => {
        expect(ruleLimits(z.array(z.string()).min(2).max(4))).toEqual({ min: 2, max: 4 });
        expect(ruleLimits(z.array(z.string()).length(3))).toEqual({ min: 3, max: 3 });
        expect(ruleLimits(z.array(z.string()).nonempty())).toEqual({ min: 1 });
    });

    it("atravessa optional, default e transform", () => {
        expect(ruleLimits(z.array(z.string()).min(2).optional())).toEqual({ min: 2 });
        expect(ruleLimits(z.array(z.string()).max(3).default([]))).toEqual({ max: 3 });
        expect(
            ruleLimits(
                z
                    .array(z.string())
                    .min(1)
                    .transform((v) => v)
            )
        ).toEqual({ min: 1 });
    });

    it("fica com o mais apertado entre as fontes", () => {
        expect(
            ruleLimits([
                { name: "min", min: 2 },
                z.array(z.string()).min(3).max(5),
                { name: "max", max: 4 }
            ])
        ).toEqual({
            min: 3,
            max: 4
        });
    });

    it("função e nada declarado não dão limite", () => {
        expect(ruleLimits(() => undefined)).toEqual({});
        expect(ruleLimits(undefined)).toEqual({});
        expect(ruleLimits(z.array(z.string()))).toEqual({});
    });
});