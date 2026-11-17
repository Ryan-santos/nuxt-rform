import type { Base } from "#rform/types";

import mergerUI from "./mergerUI";

export type MergeObjects<Objects extends Array<unknown>> = Objects extends [
    infer First,
    ...infer Rest
]
    ? First extends object
        ? Rest extends Array<object | null | undefined>
            ? Rest["length"] extends 0
                ? First
                : Omit<NonNullable<First>, keyof MergeObjects<Rest>> & MergeObjects<Rest>
            : First
        : NonNullable<First>
    : Objects[number];

type OBJ = Record<string | number, unknown> | null | undefined;

/**
 * Mescla as fontes de props folha a folha, na ordem em que chegam — `defaults` do
 * componente, defaults do app, call site. A chave `ui` desvia pro `mergerUI`.
 *
 * @example merger({ default: "", ui: { container: "flex" } }, { ui: { container: "grid" } })
 */
export default function merger<T extends Array<OBJ>>(...objects: T) {
    return objects.reduce((result, current) => {
        if (!current || typeof current !== "object") {
            return result;
        }

        for (const key in current) {
            const resultValue = result?.[key];
            const currentValue = current[key];

            // `undefined` é "não passei"; `false`, `0`, `""` e `null` são valor e
            // vencem. Por isso toda prop booleana de campo entra no `withDefaults`
            // como `undefined` — o boolean casting a faria chegar `false`.
            if (currentValue === undefined) {
                continue;
            }

            if (
                resultValue &&
                currentValue &&
                typeof currentValue === "object" &&
                !Array.isArray(currentValue)
            ) {
                result[key] =
                    key === "ui"
                        ? mergerUI(resultValue as Base["ui"], currentValue as Base["ui"])
                        : merger(resultValue as OBJ, currentValue as OBJ);

                continue;
            }

            if (result) {
                result[key] = currentValue;
            }
        }

        return result;
    }, {}) as MergeObjects<T>;
}