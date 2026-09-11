import { describe, expect, it } from "vitest";

import prefixText from "../../src/runtime/utils/prefixText";

describe("prefixText", () => {
    it("prefixa toda folha de text e mantém a árvore aninhada", () => {
        expect(
            prefixText(
                { ui: { container: "flex" }, default: [], text: { button: "add" } },
                "Array",
                "fields"
            )
        ).toEqual({
            ui: { container: "flex" },
            default: [],
            text: { button: "rform.fields.array.add" }
        });
    });

    it("põe o scope no prefixo, para campo e util de mesmo nome não colidirem", () => {
        expect(prefixText({ ui: {}, text: { start: "start" } }, "Calendar", "utils")).toEqual({
            ui: {},
            text: { start: "rform.utils.calendar.start" }
        });
    });

    it("prefixa um grupo aninhado em toda profundidade", () => {
        expect(
            prefixText(
                {
                    ui: {},
                    text: {
                        zero: "zero",
                        bytes: { b: "b", kb: "kb" }
                    }
                },
                "File",
                "fields"
            )
        ).toEqual({
            ui: {},
            text: {
                zero: "rform.fields.file.zero",
                bytes: {
                    b: "rform.fields.file.bytes.b",
                    kb: "rform.fields.file.bytes.kb"
                }
            }
        });
    });

    it("mantém o caminho pontilhado inteiro do valor", () => {
        expect(
            prefixText({ ui: {}, text: { falback: "test.falback" } }, "Array", "fields")
        ).toEqual({ ui: {}, text: { falback: "rform.fields.array.test.falback" } });
    });

    it("prefixa label e placeholder, que moram fora de text por contrato", () => {
        expect(
            prefixText({ ui: {}, label: "label", placeholder: "placeholder" }, "File", "fields")
        ).toEqual({
            ui: {},
            label: "rform.fields.file.label",
            placeholder: "rform.fields.file.placeholder"
        });
    });

    it("deixa a string vazia em paz — é o sentinela de `não renderiza nada`", () => {
        expect(prefixText({ ui: {}, label: "", placeholder: "" }, "Text", "fields")).toEqual({
            ui: {},
            label: "",
            placeholder: ""
        });
    });

    it("não toca numa string fora de text, nem num `label` aninhado", () => {
        expect(
            prefixText({ ui: {}, pick: { value: "id", label: "name" } }, "Select", "fields")
        ).toEqual({ ui: {}, pick: { value: "id", label: "name" } });
    });

    it("repassa sem mudar um objeto que não tem text", () => {
        expect(
            prefixText({ ui: { container: "flex" }, default: 0, max: 5 }, "Rating", "fields")
        ).toEqual({ ui: { container: "flex" }, default: 0, max: 5 });
    });

    it("não muta o objeto que recebeu", () => {
        const defaults = { ui: {}, label: "label", text: { button: "add", bytes: { b: "b" } } };

        prefixText(defaults, "Array", "fields");

        expect(defaults).toEqual({
            ui: {},
            label: "label",
            text: { button: "add", bytes: { b: "b" } }
        });
    });
});