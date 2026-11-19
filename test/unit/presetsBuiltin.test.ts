import { describe, expect, it } from "vitest";

import maskCep from "../../src/runtime/presets/masks/br/cep";
import maskCpf from "../../src/runtime/presets/masks/br/cpf";
import maskCpfCnpj from "../../src/runtime/presets/masks/br/cpfCnpj";
import cep from "../../src/runtime/presets/rules/br/cep";
import cnpj from "../../src/runtime/presets/rules/br/cnpj";
import cpf from "../../src/runtime/presets/rules/br/cpf";
import telefone from "../../src/runtime/presets/rules/br/telefone";
import email from "../../src/runtime/presets/rules/email";
import max from "../../src/runtime/presets/rules/max";
import min from "../../src/runtime/presets/rules/min";
import regex from "../../src/runtime/presets/rules/regex";
import required from "../../src/runtime/presets/rules/required";
import url from "../../src/runtime/presets/rules/url";

/**
 * O contexto é `{ value, form }` e nada mais — um preset alcança o locale ativo
 * pelo `trRule` importado. Isto chama a `validation` direto, sem build em volta,
 * que é a rota que o `#rform/translate` tem de manter funcionando.
 */
const run = (
    preset: { validation: (context: never) => unknown },
    value: unknown,
    args: Record<string, unknown> = {}
) => (preset.validation as (c: Record<string, unknown>) => unknown)({ ...args, value, form: {} });

describe("required", () => {
    it("recusa valor vazio", () => {
        expect(run(required, undefined)).toBeTypeOf("string");
        expect(run(required, null)).toBeTypeOf("string");
        expect(run(required, "")).toBeTypeOf("string");
        expect(run(required, "   ")).toBeTypeOf("string");
        expect(run(required, [])).toBeTypeOf("string");
        expect(run(required, false)).toBeTypeOf("string");
    });

    it("aceita zero como valor de verdade", () => {
        expect(run(required, 0)).toBeUndefined();
    });

    it("aceita valor preenchido", () => {
        expect(run(required, "ana")).toBeUndefined();
        expect(run(required, ["a"])).toBeUndefined();
        expect(run(required, true)).toBeUndefined();
    });
});

describe("br/cpf", () => {
    it("aceita um cpf válido, formatado ou não", () => {
        expect(run(cpf, "529.982.247-25")).toBeUndefined();
        expect(run(cpf, "52998224725")).toBeUndefined();
    });

    it("recusa dígito verificador errado", () => {
        expect(run(cpf, "529.982.247-24")).toBeTypeOf("string");
    });

    it("recusa dígito repetido", () => {
        expect(run(cpf, "111.111.111-11")).toBeTypeOf("string");
    });

    it("recusa comprimento errado", () => {
        expect(run(cpf, "5299822472")).toBeTypeOf("string");
    });

    it("pula valor vazio, para o required ser dono da vacuidade", () => {
        expect(run(cpf, "")).toBeUndefined();
        expect(run(cpf, undefined)).toBeUndefined();
    });
});

describe("br/cnpj", () => {
    it("aceita um cnpj válido, formatado ou não", () => {
        expect(run(cnpj, "11.222.333/0001-81")).toBeUndefined();
        expect(run(cnpj, "11222333000181")).toBeUndefined();
    });

    it("recusa dígito verificador errado", () => {
        expect(run(cnpj, "11.222.333/0001-82")).toBeTypeOf("string");
    });

    it("recusa dígito repetido", () => {
        expect(run(cnpj, "11111111111111")).toBeTypeOf("string");
    });

    it("pula valor vazio", () => {
        expect(run(cnpj, "")).toBeUndefined();
    });
});

describe("br/cep", () => {
    it("aceita oito dígitos", () => {
        expect(run(cep, "01310-100")).toBeUndefined();
        expect(run(cep, "01310100")).toBeUndefined();
    });

    it("recusa qualquer outro comprimento", () => {
        expect(run(cep, "0131010")).toBeTypeOf("string");
    });

    it("pula valor vazio", () => {
        expect(run(cep, "")).toBeUndefined();
    });
});

describe("br/telefone", () => {
    it("aceita número fixo e celular", () => {
        expect(run(telefone, "(11) 3333-4444")).toBeUndefined();
        expect(run(telefone, "(11) 93333-4444")).toBeUndefined();
    });

    it("recusa celular cujo nono dígito não é 9", () => {
        expect(run(telefone, "(11) 83333-4444")).toBeTypeOf("string");
    });

    it("recusa DDD inválido", () => {
        expect(run(telefone, "(01) 3333-4444")).toBeTypeOf("string");
    });

    it("pula valor vazio", () => {
        expect(run(telefone, "")).toBeUndefined();
    });
});

describe("email", () => {
    it("aceita um endereço simples", () => {
        expect(run(email, "ana@exemplo.com.br")).toBeUndefined();
    });

    it("recusa endereço malformado", () => {
        expect(run(email, "ana@")).toBeTypeOf("string");
        expect(run(email, "ana exemplo.com")).toBeTypeOf("string");
    });

    it("pula valor vazio", () => {
        expect(run(email, "")).toBeUndefined();
    });
});

describe("url", () => {
    it("aceita uma url absoluta", () => {
        expect(run(url, "https://exemplo.com.br/a?b=1")).toBeUndefined();
    });

    it("recusa valor que não é url", () => {
        expect(run(url, "exemplo")).toBeTypeOf("string");
    });

    it("pula valor vazio", () => {
        expect(run(url, "")).toBeUndefined();
    });
});

describe("min", () => {
    it("compara comprimento em string e array", () => {
        expect(run(min, "ab", { min: 3 })).toBeTypeOf("string");
        expect(run(min, "abc", { min: 3 })).toBeUndefined();
        expect(run(min, ["a"], { min: 2 })).toBeTypeOf("string");
        expect(run(min, ["a", "b"], { min: 2 })).toBeUndefined();
    });

    it("compara valor em número", () => {
        expect(run(min, 2, { min: 3 })).toBeTypeOf("string");
        expect(run(min, 3, { min: 3 })).toBeUndefined();
    });

    it("pula valor vazio", () => {
        expect(run(min, "", { min: 3 })).toBeUndefined();
    });
});

describe("max", () => {
    it("compara comprimento em string e array", () => {
        expect(run(max, "abcd", { max: 3 })).toBeTypeOf("string");
        expect(run(max, "abc", { max: 3 })).toBeUndefined();
        expect(run(max, ["a", "b", "c", "d"], { max: 3 })).toBeTypeOf("string");
    });

    it("compara valor em número", () => {
        expect(run(max, 4, { max: 3 })).toBeTypeOf("string");
        expect(run(max, 3, { max: 3 })).toBeUndefined();
    });
});

describe("regex", () => {
    it("aceita o que casa e recusa o que não casa", () => {
        expect(run(regex, "abc", { pattern: "[a-z]" })).toBeUndefined();
        expect(run(regex, "ABC", { pattern: "[a-z]" })).toBe("Formato inválido.");
    });

    it("deixa o vazio para o required", () => {
        expect(run(regex, "", { pattern: "[a-z]" })).toBeUndefined();
        expect(run(regex, undefined, { pattern: "[a-z]" })).toBeUndefined();
        expect(run(regex, null, { pattern: "[a-z]" })).toBeUndefined();
    });

    it("aplica as flags", () => {
        expect(run(regex, "ABC", { pattern: "[a-z]", flags: "i" })).toBeUndefined();
    });

    it("aceita RegExp", () => {
        expect(run(regex, "123", { pattern: /^\d+$/ })).toBeUndefined();
        expect(run(regex, "12a", { pattern: /^\d+$/ })).toBeTypeOf("string");
    });

    it("lança com padrão inválido", () => {
        expect(() => run(regex, "a", { pattern: "[" })).toThrow("[rform]");
    });

    it("RegExp com g não guarda estado entre chamadas", () => {
        const pattern = /a/g;

        expect(run(regex, "a", { pattern })).toBeUndefined();
        expect(run(regex, "a", { pattern })).toBeUndefined();
        expect(pattern.lastIndex).toBe(0);
    });

    it("testa número como string", () => {
        expect(run(regex, 42, { pattern: "^\\d+$" })).toBeUndefined();
    });
});

describe("presets de mask", () => {
    it("entregam opções do maska, e não pattern pelado", () => {
        expect(maskCpf).toEqual({ mask: "###.###.###-##" });
        expect(maskCep).toEqual({ mask: "#####-###" });
    });

    it("expressam cpfCnpj como máscara dinâmica", () => {
        expect(maskCpfCnpj.mask).toEqual(["###.###.###-##", "##.###.###/####-##"]);
    });
});

describe("plural", () => {
    // O bug que o resolvedor à mão embarcava: `min: 1` lia "Mínimo de 1 caracteres."
    // Array vazio não é branco, então a rule não sai cedo e a mensagem é alcançável.
    it("conta itens num array, no singular e no plural", () => {
        expect(run(min, [], { min: 1 })).toBe("Mínimo de 1 item.");
        expect(run(min, ["a"], { min: 3 })).toBe("Mínimo de 3 itens.");
        expect(run(max, ["a", "b"], { max: 1 })).toBe("Máximo de 1 item.");
        expect(run(max, ["a", "b", "c"], { max: 2 })).toBe("Máximo de 2 itens.");
    });

    it("diz caracteres no plural", () => {
        expect(run(min, "ab", { min: 5 })).toBe("Mínimo de 5 caracteres.");
    });

    it("faz o mesmo do lado do max", () => {
        expect(run(max, "ab", { max: 1 })).toBe("Máximo de 1 caractere.");
        expect(run(max, "abcdef", { max: 2 })).toBe("Máximo de 2 caracteres.");
    });
});