import { z, type ZodType } from "zod";
import type { JSONSchema } from "zod/v4/core";

import { defineRule, type RuleContext } from "../../utils/definePreset";
import { check, isBlank } from "../helpers";

// Frouxo de propósito: o JSON vem do back, e o tipo do zod recusa array readonly
// (`enum` em `as const`). Quem confere as keywords é o `fromJSONSchema`.
type Source = Readonly<Record<string, unknown>> | boolean;

// Pela identidade do objeto: o schema vem do `RDynamic` e é o mesmo a cada validação.
const cache = new WeakMap<object, ZodType>();

// Único ponto que chama o `fromJSONSchema`, que o zod marca como semi-experimental.
const convert = (schema: Source): ZodType => {
    try {
        return z.fromJSONSchema(schema as JSONSchema._JSONSchema);
    } catch (error) {
        throw new Error(
            `[rform] rule "schema": cannot convert JSON Schema — ${(error as Error).message}`
        );
    }
};

const toZod = (schema: Source): ZodType => {
    if (typeof schema === "boolean") {
        return convert(schema);
    }

    let converted = cache.get(schema);

    if (!converted) {
        converted = convert(schema);
        cache.set(schema, converted);
    }

    return converted;
};

/**
 * Valida contra um JSON Schema, convertido para zod. Experimental: segue o
 * `fromJSONSchema` do zod. Mensagens são as do zod; o `message` do ref troca todas.
 *
 * @example { name: "schema", schema: { type: "string", pattern: "^PED-" }, message: "form.pedido" }
 */
export default defineRule({
    validation: ({ value, schema }: RuleContext<{ schema: Source }>) => {
        // Converte antes do `isBlank`: um schema quebrado lança já com o campo vazio.
        const zod = toZod(schema);

        if (isBlank(value)) {
            return undefined;
        }

        const error = check(zod, value);

        return error;
    }
});