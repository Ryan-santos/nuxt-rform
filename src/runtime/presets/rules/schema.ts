import { z, type ZodType } from "zod";
import type { JSONSchema } from "zod/v4/core";

import { defineRule, type RuleContext } from "../../utils/definePreset";
import { check, isBlank } from "../helpers";

// Pela identidade do objeto: o schema vem do `RDynamic` e é o mesmo a cada validação.
const cache = new WeakMap<object, ZodType>();

// Único ponto que chama o `fromJSONSchema`, que o zod marca como semi-experimental.
const convert = (schema: JSONSchema._JSONSchema): ZodType => {
    try {
        return z.fromJSONSchema(schema);
    } catch (error) {
        throw new Error(
            `[rform] rule "schema": cannot convert JSON Schema — ${(error as Error).message}`
        );
    }
};

const toZod = (schema: JSONSchema._JSONSchema): ZodType => {
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
 * `fromJSONSchema` do zod. Mensagens são as do zod; `message` troca todas.
 *
 * @example { name: "schema", schema: { type: "string", pattern: "^PED-" }, message: "Formato PED-000000." }
 */
export default defineRule({
    validation: ({
        value,
        schema,
        message
    }: RuleContext<{ schema: JSONSchema._JSONSchema; message?: string }>) => {
        if (isBlank(value)) {
            return undefined;
        }

        const error = check(toZod(schema), value);

        return error === undefined ? undefined : (message ?? error);
    }
});