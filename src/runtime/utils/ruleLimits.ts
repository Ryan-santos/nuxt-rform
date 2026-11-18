export type RuleLimits = { min?: number; max?: number };

type ZodDef = {
    type?: string;
    checks?: { _zod?: { def?: Record<string, unknown> } }[];
    innerType?: { _zod?: { def?: ZodDef } };
    in?: { _zod?: { def?: ZodDef } };
};

// Embrulhos que não mudam o comprimento aceito: o limite mora no schema de dentro.
const WRAPPERS = new Set([
    "optional",
    "nullable",
    "default",
    "prefault",
    "readonly",
    "nonoptional",
    "catch"
]);

const fromZod = (def: ZodDef | undefined, limits: RuleLimits) => {
    let current = def;

    while (current) {
        for (const check of current.checks ?? []) {
            const inner = check._zod?.def ?? {};
            const kind = inner.check;

            if (kind === "min_length" || kind === "length_equals") {
                tighten(limits, "min", inner[kind === "min_length" ? "minimum" : "length"]);
            }
            if (kind === "max_length" || kind === "length_equals") {
                tighten(limits, "max", inner[kind === "max_length" ? "maximum" : "length"]);
            }
        }

        current = WRAPPERS.has(current.type ?? "")
            ? current.innerType?._zod?.def
            : current.type === "pipe"
              ? current.in?._zod?.def
              : undefined;
    }
};

// Em mais de uma fonte, vale a mais apertada: o maior mínimo e o menor máximo.
const tighten = (limits: RuleLimits, side: "min" | "max", value: unknown) => {
    if (typeof value !== "number") {
        return;
    }
    const current = limits[side];
    limits[side] =
        current === undefined
            ? value
            : side === "min"
              ? Math.max(current, value)
              : Math.min(current, value);
};

/**
 * Lê o mínimo e o máximo de comprimento que uma `rule` declara: o preset por
 * referência (`{ name: "min", min }`), o JSON Schema do preset `schema`
 * (`minItems`/`maxItems`) ou um schema zod (`.min()`, `.max()`, `.length()`,
 * `.nonempty()`), solto ou num array. Função não é lida.
 *
 * Não importa zod: o schema é reconhecido pela forma do `_zod.def`, então o helper
 * não arrasta zod para o caminho crítico de quem só usa preset.
 *
 * @example ruleLimits([{ name: "min", min: 2 }, z.array(z.string()).max(4)]) // → { min: 2, max: 4 }
 */
export default function ruleLimits(rule: unknown): RuleLimits {
    const limits: RuleLimits = {};

    for (const ref of [rule].flat()) {
        if (!ref || typeof ref !== "object") {
            continue;
        }

        if ("_zod" in ref) {
            fromZod((ref as { _zod?: { def?: ZodDef } })._zod?.def, limits);
            continue;
        }

        const preset = ref as Record<string, unknown>;
        if (preset.name === "min" || preset.name === "max") {
            tighten(limits, preset.name, preset[preset.name]);
        }

        // O preset `schema` só monta o zod ao validar, então o limite sai do JSON
        // Schema cru que veio do back.
        if (preset.name === "schema" && preset.schema && typeof preset.schema === "object") {
            const json = preset.schema as Record<string, unknown>;
            tighten(limits, "min", json.minItems);
            tighten(limits, "max", json.maxItems);
        }
    }

    return limits;
}