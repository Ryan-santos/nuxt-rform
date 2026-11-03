import type { MaskInputOptions } from "maska";

import type { FieldType } from "#rform/types/fields";

import type { BaseContext, RulePreset } from "./resolveRule";

/**
 * O objeto que uma `validation` recebe: `value` e `form` vêm de graça, o parâmetro
 * é só o que o preset acrescenta — e é ele que o `rule` cobra como `{ name, ...args }`.
 * Também estreita: `RuleContext<{ value: string }>` tipa `value` como string.
 *
 * @example validation: ({ value, uf }: RuleContext<{ uf: string }>) => …
 */
// Vazio de propósito: preset sem args é referenciado só pelo nome.
// oxlint-disable-next-line typescript/no-generated-empty-object-type
export type RuleContext<T extends object = Record<never, never>> = BaseContext & T;

/**
 * Forma de autoria de uma rule. `available` é estreitado aos field types que
 * existem, então um typo ("txt") falha na definição em vez de nunca casar.
 */
export type RuleDefinition = Omit<RulePreset, "available"> & {
    /** Field types que esta rule serve. Omitir serve todos. */
    available?: readonly FieldType[];
};

/**
 * O `const` no type parameter é o que preserva `available: ["text"]` como tupla
 * literal — sem ele o filtro de preset por componente para de funcionar.
 */
export const defineRule = <const T extends RuleDefinition>(rule: T): T => rule;

/** Define um preset de máscara: as opções vão cruas pro maska. */
export const defineMask = <const T extends MaskInputOptions>(mask: T): T => mask;

export default { defineRule, defineMask };