import { defineRule, type RuleContext } from "../../utils/definePreset";
import { trRule } from "../../utils/tr";
import { isBlank, text } from "../helpers";

// Por `(pattern, flags)`: o mesmo requisito roda a cada tecla no `RPassword`.
const cache = new Map<string, RegExp>();

const compile = (pattern: string | RegExp, flags?: string): RegExp => {
    const source = typeof pattern === "string" ? pattern : pattern.source;
    // `g` e `y` guardam `lastIndex` entre chamadas: o mesmo valor alternaria entre
    // casar e não casar.
    const clean = (flags ?? (typeof pattern === "string" ? "" : pattern.flags)).replace(
        /[gy]/g,
        ""
    );
    const key = `${clean}/${source}`;

    let compiled = cache.get(key);

    if (!compiled) {
        try {
            compiled = new RegExp(source, clean);
        } catch (error) {
            throw new Error(`[rform] rule "regex": invalid pattern — ${(error as Error).message}`);
        }

        cache.set(key, compiled);
    }

    return compiled;
};

/**
 * Exige que o valor case com `pattern`. `flags` sobrepõe as de um `RegExp`;
 * `message` troca a mensagem e volta crua, como no preset `schema`.
 *
 * @example { name: "regex", pattern: "[A-Z]", message: "Uma letra maiúscula." }
 * @example { name: "regex", pattern: "^PED-\\d+$", flags: "i" }
 */
export default defineRule({
    validation: ({
        value,
        pattern,
        flags,
        message
    }: RuleContext<{ pattern: string | RegExp; flags?: string; message?: string }>) => {
        // Compila antes do `isBlank`: um padrão quebrado lança já com o campo vazio.
        const compiled = compile(pattern, flags);

        if (isBlank(value)) {
            return undefined;
        }

        return compiled.test(text(value)) ? undefined : (message ?? trRule("regex"));
    }
});