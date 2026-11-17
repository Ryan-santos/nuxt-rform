import { describe, expect, it } from "vitest";

import prefixDefaults from "../../src/runtime/utils/prefixDefaults";

describe("prefixDefaults", () => {
    it("prefixa toda folha de text e mantém a árvore aninhada", () => {
        expect(
            prefixDefaults(
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
        expect(prefixDefaults({ ui: {}, text: { start: "start" } }, "Calendar", "utils")).toEqual({
            ui: {},
            text: { start: "rform.utils.calendar.start" }
        });
    });

    it("prefixa um grupo aninhado em toda profundidade", () => {
        expect(
            prefixDefaults(
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
            prefixDefaults({ ui: {}, text: { falback: "test.falback" } }, "Array", "fields")
        ).toEqual({ ui: {}, text: { falback: "rform.fields.array.test.falback" } });
    });

    it("prefixa label e placeholder, que moram fora de text por contrato", () => {
        expect(
            prefixDefaults({ ui: {}, label: "label", placeholder: "placeholder" }, "File", "fields")
        ).toEqual({
            ui: {},
            label: "rform.fields.file.label",
            placeholder: "rform.fields.file.placeholder"
        });
    });

    it("deixa a string vazia em paz — é o sentinela de `não renderiza nada`", () => {
        expect(prefixDefaults({ ui: {}, label: "", placeholder: "" }, "Text", "fields")).toEqual({
            ui: {},
            label: "",
            placeholder: ""
        });
    });

    it("não toca numa string fora de text, nem num `label` aninhado", () => {
        expect(
            prefixDefaults({ ui: {}, pick: { value: "id", label: "name" } }, "Select", "fields")
        ).toEqual({ ui: {}, pick: { value: "id", label: "name" } });
    });

    it("repassa sem mudar um objeto que não tem text", () => {
        expect(
            prefixDefaults({ ui: { container: "flex" }, default: 0, max: 5 }, "Rating", "fields")
        ).toEqual({ ui: { container: "flex" }, default: 0, max: 5 });
    });

    it("não muta o objeto que recebeu", () => {
        const defaults = { ui: {}, label: "label", text: { button: "add", bytes: { b: "b" } } };

        prefixDefaults(defaults, "Array", "fields");

        expect(defaults).toEqual({
            ui: {},
            label: "label",
            text: { button: "add", bytes: { b: "b" } }
        });
    });

    it('prefixa o nome curto de icons, e deixa "" e nome com : intactos', () => {
        expect(
            prefixDefaults(
                { ui: {}, icons: { on: "check", off: "", own: "lucide:star", full: "rform:plus" } },
                "Switch",
                "fields"
            )
        ).toEqual({
            ui: {},
            icons: { on: "rform:check", off: "", own: "lucide:star", full: "rform:plus" }
        });
    });
});