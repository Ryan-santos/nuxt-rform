<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <div
            v-if="list"
            role="group"
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
                    :value="keyOf(option.value)"
                    type="checkbox"
                    :class="props.ui?.option?.input"
                    @change="toggle(option)"
                />
                <span :class="props.ui?.option?.indicator">
                    <Icon
                        v-if="isChecked(option)"
                        :name="icon('check')"
                        :class="props.ui?.option?.icon"
                    />
                </span>
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

        <label
            v-else
            :class="props.ui?.option?.container"
        >
            <input
                :checked="single"
                :disabled="props.disabled"
                :name="String(props.name)"
                type="checkbox"
                :class="props.ui?.option?.input"
                @change="model = inputChecked($event)"
            />
            <span :class="props.ui?.option?.indicator">
                <Icon
                    v-if="single"
                    :name="icon('check')"
                    :class="props.ui?.option?.icon"
                />
            </span>
            <span
                v-if="props.placeholder"
                :class="props.ui?.option?.label"
            >
                {{ tr(props.placeholder) }}
            </span>
        </label>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Caixa de marcar. Sem `options` é um booleano, rotulado pelo `placeholder` como
     * o `RSwitch`; com `options` o model é a lista dos `value` marcados, nos mesmos
     * três formatos e com o mesmo `pick` do `RSelect`.
     *
     * @example <RCheckbox name="aceite" placeholder="form.aceite" />
     * @example <RCheckbox name="dias" :options="['seg', 'ter', 'qua']" />
     */
    import { computed } from "vue";

    import { useField } from "#rform/composables";
    import type {
        Element,
        LabelOf,
        OptionItem,
        OptionKey,
        Options,
        OriginalOf,
        ValueOf
    } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults, icon, inputChecked, keyOf, normalizeOptions } from "#rform/utils";

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
                    flex size-5 shrink-0 items-center justify-center rounded-(--rf-radius-sm) border-2
                    border-(--rf-color-border) bg-(--rf-color-background-100) text-xs transition-all duration-300
                    peer-checked:border-(--rf-color-primary) peer-checked:bg-(--rf-color-primary) peer-checked:text-(--rf-color-primary-fg)
                    peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--rf-color-primary)
                `,
                icon: "",
                label: ""
            }
        },
        default: false,
        pick: { value: "id", label: "name" }
    });

    /** O model: `boolean` sem `options`, a lista dos `value` marcados com. */
    export type CheckboxModel<Opts, KeyValue extends string> = [Opts] extends [never]
        ? boolean
        : ValueOf<Opts, KeyValue>[];

    export type Props<
        Opts extends Options = never,
        KeyValue extends string = "id",
        KeyLabel extends string = "name"
    > = Omit<
        Element<typeof defaults, "checkbox">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Placeholder"] & {
            options?: Opts;
            // Por extenso, e não num alias: ver "O generic do `RSelect` vai até o
            // model" no `.claude/CLAUDE.md`.
            pick?: {
                value?: KeyValue & OptionKey<Opts> & string;
                label?: KeyLabel & OptionKey<Opts> & string;
            };
            default?: CheckboxModel<Opts, KeyValue>;
            modelValue?: CheckboxModel<Opts, KeyValue>;
            "onUpdate:modelValue"?: ($event: CheckboxModel<Opts, KeyValue>) => void;
        };

    type InternalProps = Omit<
        Element<typeof defaults, "checkbox">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Placeholder"] & {
            options?: Options;
            pick?: { value?: string; label?: string };
            default?: unknown;
            modelValue?: unknown;
        };
</script>

<script
    setup
    lang="ts"
    generic="
        Opts extends Options = never,
        KeyValue extends string = 'id',
        KeyLabel extends string = 'name'
    "
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

    const { model, props, tr } = useField(_props as unknown as InternalProps, {
        // `defaults.default` é estático (`false`), então a lista mora aqui:
        // `default` troca o que o seed escreve, `get` normaliza o que vem de fora.
        // `_props.options` é a prop crua, antes do merger.
        //
        // Em forma de método e sem parênteses aninhados além de um nível: o
        // `src/vite.plugin.ts` casa os argumentos por regex.
        default(value) {
            return _props.options === undefined || Array.isArray(value) ? value : [];
        },
        get(value) {
            if (_props.options === undefined) {
                return value;
            }

            return Array.isArray(value) ? value : [];
        }
    });

    const list = computed(() => props.value.options !== undefined);

    const items = computed(
        () => normalizeOptions(props.value.options, props.value.pick ?? {}) as Item[]
    );

    const single = computed(() => model.value === true);

    const marked = computed(() => (Array.isArray(model.value) ? model.value : []));

    const isChecked = (option: Item) => {
        const key = keyOf(option.value);
        return marked.value.some((value) => keyOf(value) === key);
    };

    // Sempre um array novo: um `push` no model mudaria o objeto do form sem passar
    // pelo setter, e o erro do campo não seria limpo.
    const toggle = (option: Item) => {
        const key = keyOf(option.value);

        model.value = isChecked(option)
            ? marked.value.filter((value) => keyOf(value) !== key)
            : [...marked.value, option.value];
    };
</script>