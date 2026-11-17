import { describe, expect, it } from "vitest";

import generatePassword from "../../src/runtime/utils/generatePassword";

const LOWER = /[a-z]/;
const UPPER = /[A-Z]/;
const DIGIT = /[0-9]/;

describe("generatePassword", () => {
    it("tem 16 caracteres por padrão e respeita length", () => {
        expect(generatePassword()).toHaveLength(16);
        expect(generatePassword({ length: 32 })).toHaveLength(32);
    });

    it("tem ao menos um de cada classe", () => {
        for (let i = 0; i < 50; i++) {
            const password = generatePassword({ length: 4 });

            expect(password).toMatch(LOWER);
            expect(password).toMatch(UPPER);
            expect(password).toMatch(DIGIT);
            expect(password).toMatch(/[@$!%*?&]/);
        }
    });

    it("só usa caracteres do alfabeto, com os símbolos pedidos", () => {
        for (let i = 0; i < 50; i++) {
            expect(generatePassword({ symbols: "#-" })).toMatch(/^[A-Za-z0-9#-]+$/);
        }
    });

    it("sem símbolos não exige símbolo", () => {
        expect(generatePassword({ symbols: "" })).toMatch(/^[A-Za-z0-9]+$/);
    });

    it("sobe o comprimento até caber uma de cada classe", () => {
        expect(generatePassword({ length: 2 })).toHaveLength(4);
    });
});