import { describe, expect, it } from "vitest";

import remapIndexKeys from "../../src/runtime/utils/remapIndexKeys";

const shift = (at: number) => (index: number) =>
    index === at ? null : index > at ? index - 1 : index;

describe("remapIndexKeys", () => {
    it("renumera as chaves abaixo do prefixo e descarta a removida", () => {
        const out = remapIndexKeys(
            { "itens.0": "a", "itens.1": "b", "itens.2.nome": "c", "itens.10": "d" },
            "itens",
            shift(1)
        );

        expect(out).toEqual({ "itens.0": "a", "itens.1.nome": "c", "itens.9": "d" });
    });

    it("troca dois índices", () => {
        const out = remapIndexKeys({ "a.b.0.x": "um", "a.b.1": "dois" }, "a.b", (index) =>
            index === 0 ? 1 : index === 1 ? 0 : index
        );

        expect(out).toEqual({ "a.b.1.x": "um", "a.b.0": "dois" });
    });

    it("deixa intacto o que não é índice sob o prefixo", () => {
        const record = { itens: "do array", "itens.total": "x", itensExtra: "y", outro: "z" };

        expect(remapIndexKeys(record, "itens", shift(0))).toEqual(record);
    });

    it("não muta o mapa recebido", () => {
        const record = { "itens.0": "a" };
        remapIndexKeys(record, "itens", shift(0));

        expect(record).toEqual({ "itens.0": "a" });
    });
});