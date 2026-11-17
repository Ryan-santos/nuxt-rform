import { describe, expect, it } from "vitest";

import en from "../../src/runtime/locales/en";
import ptBR from "../../src/runtime/locales/pt-BR";
import { matchLocale } from "../../src/runtime/utils/i18n";

describe("matchLocale", () => {
    const available = ["pt-BR", "en"];

    it("casa um code exato", () => {
        expect(matchLocale("pt-BR", available)).toBe("pt-BR");
        expect(matchLocale("en", available)).toBe("en");
    });

    it("casa sem diferenciar caixa", () => {
        expect(matchLocale("pt-br", available)).toBe("pt-BR");
    });

    it("alarga uma língua pelada para a região que existe", () => {
        expect(matchLocale("pt", available)).toBe("pt-BR");
    });

    it("estreita uma região para a língua pelada que existe", () => {
        expect(matchLocale("en-GB", available)).toBe("en");
    });

    it("prefere o casamento exato pelado ao regional", () => {
        expect(matchLocale("en", ["en-GB", "en"])).toBe("en");
    });

    it("devolve undefined para língua que nada cobre", () => {
        expect(matchLocale("ja", available)).toBeUndefined();
        expect(matchLocale(undefined, available)).toBeUndefined();
    });
});

const keys = (messages: unknown, prefix = ""): string[] =>
    Object.entries(messages as Record<string, unknown>).flatMap(([key, value]) =>
        typeof value === "string" ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`)
    );

describe("os packs embutidos", () => {
    it("concordam em toda chave, para nenhum locale cair no fallback calado", () => {
        expect(keys(en).sort()).toEqual(keys(ptBR).sort());
    });

    it("mantém o topo nas quatro raízes que o prefixo consegue produzir", () => {
        // `fields.*` e `utils.*` são o que o `prefixDefaults` escreve, um por diretório
        // de componente; `presets` e `formats` são os dois espaços compartilhados
        // que nada prefixa.
        const owners = [
            "fields", // components/fields/**
            "formats", // shared
            "presets", // presets/rules/**
            "utils" // components/utils/**
        ];

        expect([...new Set(keys(ptBR).map((key) => key.split(".")[0]!))].sort()).toEqual(owners);
    });
});