import { z } from "zod";

import { defineRule, type RuleContext } from "../../utils/definePreset";
import { trRule } from "../../utils/tr";
import { check, isBlank } from "../helpers";

// O schema é escolhido pelo **valor**, não pelo tipo do campo: número compara por
// valor, o resto por comprimento. A mensagem de comprimento é plural, e a contagem
// que escolhe a forma é o mesmo `max` que ela interpola.
const schema = (value: unknown, max: number) => {
    if (typeof value === "number") {
        return z.number().max(max, trRule({ key: "max.number", params: { max } }));
    }

    // Num array a contagem é de itens, não de caracteres.
    return Array.isArray(value)
        ? z.array(z.unknown()).max(max, trRule({ key: "max.items", params: { max } }))
        : z.string().max(max, trRule({ key: "max.length", params: { max } }));
};

/** Exige um máximo: valor, se for número; comprimento, no resto. */
export default defineRule({
    validation: ({ value, max }: RuleContext<{ max: number }>) =>
        isBlank(value) ? undefined : check(schema(value, max), value)
});