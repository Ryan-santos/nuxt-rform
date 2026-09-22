<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <RUtilsDropdown v-model:open="open">
            <template #default="{ reference }">
                <div
                    :ref="reference"
                    :class="[
                        props.ui?.group?.wrapper?.container,
                        open ? props.ui?.group?.wrapper?.open : props.ui?.group?.wrapper?.closed
                    ]"
                >
                    <div
                        v-if="$slots.leading"
                        :class="props.ui?.group?.wrapper?.leading"
                    >
                        <slot name="leading" />
                    </div>

                    <div
                        ref="field"
                        :class="props.ui?.group?.field?.container"
                        @focusin="onFocusIn"
                        @focusout="onFocusOut"
                        @mousedown="onFieldMousedown"
                    >
                        <RUtilsPlaceholder
                            v-if="props.placeholder"
                            :focused="focused"
                        />
                        <div
                            :class="[
                                props.ui?.group?.field?.inputs,
                                inputsHidden ? props.ui?.group?.field?.inputsHidden : ''
                            ]"
                        >
                            <input
                                v-if="props.mode === 'multiple'"
                                :value="typed[0]"
                                :autocomplete="props.autocomplete"
                                :disabled="props.disabled"
                                :name="String(props.name)"
                                type="text"
                                :placeholder="placeholderHint"
                                readonly
                                :class="props.ui?.group?.field?.input"
                            />
                            <input
                                v-else
                                :value="typed[0]"
                                v-mask="mask"
                                :autocomplete="props.autocomplete"
                                :disabled="props.disabled"
                                :name="String(props.name)"
                                type="text"
                                :placeholder="placeholderHint"
                                :class="props.ui?.group?.field?.input"
                                @blur="validate(0)"
                                @input="onPartInput(0, $event)"
                            />
                            <template v-if="props.mode === 'range'">
                                <span :class="props.ui?.group?.field?.separator">
                                    {{ tr(props.text?.separator) }}
                                </span>
                                <input
                                    :value="typed[1]"
                                    v-mask="mask"
                                    :disabled="props.disabled"
                                    :name="String(props.name)"
                                    type="text"
                                    :placeholder="placeholderHint"
                                    :class="[
                                        props.ui?.group?.field?.input,
                                        props.ui?.group?.field?.inputEnd
                                    ]"
                                    @blur="validate(1)"
                                    @input="onPartInput(1, $event)"
                                    @keydown="onPartKeydown"
                                />
                            </template>
                        </div>
                    </div>

                    <button
                        :disabled="props.disabled"
                        type="button"
                        :class="props.ui?.group?.trigger"
                        @click="open = !open"
                    >
                        <Icon :name="icon('calendar')" />
                    </button>

                    <div
                        v-if="$slots.trailing"
                        :class="props.ui?.group?.wrapper?.trailing"
                    >
                        <slot name="trailing" />
                    </div>

                    <RUtilsLoading v-if="props.loading !== undefined" />
                </div>
            </template>

            <template #content>
                <RUtilsCalendar />
            </template>
        </RUtilsDropdown>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de data: input mascarado mais calendário em dropdown. O model é ISO; o que
     * se digita e o que se exibe seguem o `formats.date` do locale ativo.
     *
     * @example <RDate name="nascimento" mode="range" />
     */
    import { computed, ref, useTemplateRef, watch } from "vue";

    import { useField, useRangeParts } from "#rform/composables";
    import type { Autocomplete, Element, TextProp } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { vMask, icon } from "#rform/utils";
    import { dateFormat, defineDefaults } from "#rform/utils";

    import {
        formatIso,
        parseIncoming,
        type DateValue,
        type DisableSpec,
        type Mode,
        type ModelType
    } from "../utils/Calendar.vue";

    export type { DateValue, DisableSpec, Mode, ModelType };

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                wrapper: {
                    container: `
                        relative z-0 flex w-full flex-row items-center rounded-(--rf-radius-xl)
                        bg-(--rf-color-background-100) outline-2 transition-all duration-300
                        has-[:focus]:outline-(--rf-color-primary) has-[:focus]:text-(--rf-color-primary)
                    `,
                    open: "text-(--rf-color-primary) outline-(--rf-color-primary)",
                    closed: "outline-transparent",
                    leading: "flex p-3 pr-0",
                    trailing: "flex p-3 pl-0"
                },
                field: {
                    container: "relative grow",
                    inputs: "flex flex-row items-center transition-opacity duration-300",
                    inputsHidden: "opacity-0",
                    input: "w-full rounded-(--rf-radius-lg) bg-transparent p-3 outline-none",
                    inputEnd: "text-end",
                    separator: "my-auto w-fit px-1 opacity-50"
                },
                trigger: `
                    flex shrink-0 cursor-pointer p-3 transition-colors
                    hover:text-(--rf-color-primary)
                `
            },
            Utils: {
                Dropdown: {
                    popover: "w-72"
                }
            }
        },
        default: "",
        text: {
            hint: "hint",
            hintTime: "hintTime",
            separator: "separator"
        }
    });

    export type Props<M extends Mode = "single"> = Omit<
        Element<typeof defaults, "date">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Autocomplete &
        Utils["Description"] &
        Utils["Dropdown"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Length"] &
        Utils["Placeholder"] &
        TextProp<typeof defaults.text> & {
            mode?: M;
            time?: boolean;
            disable?: DisableSpec;
            default?: ModelType<M>;
            modelValue?: ModelType<M>;
            "onUpdate:modelValue"?: ($event: ModelType<M>) => void;
        };

    type InternalProps = Omit<
        Element<typeof defaults, "date">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Autocomplete &
        Utils["Description"] &
        Utils["Dropdown"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Length"] &
        Utils["Placeholder"] &
        TextProp<typeof defaults.text> & {
            mode?: Mode;
            time?: boolean;
            disable?: DisableSpec;
            default?: unknown;
            modelValue?: unknown;
        };
</script>

<script setup lang="ts" generic="M extends Mode = 'single'">
    const _props = withDefaults(defineProps<Props<M>>(), {
        disabled: undefined,
        required: undefined,
        loading: undefined
    });

    const { model, props, tr } = await useField(_props as unknown as InternalProps);

    // Máscara, regex de parse e exibição saem todas do `formats.date` do pack ativo.
    // `computed` porque `tr` lê o locale a cada chamada, então trocar de idioma
    // re-deriva as três; só o model, que é ISO, não muda.
    const pattern = computed(() => dateFormat(tr("rform.formats.date")));

    const formatLocal = (d: Date | null): string => pattern.value.format(d, !!props.value.time);

    const toIso = (d: Date | null) => formatIso(d, !!props.value.time);

    const parseLocal = (s: string): Date | null => pattern.value.parse(s, !!props.value.time);

    const typed = ref<[string, string]>(["", ""]);

    const parsedTyped = computed<[Date | null, Date | null]>(() => [
        parseLocal(typed.value[0]),
        parseLocal(typed.value[1])
    ]);

    const mask = computed(() => ({
        mask: pattern.value.mask(!!props.value.time),
        eager: true
    }));

    const placeholderHint = computed(() =>
        props.value.time ? tr(props.value.text?.hintTime) : tr(props.value.text?.hint)
    );

    const incomingToTyped = (val: unknown): [string, string] => {
        const m = props.value.mode ?? "single";

        const incoming = (value: unknown) => parseIncoming(value, pattern.value.pattern);

        if (m === "range") {
            const arr = Array.isArray(val) ? val : [];
            return [formatLocal(incoming(arr[0])), formatLocal(incoming(arr[1]))];
        }

        if (m === "multiple") {
            const arr: unknown[] = Array.isArray(val) ? val : [];
            const list = arr.map((v) => formatLocal(incoming(v))).filter(Boolean);
            return [list.join(", "), ""];
        }

        return [formatLocal(incoming(val)), ""];
    };

    const computeModel = (): DateValue => {
        const m = props.value.mode ?? "single";

        if (m === "range") {
            const [a, b] = parsedTyped.value;
            return [toIso(a), toIso(b)];
        }

        return toIso(parsedTyped.value[0]) ?? "";
    };

    let internalWrite = false;

    // O `pattern` também é fonte, não só o `model`: trocar de idioma não muda o
    // model, mas muda como ele se escreve.
    watch(
        [model, pattern],
        ([val]) => {
            if (internalWrite) {
                return;
            }
            const next = incomingToTyped(val);
            if (next[0] !== typed.value[0] || next[1] !== typed.value[1]) {
                typed.value = next;
            }
        },
        {
            immediate: true,
            flush: "sync"
        }
    );

    watch(
        typed,
        () => {
            if (props.value.mode === "multiple") {
                return;
            }

            internalWrite = true;
            const next = computeModel();
            if (JSON.stringify(next) !== JSON.stringify(model.value)) {
                model.value = next;
            }
            internalWrite = false;
        },
        {
            deep: true,
            flush: "sync"
        }
    );

    const validate = (index: number) => {
        if (props.value.mode === "multiple") {
            return;
        }

        if (!typed.value[index]) {
            return;
        }

        const d = parsedTyped.value[index];
        if (!d) {
            const next: [string, string] = [...typed.value] as [string, string];
            next[index] = "";
            typed.value = next;
        }
    };

    const field = useTemplateRef<HTMLElement>("field");
    const open = ref(false);
    const focused = ref(false);

    const hasValue = computed(() => !!typed.value[0] || !!typed.value[1]);

    const inputsHidden = computed(
        () => !!props.value.placeholder && !focused.value && !hasValue.value
    );

    const onFocusIn = () => {
        focused.value = true;
        open.value = true;
    };

    const onFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !field.value?.contains(next)) {
            focused.value = false;
        }
    };

    const { onPartInput, onPartKeydown, onFieldMousedown } = useRangeParts({
        field,
        typed,
        isRange: () => props.value.mode === "range",
        valid: (part) => !!parseLocal(part)
    });
</script>