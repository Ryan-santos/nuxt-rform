import { describe, expect, it } from "vitest";

import mergerUI from "../../src/runtime/utils/mergerUI";

describe("mergerUI", () => {
    it("devolve undefined quando não há entrada válida", () => {
        expect(mergerUI(undefined, undefined)).toBeUndefined();
        expect(mergerUI()).toBeUndefined();
    });

    it("devolve o único valor quando só uma entrada é válida", () => {
        expect(mergerUI("p-4", undefined)).toBe("p-4");
    });

    it("resolve conflito de tailwind quando todas as entradas são string", () => {
        const result = mergerUI("p-2 text-red-500", "p-4");
        expect(result).toBe("text-red-500 p-4");
    });

    it("mescla recursivamente ui em forma de objeto", () => {
        const result = mergerUI(
            { root: "p-2", label: "text-red-500" },
            { root: "p-4", label: "text-blue-500" }
        );
        expect(result).toEqual({
            root: "p-4",
            label: "text-blue-500"
        });
    });

    it("grava null quando a origem é explicitamente null", () => {
        const result = mergerUI({ root: "p-2" }, { root: null });
        expect(result).toEqual({ root: null });
    });

    it("null zera a camada, e uma classe depois dele parte do zero", () => {
        const result = mergerUI({ root: "p-2 flex" }, { root: null }, { root: "grid" });
        expect(result).toEqual({ root: "grid" });
    });

    it("null dentro de um array zera o que veio antes e mantém o resto", () => {
        expect(mergerUI({ root: "p-2 flex" }, { root: [null, "grid"] })).toEqual({ root: "grid" });
        expect(mergerUI({ root: "p-2" }, { root: ["flex", null, "grid"] })).toEqual({
            root: "grid"
        });
    });

    it("array sem null mescla como string", () => {
        expect(mergerUI({ root: "p-2 flex" }, { root: ["p-4", "gap-2"] })).toEqual({
            root: "flex p-4 gap-2"
        });
    });

    it("null numa folha não toca as irmãs", () => {
        const result = mergerUI({ root: "p-2", label: "text-sm" }, { root: null });
        expect(result).toEqual({ root: null, label: "text-sm" });
    });

    it("desce em ui de objeto aninhado", () => {
        const result = mergerUI(
            { Utils: { Label: { root: "text-red-500" } } },
            { Utils: { Label: { root: "text-blue-500" } } }
        );
        expect(result).toEqual({
            Utils: { Label: { root: "text-blue-500" } }
        });
    });
});