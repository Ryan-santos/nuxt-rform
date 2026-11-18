import { describe, expect, it } from "vitest";

import type { Condition } from "../../src/runtime/type";
import matchCondition from "../../src/runtime/utils/matchCondition";

const form = {
    tipo: "json",
    idade: 18,
    texto: "Rua das Flores",
    tags: ["a", "b"],
    vazio: "",
    lista: [],
    objeto: {},
    zero: 0,
    falso: false,
    nulo: null,
    endereco: { uf: "SP" },
    itens: [{ nome: "primeiro" }, { nome: "segundo" }]
};

const match = (condition: Condition, path?: string) => matchCondition(condition, { form, path });

describe("matchCondition", () => {
    describe("igualdade", () => {
        it('distingue `==` de `===` sobre `"18"` e `18`', () => {
            expect(match({ field: "idade", op: "==", value: "18" })).toBe(true);
            expect(match({ field: "idade", op: "===", value: "18" })).toBe(false);
            expect(match({ field: "idade", op: "===", value: 18 })).toBe(true);
        });

        it("distingue `!=` de `!==` pelo mesmo par", () => {
            expect(match({ field: "idade", op: "!=", value: "18" })).toBe(false);
            expect(match({ field: "idade", op: "!==", value: "18" })).toBe(true);
        });
    });

    describe("comparação", () => {
        it("compara números", () => {
            expect(match({ field: "idade", op: ">", value: 17 })).toBe(true);
            expect(match({ field: "idade", op: ">=", value: 18 })).toBe(true);
            expect(match({ field: "idade", op: "<", value: 18 })).toBe(false);
            expect(match({ field: "idade", op: "<=", value: 18 })).toBe(true);
        });
    });

    describe("`in` e `contains` são inversos", () => {
        it("`in` pergunta se o campo está numa lista do schema", () => {
            expect(match({ field: "tipo", op: "in", value: ["json", "form"] })).toBe(true);
            expect(match({ field: "tipo", op: "in", value: ["none"] })).toBe(false);
            expect(match({ field: "tipo", op: "not_in", value: ["none"] })).toBe(true);
        });

        it("`contains` pergunta se o campo contém um item", () => {
            expect(match({ field: "tags", op: "contains", value: "a" })).toBe(true);
            expect(match({ field: "tags", op: "contains", value: "z" })).toBe(false);
            expect(match({ field: "tags", op: "not_contains", value: "z" })).toBe(true);
        });

        it("`contains` também vale para string", () => {
            expect(match({ field: "texto", op: "contains", value: "Flores" })).toBe(true);
        });
    });

    describe("texto", () => {
        it("casa começo e fim", () => {
            expect(match({ field: "texto", op: "starts_with", value: "Rua" })).toBe(true);
            expect(match({ field: "texto", op: "ends_with", value: "Flores" })).toBe(true);
            expect(match({ field: "texto", op: "starts_with", value: "rua" })).toBe(false);
        });

        it("`matches` respeita `flags`", () => {
            expect(match({ field: "texto", op: "matches", value: "^rua" })).toBe(false);
            expect(match({ field: "texto", op: "matches", value: "^rua", flags: "i" })).toBe(true);
        });
    });

    describe("vacuidade", () => {
        it("casa string vazia, array vazio, objeto sem chaves e null", () => {
            expect(match({ field: "vazio", op: "is_empty" })).toBe(true);
            expect(match({ field: "lista", op: "is_empty" })).toBe(true);
            expect(match({ field: "objeto", op: "is_empty" })).toBe(true);
            expect(match({ field: "nulo", op: "is_empty" })).toBe(true);
            expect(match({ field: "inexistente", op: "is_empty" })).toBe(true);
        });

        it("não casa `false` nem `0` — o campo respondeu", () => {
            expect(match({ field: "falso", op: "is_empty" })).toBe(false);
            expect(match({ field: "zero", op: "is_empty" })).toBe(false);
        });

        it("`is_not_empty` é o inverso", () => {
            expect(match({ field: "texto", op: "is_not_empty" })).toBe(true);
            expect(match({ field: "vazio", op: "is_not_empty" })).toBe(false);
        });
    });

    describe("composição", () => {
        it("array é AND", () => {
            expect(
                match([
                    { field: "tipo", op: "===", value: "json" },
                    { field: "idade", op: ">=", value: 18 }
                ])
            ).toBe(true);

            expect(
                match([
                    { field: "tipo", op: "===", value: "json" },
                    { field: "idade", op: ">=", value: 21 }
                ])
            ).toBe(false);
        });

        it("`or` basta um", () => {
            expect(
                match({
                    or: [
                        { field: "tipo", op: "===", value: "none" },
                        { field: "idade", op: "===", value: 18 }
                    ]
                })
            ).toBe(true);

            expect(
                match({
                    or: [
                        { field: "tipo", op: "===", value: "none" },
                        { field: "idade", op: "===", value: 21 }
                    ]
                })
            ).toBe(false);
        });

        it("`not` inverte", () => {
            expect(match({ not: { field: "tipo", op: "===", value: "json" } })).toBe(false);
            expect(match({ not: { field: "tipo", op: "===", value: "none" } })).toBe(true);
        });

        it("aninha `or` dentro de um AND", () => {
            expect(
                match([
                    { field: "idade", op: ">=", value: 18 },
                    { or: [{ field: "tipo", op: "===", value: "json" }] }
                ])
            ).toBe(true);
        });
    });

    describe("função", () => {
        it("recebe o `form` e o valor do próprio campo, tirado do `path`", () => {
            expect(
                match(
                    ({ value, form: root }) =>
                        value === "Rua das Flores" && (root as typeof form).tipo === "json",
                    "texto"
                )
            ).toBe(true);
        });

        it("o `path` desce em caminho pontilhado", () => {
            expect(match(({ value }) => value === "SP", "endereco.uf")).toBe(true);
        });

        it("sem `path`, o `value` chega indefinido", () => {
            expect(match(({ value }) => value === undefined)).toBe(true);
        });

        it("coage o retorno a boolean", () => {
            expect(match(() => 0 as unknown as boolean)).toBe(false);
        });
    });

    describe("caminho pontilhado", () => {
        it("desce em objeto aninhado", () => {
            expect(match({ field: "endereco.uf", op: "===", value: "SP" })).toBe(true);
        });

        it("desce em índice de array", () => {
            expect(match({ field: "itens.0.nome", op: "===", value: "primeiro" })).toBe(true);
            expect(match({ field: "itens.1.nome", op: "===", value: "primeiro" })).toBe(false);
        });

        it("caminho inexistente devolve undefined e não casa", () => {
            expect(match({ field: "nao.existe.mesmo", op: "===", value: "x" })).toBe(false);
            expect(match({ field: "texto.dentro", op: "===", value: "x" })).toBe(false);
        });

        it("form undefined não lança — nada casa", () => {
            expect(
                matchCondition({ field: "tipo", op: "===", value: "json" }, { form: undefined })
            ).toBe(false);
        });
    });

    describe("erro de autoria lança", () => {
        it("operador desconhecido", () => {
            expect(() => match({ field: "tipo", op: "eq" } as unknown as Condition)).toThrow(
                /unknown condition operator "eq"/
            );
        });

        it("`op` ausente", () => {
            expect(() => match({ field: "tipo", value: "json" } as unknown as Condition)).toThrow(
                /has no "op"/
            );
        });

        it("`field` ausente", () => {
            expect(() => match({ op: "is_empty" } as unknown as Condition)).toThrow(
                /needs a "field" path/
            );
        });

        it("`in` com `value` que não é array", () => {
            expect(() =>
                match({ field: "tipo", op: "in", value: "json" } as unknown as Condition)
            ).toThrow(/needs an array in "value", got string/);
        });

        it("regex inválida", () => {
            expect(() => match({ field: "texto", op: "matches", value: "[" })).toThrow(
                /invalid regular expression/
            );
        });

        it("condição que não é objeto nem função", () => {
            expect(() => match("json" as unknown as Condition)).toThrow(
                /cannot resolve condition: string/
            );
        });
    });
});