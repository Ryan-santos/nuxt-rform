import { describe, expect, it } from "vitest";

import merger from "../../src/runtime/utils/merger";

describe("merger", () => {
    it("devolve o primeiro objeto quando só um é passado", () => {
        const a = { foo: 1 };
        const result = merger(a);
        expect(result).toEqual({ foo: 1 });
    });

    it("mescla chaves planas, com o valor posterior vencendo", () => {
        const result = merger({ a: 1, b: 2 }, { b: 3, c: 4 });
        expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it("mantém o valor existente quando o posterior é undefined", () => {
        const result = merger({ a: 1 }, { a: undefined });
        expect(result.a).toBe(1);
    });

    it('um falsy posterior vence o truthy existente — só undefined é "não passei"', () => {
        expect(merger({ teste: "single" }, { teste: false }).teste).toBe(false);
        expect(merger({ a: 300 }, { a: 0 }).a).toBe(0);
        expect(merger({ a: "x" }, { a: "" }).a).toBe("");
        expect(merger({ a: 1 }, { a: null }).a).toBeNull();
    });

    it("mescla objeto aninhado recursivamente", () => {
        const result = merger({ nested: { a: 1, b: 2 } }, { nested: { b: 99, c: 3 } });
        expect(result.nested).toEqual({ a: 1, b: 99, c: 3 });
    });

    it("não desce em array — o array posterior substitui o anterior", () => {
        const result = merger({ items: [1, 2, 3] }, { items: [9] });
        expect(result.items).toEqual([9]);
    });

    it("delega a chave ui ao mergerUI quando o ui é objeto", () => {
        const result = merger({ ui: { root: "p-2 text-red-500" } }, { ui: { root: "p-4" } });
        expect((result.ui as { root: string }).root).toBe("text-red-500 p-4");
    });

    it("sobrescreve um ui string com o valor posterior, sem twMerge no topo", () => {
        const result = merger({ ui: "p-2 text-red-500" }, { ui: "p-4" });
        expect(result.ui).toBe("p-4");
    });

    it("pula por inteiro objeto de origem null ou undefined", () => {
        const result = merger({ a: 1 }, null, undefined, { b: 2 });
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it("devolve objeto vazio quando nada é passado", () => {
        expect(merger()).toEqual({});
    });
});