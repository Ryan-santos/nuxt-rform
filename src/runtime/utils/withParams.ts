/** O par `{ key, params }` que o `tr` aceita, ou vazio quando a entrada não é texto. */
export type WithParams = { key: string; params: Record<string, unknown> } | "";

/**
 * Acrescenta params a uma prop de texto, que chega como chave ou como o par
 * `{ key, params }` — as duas formas que o `TrInput` de um app com i18n permite.
 * O param novo vence o que já vinha com o mesmo nome.
 *
 * @example withParams("rform.fields.file.tooBig", { max: "2 MB" }) // → { key: "rform.fields.file.tooBig", params: { max: "2 MB" } }
 */
export default function withParams(input: unknown, params: Record<string, unknown>): WithParams {
    if (typeof input === "string") {
        return { key: input, params };
    }

    if (input && typeof input === "object" && "key" in input) {
        const source = input as { key: string; params?: Record<string, unknown> };

        return { key: source.key, params: { ...source.params, ...params } };
    }

    return "";
}