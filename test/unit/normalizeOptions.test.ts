import { describe, expect, it } from "vitest";

import normalizeOptions, { getProperty, keyOf } from "../../src/runtime/utils/normalizeOptions";

describe("normalizeOptions", () => {
    it("array de primitivos usa o próprio item nos três campos", () => {
        expect(normalizeOptions(["pequeno", "grande"], {})).toEqual([
            { value: "pequeno", label: "pequeno", original: "pequeno" },
            { value: "grande", label: "grande", original: "grande" }
        ]);
    });

    it("array de objetos lê pelo `pick`, e guarda o item em `original`", () => {
        const ana = { id: 1, name: "Ana" };

        expect(normalizeOptions([ana], { value: "id", label: "name" })).toEqual([
            { value: 1, label: "Ana", original: ana }
        ]);
    });

    it("objeto vira chave → rótulo, com o `original` embrulhado de volta", () => {
        expect(normalizeOptions({ blue: "azul" }, {})).toEqual([
            { value: "blue", label: "azul", original: { blue: "azul" } }
        ]);
    });

    it("objeto de objetos lê o rótulo pelo `pick.label`", () => {
        expect(normalizeOptions({ a: { name: "Ana" } }, { label: "name" })).toEqual([
            { value: "a", label: "Ana", original: { a: { name: "Ana" } } }
        ]);
    });

    it("resolve caminho pontilhado nas duas chaves", () => {
        const item = { owner: { id: 7 }, meta: { title: "Ana" } };

        expect(normalizeOptions([item], { value: "owner.id", label: "meta.title" })).toEqual([
            { value: 7, label: "Ana", original: item }
        ]);
    });

    it("array misto cai no ramo de objetos — o primitivo fica sem value nem label", () => {
        expect(
            normalizeOptions([{ id: 1, name: "Ana" }, "solto"], { value: "id", label: "name" })
        ).toEqual([
            { value: 1, label: "Ana", original: { id: 1, name: "Ana" } },
            { value: undefined, label: undefined, original: "solto" }
        ]);
    });

    it("lista vazia, `undefined` e chave ausente não quebram", () => {
        expect(normalizeOptions([], {})).toEqual([]);
        expect(normalizeOptions(undefined, {})).toEqual([]);
        expect(normalizeOptions([{ id: 1 }], {})).toEqual([
            { value: undefined, label: undefined, original: { id: 1 } }
        ]);
    });
});

describe("getProperty", () => {
    it("desce o caminho pontilhado e devolve `undefined` no que não existe", () => {
        expect(getProperty({ a: { b: 1 } }, "a.b")).toBe(1);
        expect(getProperty({ a: { b: 1 } }, "a.c")).toBeUndefined();
        expect(getProperty({ a: 1 }, "a.b.c")).toBeUndefined();
        expect(getProperty(undefined, "a")).toBeUndefined();
        expect(getProperty({ a: 1 }, undefined)).toBeUndefined();
    });
});

describe("keyOf", () => {
    it('não colide `1` com `"1"` — é o `typeof` no prefixo', () => {
        expect(keyOf(1)).not.toBe(keyOf("1"));
    });

    it("é estável para o mesmo objeto e igual para objetos de mesma forma", () => {
        expect(keyOf({ id: 1 })).toBe(keyOf({ id: 1 }));
        expect(keyOf({ id: 1 })).not.toBe(keyOf({ id: 2 }));
    });

    it("separa `null` de `undefined` e da string que os imita", () => {
        expect(keyOf(null)).not.toBe(keyOf(undefined));
        expect(keyOf(null)).not.toBe(keyOf("null"));
    });
});