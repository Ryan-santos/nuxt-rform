<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <div :class="props.ui?.group?.wrapper?.container">
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
                        :value="typed[0]"
                        v-mask="mask"
                        :autocomplete="props.autocomplete"
                        :disabled="props.disabled"
                        :name="String(props.name)"
                        type="text"
                        inputmode="numeric"
                        :placeholder="tr(props.text?.hint)"
                        :class="props.ui?.group?.field?.input"
                        @blur="validate(0)"
                        @input="onPartInput(0, $event)"
                    />
                    <template v-if="props.range">
                        <span :class="props.ui?.group?.field?.separator">
                            {{ tr(props.text?.separator) }}
                        </span>
                        <input
                            :value="typed[1]"
                            v-mask="mask"
                            :disabled="props.disabled"
                            :name="String(props.name)"
                            type="text"
                            inputmode="numeric"
                            :placeholder="tr(props.text?.hint)"
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

            <div
                v-if="$slots.trailing"
                :class="props.ui?.group?.wrapper?.trailing"
            >
                <slot name="trailing" />
            </div>

            <RUtilsLoading v-if="props.loading !== undefined" />
        </div>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de hora `HH:mm`: input mascarado mais as roletas de hora e minuto.
     *
     * @example <RHour name="inicio" />
     */
    import { computed, ref, useTemplateRef, watch } from "vue";

    import { useField, useRangeParts } from "#rform/composables";
    import type { Autocomplete, Element, TextProp } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { vMask } from "#rform/utils";
    import { defineDefaults } from "#rform/utils";

    export const pad = (n: number) => String(n).padStart(2, "0");

    export const clampHours = (n: number) => Math.max(0, Math.min(23, n));

    export const clampMinutes = (n: number) => Math.max(0, Math.min(59, n));

    export type TimeParts = {
        hours: number;
        minutes: number;
    };

    export const parseTime = (s: string | null | undefined): TimeParts | null => {
        const trimmed = s?.trim() ?? "";

        if (!trimmed) {
            return null;
        }

        const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);

        if (!m) {
            return null;
        }

        const hours = Number.parseInt(m[1] ?? "");
        const minutes = Number.parseInt(m[2] ?? "");

        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return null;
        }

        return {
            hours: clampHours(hours),
            minutes: clampMinutes(minutes)
        };
    };

    export const formatTime = (hours: number, minutes: number) =>
        `${pad(clampHours(hours))}:${pad(clampMinutes(minutes))}`;

    export type TimeValue = string | (string | undefined)[] | undefined;

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                wrapper: {
                    container: `
                        relative z-0 flex w-full flex-row items-center rounded-(--rf-radius-xl)
                        bg-(--rf-color-background-100) outline-2 outline-transparent transition-all duration-300
                        has-[:focus]:text-(--rf-color-primary) has-[:focus]:outline-(--rf-color-primary)
                    `,
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
                }
            }
        },
        default: "",
        text: {
            hint: "hint",
            separator: "separator"
        }
    });

    export type Props = Element<typeof defaults, "hour", TimeValue> &
        Autocomplete &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Placeholder"] &
        TextProp<typeof defaults.text> & {
            range?: boolean;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined
    });

    const { model, props, tr } = useField(_props);

    const mask = {
        mask: "##:##",
        eager: true
    };

    const typed = ref<[string, string]>(["", ""]);

    const field = useTemplateRef<HTMLElement>("field");
    const focused = ref(false);

    const hasValue = computed(() => !!typed.value[0] || !!typed.value[1]);

    const inputsHidden = computed(
        () => !!props.value.placeholder && !focused.value && !hasValue.value
    );

    const onFocusIn = () => {
        focused.value = true;
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
        isRange: () => !!props.value.range,
        valid: (part) => !!parseTime(part)
    });

    const normalizeIncoming = (val: unknown): string => {
        if (typeof val !== "string") {
            return "";
        }

        const parsed = parseTime(val);
        return parsed ? formatTime(parsed.hours, parsed.minutes) : "";
    };

    const incomingToTyped = (val: unknown): [string, string] => {
        if (props.value.range) {
            const arr = Array.isArray(val) ? val : [];
            return [normalizeIncoming(arr[0]), normalizeIncoming(arr[1])];
        }

        return [normalizeIncoming(val), ""];
    };

    const computeModel = (): TimeValue => {
        const toModelString = (s: string): string | undefined => {
            const p = parseTime(s);
            return p ? formatTime(p.hours, p.minutes) : undefined;
        };

        const a = toModelString(typed.value[0]);
        const b = toModelString(typed.value[1]);

        if (props.value.range) {
            return [a, b];
        }

        return a ?? "";
    };

    let internalWrite = false;

    watch(
        model,
        (val) => {
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
        const raw = typed.value[index];

        if (!raw) {
            return;
        }

        const parsed = parseTime(raw);
        const next: [string, string] = [...typed.value] as [string, string];

        next[index] = parsed ? formatTime(parsed.hours, parsed.minutes) : "";

        if (next[index] !== raw) {
            typed.value = next;
        }
    };
</script>