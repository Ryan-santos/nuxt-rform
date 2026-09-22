import { watch, type Ref, type ShallowRef } from "vue";

import { inputValue } from "#rform/utils";

export type RangePartsOptions = {
    /** O container das duas partes; é dele que sai a ordem do DOM. */
    field: Readonly<ShallowRef<HTMLElement | null>>;
    /** O que está escrito em cada parte, no mesmo índice dos inputs. */
    typed: Ref<[string, string]>;
    /** Se o campo está em modo range — `mode === "range"` num, `range` no outro. */
    isRange: () => boolean;
    /** Se o texto de uma parte já forma um valor completo. */
    valid: (part: string) => boolean;
};

export type RangeParts = {
    onPartInput: (index: 0 | 1, event: Event) => void;
    onPartKeydown: (event: KeyboardEvent) => void;
    onFieldMousedown: (event: MouseEvent) => void;
};

/**
 * As duas partes de um campo range: escreve o que se digita em `typed`, avança
 * sozinho quando a primeira fica completa, volta no Backspace, e roteia o clique que
 * cai fora dos inputs. Compartilhado pelo `RDate` e pelo `RHour`, que só diferem em
 * como leem o modo e o que consideram um valor completo.
 *
 * @example
 * const { onPartInput, onPartKeydown, onFieldMousedown } = useRangeParts({
 *     field,
 *     typed,
 *     isRange: () => props.value.mode === "range",
 *     valid: (part) => !!parseLocal(part)
 * });
 * // <input :value="typed[0]" @input="onPartInput(0, $event)" />
 */
export default function useRangeParts({
    field,
    typed,
    isRange,
    valid
}: RangePartsOptions): RangeParts {
    // Pela ordem do DOM, como o `focusFirstError`: as duas partes são irmãs, e o
    // índice delas é o mesmo do `typed`.
    const focusPart = (index: number) => {
        field.value?.querySelectorAll("input")[index]?.focus();
    };

    // O avanço só pode nascer de tecla: um model que chega preenchido de fora faz a
    // mesma transição de inválido para válido, e roubaria o cursor.
    let typedByUser = false;

    watch(
        () => valid(typed.value[0]),
        (now, before) => {
            const byUser = typedByUser;
            typedByUser = false;

            // Só na transição inválido → válido: reeditar um valor que já valia
            // mantém o cursor onde está.
            if (!byUser || !isRange() || !now || before) {
                return;
            }

            focusPart(1);
        },
        { flush: "post" }
    );

    return {
        // Por `:value` + `@input`, e não `v-model` (ver `inputValue`). Só a primeira
        // parte avança sozinha, então só ela marca a tecla.
        onPartInput: (index, event) => {
            if (index === 0) {
                typedByUser = true;
            }
            typed.value[index] = inputValue(event);
        },

        onPartKeydown: (event) => {
            const input = event.target as HTMLInputElement;

            if (event.key !== "Backspace" || input.value) {
                return;
            }

            event.preventDefault();
            focusPart(0);
        },

        // Clique fora dos inputs (o separador, a sobra do container) leva ao que
        // falta preencher, em vez de não fazer nada.
        onFieldMousedown: (event) => {
            if (!isRange() || (event.target as HTMLElement).tagName === "INPUT") {
                return;
            }

            event.preventDefault();
            focusPart(typed.value[0] && !typed.value[1] ? 1 : 0);
        }
    };
}