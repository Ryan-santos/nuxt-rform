/**
 * Diz se a `rule` usa o preset `required` — pelo nome (`"required"`), por referência
 * (`{ name: "required" }`) ou dentro de um array. É o que deriva a prop `required`
 * quando o call site não a escreve.
 *
 * Só o preset, de propósito: função, schema zod, o preset `schema` e o `:rules` do
 * `RForm` não dizem "obrigatório" de um jeito que dê para ler. Ver "O `required` sai
 * da `rule`" no `.claude/CLAUDE.md`.
 *
 * @example hasRequiredRule(["required", { name: "min", min: 3 }]) // → true
 * @example hasRequiredRule(z.string().min(1)) // → false
 */
export default function hasRequiredRule(rule: unknown): boolean {
    return [rule]
        .flat()
        .some(
            (ref) =>
                ref === "required" ||
                (typeof ref === "object" &&
                    ref !== null &&
                    !("_zod" in ref) &&
                    (ref as { name?: unknown }).name === "required")
        );
}