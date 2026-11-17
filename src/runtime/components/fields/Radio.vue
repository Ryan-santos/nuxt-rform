<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <div
            role="radiogroup"
            :class="props.ui?.group?.container"
        >
            <label
                v-for="option in items"
                :key="keyOf(option.value)"
                :class="props.ui?.option?.container"
            >
                <input
                    :checked="isChecked(option)"
                    :disabled="props.disabled"
                    :name="group"
                    :value="keyOf(option.value)"
                    type="radio"
                    :class="props.ui?.option?.input"
                    @change="model = option.value"
                />
                <span :class="props.ui?.option?.indicator" />
                <span :class="props.ui?.option?.label">
                    <slot
                        :option
                        :checked="isChecked(option)"
                    >
                        {{ option.label }}
                    </slot>
                </span>
            </label>
        </div>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Escolha única entre opções sempre visíveis. Aceita os mesmos três formatos de
     * `options` e o mesmo `pick` do `RSelect`, e o model guarda o `value` da opção.
     *
     * @example <RRadio name="plano" :options="planos" :pick="{ value: 'id', label: 'nome' }" />
     */
    import { computed, useId } from "vue";

    import { useField } from "#rform/composables";
    import type {
        Element,
        LabelOf,
        OptArrayObj,
        OptionItem,
        OptionKey,
        Options,
        OriginalOf,
        ValueOf
    } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults, keyOf, normalizeOptions } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "flex w-full flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                container: "flex flex-col gap-2"
            },
            option: {
                container: "relative flex cursor-pointer flex-row items-center gap-3",
                input: "peer absolute size-5 cursor-pointer opacity-0",
                indicator: `
                    flex size-5 shrink-0 items-center justify-center rounded-full border-2
                    border-(--rf-color-border) bg-(--rf-color-background-100) transition-all duration-300
                    peer-checked:border-6 peer-checked:border-(--rf-color-primary)
                    peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--rf-color-primary)
                `,
                label: ""
            }
        },
        default: null,
        // Uma prop só, como no `RSelect`: o `merger` recursiona e conserva a chave
        // que o call site não escreveu.
        pick: { value: "id", label: "name" }
    });

    export type Props<
        Opts extends Options = OptArrayObj,
        KeyValue extends string = "id",
        KeyLabel extends string = "name"
    > = Omit<Element<typeof defaults, "radio">, "modelValue" | "onUpdate:modelValue" | "default"> &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] & {
            options: Opts;
            // Por extenso, e não num alias: ver "O generic do `RSelect` vai até o
            // model" no `.claude/CLAUDE.md`.
            pick?: {
                value?: KeyValue & OptionKey<Opts> & string;
                label?: KeyLabel & OptionKey<Opts> & string;
            };
            default?: ValueOf<Opts, KeyValue> | null;
            modelValue?: ValueOf<Opts, KeyValue> | null;
            "onUpdate:modelValue"?: ($event: ValueOf<Opts, KeyValue>) => void;
        };

    type InternalProps = Omit<
        Element<typeof defaults, "radio">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] & {
            options: Options;
            pick?: { value?: string; label?: string };
            default?: unknown;
            modelValue?: unknown;
        };
</script>

<script
    setup
    lang="ts"
    generic="Opts extends Options, KeyValue extends string = 'id', KeyLabel extends string = 'name'"
>
    const _props = withDefaults(defineProps<Props<Opts, KeyValue, KeyLabel>>(), {
        required: undefined,
        loading: undefined,
        disabled: undefined
    });

    type Item = OptionItem<OriginalOf<Opts>, ValueOf<Opts, KeyValue>, LabelOf<Opts, KeyLabel>>;

    defineSlots<{
        default(props: { option: Item; checked: boolean }): void;
    }>();

    const { id, model, props } = useField(_props as unknown as InternalProps);

    // O `name` nativo agrupa os inputs, e é o que dá ao grupo as setas do teclado.
    const uid = useId();
    const group = id ?? uid;

    // O único ponto de cast: `normalizeOptions` é puro e devolve `unknown`.
    const items = computed(
        () => normalizeOptions(props.value.options, props.value.pick ?? {}) as Item[]
    );

    // Por `keyOf`, a mesma identidade que o `RSelect` usa: `1` e `"1"` continuam
    // sendo opções diferentes.
    const isChecked = (option: Item) =>
        model.value !== null &&
        model.value !== undefined &&
        keyOf(model.value) === keyOf(option.value);
</script>