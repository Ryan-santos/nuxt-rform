import { twMerge } from "tailwind-merge";

import type { Base } from "#rform/types";

// `null` zera o que veio antes, inclusive dentro de um array: `[null, "grid"]`
// troca a camada inteira por `grid`. Sem isso o `twMerge` pularia o `null`.
const mergeLeaf = (...values: unknown[]) =>
    values
        .flat()
        .reduce<string>((acc, value) => (value === null ? "" : twMerge(acc, value as string)), "");

/**
 * Mescla blocos de `ui` folha a folha, passando cada classe pelo `twMerge`.
 * Numa fonte, `undefined` é "não passei"; `null` é "zera esta chave", e num
 * array zera o que veio antes dele.
 *
 * @example mergerUI({ container: "p-2 gap-1" }, { container: "p-4" }) // → { container: "gap-1 p-4" }
 * @example mergerUI({ container: "p-2" }, { container: null }) // → { container: null }
 * @example mergerUI({ container: "p-2" }, { container: [null, "grid"] }) // → { container: "grid" }
 */
export default function mergerUI<T extends (Base["ui"] | undefined)[], I = NonNullable<T[number]>>(
    ...objects: T
): I | undefined {
    const validObjects = objects.filter((obj) => obj !== undefined);

    if (validObjects.length === 0) {
        return undefined;
    }

    if (validObjects.length === 1) {
        return validObjects[0] as unknown as I;
    }

    if (validObjects.every((obj) => typeof obj === "string")) {
        return twMerge(...(validObjects as string[])) as unknown as I;
    }

    const [target, ...sources] = validObjects as Record<string, unknown>[];

    const result = { ...target };

    for (const source of sources) {
        for (const key in source) {
            if (source[key] !== undefined) {
                if (source[key] !== null) {
                    if (typeof source[key] === "string" || Array.isArray(source[key])) {
                        result[key] = mergeLeaf(result[key], source[key]);
                    } else {
                        result[key] = mergerUI(
                            result[key] as Record<string, unknown>,
                            source[key] as unknown as Record<string, unknown>
                        );
                    }
                } else {
                    result[key] = source[key];
                }
            }
        }
    }

    return result as unknown as I;
}