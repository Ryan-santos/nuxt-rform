const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

/** O que o gerador aceita. `symbols` vazio gera só letras e dígitos. */
export type GenerateOptions = {
    length?: number;
    symbols?: string;
};

// Inteiro uniforme em `[0, max)`, por rejeição: o `%` puro favoreceria os
// primeiros caracteres do alfabeto.
const randomInt = (max: number) => {
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    const buffer = new Uint32Array(1);

    do {
        crypto.getRandomValues(buffer);
    } while (buffer[0]! >= limit);

    return buffer[0]! % max;
};

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)]!;

/**
 * Uma senha aleatória com `crypto.getRandomValues`, garantindo ao menos uma
 * minúscula, uma maiúscula, um dígito e — havendo `symbols` — um símbolo. O
 * comprimento sobe até caber uma de cada classe.
 *
 * @example generatePassword() // → 16 caracteres, com os símbolos "@$!%*?&"
 * @example generatePassword({ length: 24, symbols: "#-_" })
 */
export default function generatePassword({
    length = 16,
    symbols = "@$!%*?&"
}: GenerateOptions = {}): string {
    const classes = [LOWER, UPPER, DIGITS, symbols].filter(Boolean);
    const alphabet = classes.join("");

    const chars = classes.map(pick);

    while (chars.length < length) {
        chars.push(pick(alphabet));
    }

    // Fisher–Yates: sem ele a primeira posição seria sempre minúscula.
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }

    return chars.join("");
}