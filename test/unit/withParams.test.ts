import { describe, expect, it } from "vitest";

import withParams from "../../src/runtime/utils/withParams";

describe("withParams", () => {
    it("embrulha uma chave solta no par { key, params }", () => {
        expect(withParams("rform.fields.file.tooBig", { max: "2 MB" })).toEqual({
            key: "rform.fields.file.tooBig",
            params: { max: "2 MB" }
        });
    });

    it("mescla no par que já vinha, e o param novo vence", () => {
        expect(withParams({ key: "app.x", params: { a: 1, n: 0 } }, { n: 5 })).toEqual({
            key: "app.x",
            params: { a: 1, n: 5 }
        });
    });

    it("devolve vazio para o que não é texto", () => {
        expect(withParams(undefined, { n: 1 })).toBe("");
        expect(withParams(42, { n: 1 })).toBe("");
        expect(withParams({ params: {} }, { n: 1 })).toBe("");
    });
});