import { z } from "zod";

import { defineRule, type RuleContext } from "../../utils/definePreset";
import { trRule } from "../../utils/tr";
import { check, isBlank } from "../helpers";

// O schema é escolhido pelo **valor**, não pelo tipo do campo: número compara por
// valor, o resto por comprimento. A mensagem de comprimento é plural, e a contagem
// que escolhe a forma é o mesmo `min` que ela interpola.
const schema = (value: unknown, min: number) => {
    if (typeof value === "number") {
        return z.number().min(min, trRule({ key: "min.number", params: { min } }));
    }

    // Num array a contagem é de itens, não de caracteres.
    return Array.isArray(value)
        ? z.array(z.unknown()).min(min, trRule({ key: "min.items", params: { min } }))
        : z.string().min(min, trRule({ key: "min.length", params: { min } }));
};

/** Exige um mínimo: valor, se for número; comprimento, no resto. */
export default defineRule({
    validation: ({ value, min }: RuleContext<{ min: number }>) =>
        isBlank(value) ? undefined : check(schema(value, min), value)
});