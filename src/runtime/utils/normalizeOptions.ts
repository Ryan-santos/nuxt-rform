import type { OptionItem, Options } from "#rform/types";

/** As duas chaves que o `pick` do `RSelect` carrega, já desembrulhadas. */
export type Pick = { value?: string; label?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

/**
 * `obj[path]`, com `path` podendo ser pontilhado (`user.id`). Devolve `undefined`
 * para caminho que não existe — é por isso que o tipo do valor cai em `unknown`
 * quando a chave não é simples.
 *
 * @example getProperty({ user: { id: 7 } }, "user.id") // → 7
 */
export function getProperty(obj: unknown, path: string | undefined): unknown {
    if (!path || !isRecord(obj)) {
        return undefined;
    }

    return path.split(".").reduce<unknown>((acc, part) => {
        return isRecord(acc) ? acc[part] : undefined;
    }, obj);
}

/**
 * A identidade de um valor de model, como string. O model guarda `42` — um
 * primitivo —, e com `modelFull` guarda um objeto remontado a cada resposta, então
 * nem o próprio valor nem um `WeakMap` servem de chave.
 *
 * O `typeof` no prefixo é o que impede `1` de colidir com `"1"`.
 *
 * @example keyOf(1) // → "number:1"
 * @example keyOf("1") // → "string:1"
 */
export function keyOf(value: unknown): string {
    if (value !== null && typeof value === "object") {
        return `o:${JSON.stringify(value)}`;
    }

    return `${typeof value}:${String(value)}`;
}

/**
 * Os três formatos de `options` reduzidos a uma lista de `{ value, label, original }`.
 * Puro e sem `tr`, no molde do `formatBytes` e do `acceptMatch`: quem decide o que é
 * `value` e o que é `label` é o `pick`.
 *
 * Array de primitivos usa o próprio item nos três campos; array de objetos lê pelo
 * `pick`; objeto vira chave → rótulo, com o `original` embrulhado de volta em
 * `{ chave: valor }` para o `modelFull` continuar tendo o que guardar.
 *
 * @example normalizeOptions(["a"], {}) // → [{ value: "a", label: "a", original: "a" }]
 * @example normalizeOptions([{ id: 1, name: "Ana" }], { value: "id", label: "name" })
 */
export default function normalizeOptions(options: Options | undefined, pick: Pick): OptionItem[] {
    if (!options) {
        return [];
    }

    if (Array.isArray(options)) {
        if (options.length === 0) {
            return [];
        }

        // Array misto cai no ramo de objetos: basta um item ser objeto para o
        // `pick` passar a valer, e um primitivo ali devolve `undefined` nos dois.
        if (options.every((entry) => typeof entry !== "object" || entry === null)) {
            return options.map((entry) => ({ value: entry, label: entry, original: entry }));
        }

        return options.map((entry) => ({
            value: getProperty(entry, pick.value),
            label: getProperty(entry, pick.label),
            original: entry
        }));
    }

    if (typeof options === "object") {
        return Object.entries(options).map(([key, value]) => ({
            value: key,
            label: isRecord(value) ? getProperty(value, pick.label) : value,
            original: { [key]: value }
        }));
    }

    return [];
}