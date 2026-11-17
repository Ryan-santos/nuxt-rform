/** Onde o componente mora, que é onde as mensagens dele moram. */
export type TextScope = "fields" | "utils";

type Tree = { [key: string]: string | Tree };

const walk = (tree: Tree, prefix: string): Tree => {
    const out: Tree = {};

    for (const [key, value] of Object.entries(tree)) {
        // Um grupo carrega a própria chave para dentro do prefixo, senão o
        // aninhamento seria forma para a prop e nada para a chave.
        out[key] =
            typeof value === "string" ? `${prefix}${value}` : walk(value, `${prefix}${key}.`);
    }

    return out;
};

/** O namespace dos aliases que o `module.ts` registra no `@nuxt/icon`. */
export const ICON_PREFIX = "rform:";

/** As duas chaves de topo que carregam mensagem sem morar em `text`. */
const LOOSE = ["label", "placeholder"] as const;

/**
 * Prefixa as chaves de tradução que o próprio componente declarou — `defaults.text`
 * é o marcador, e `label`/`placeholder` são as exceções que moram no topo — e os
 * nomes curtos do `defaults.icons`, com o namespace `rform:`. Roda
 * **antes** do `merger`, e é o que dá procedência de graça: o que vem de prop ou de
 * `app/rform/defaults.ts` substitui o valor prefixado e fica cru. Ver
 * "`defaults.text` é o marcador" no `.claude/CLAUDE.md`.
 *
 * @example prefixDefaults({ text: { button: "add" } }, "Array", "fields")
 * // → { text: { button: "rform.fields.array.add" } }
 * @example prefixDefaults({ icons: { add: "plus" } }, "Array", "fields")
 * // → { icons: { add: "rform:plus" } }
 */
export default function prefixDefaults<T extends Record<string, unknown>>(
    defaults: T,
    componentName: string,
    scope: TextScope
): Record<string, unknown> {
    const prefix = `rform.${scope}.${componentName.toLowerCase()}.`;

    const out: Record<string, unknown> = { ...defaults };

    const text = out.text as Tree | undefined;

    if (text) {
        out.text = walk(text, prefix);
    }

    const icons = out.icons as Record<string, string> | undefined;

    if (icons) {
        // Com `:` já é nome do iconify (ou um `rform:x` por extenso); `""` esconde o ícone.
        out.icons = Object.fromEntries(
            Object.entries(icons).map(([role, name]) => [
                role,
                name === "" || name.includes(":") ? name : `${ICON_PREFIX}${name}`
            ])
        );
    }

    for (const key of LOOSE) {
        const value = out[key];

        // String vazia é o sentinela de "não renderiza nada", e `rform.fields.text.`
        // sozinho nunca é uma chave a resolver.
        if (typeof value === "string" && value !== "") {
            out[key] = `${prefix}${value}`;
        }
    }

    return out;
}