<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />
        <RUtilsCalendar />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Calendário inline, sem dropdown — o mesmo `RUtilsCalendar` que o `RDate` abre,
     * exposto como campo.
     *
     * @example <RCalendar name="dia" mode="multiple" />
     */
    import { useField } from "#rform/composables";
    import type { Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults } from "#rform/utils";

    import {
        type DateValue,
        type DisableSpec,
        type Mode,
        type ModelType
    } from "../utils/Calendar.vue";

    export type { DateValue, DisableSpec, Mode, ModelType };

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60"
        },
        default: ""
    });

    export type Props<M extends Mode = "single"> = Omit<
        Element<typeof defaults, "calendar">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Utils["Label"] &
        Utils["Error"] &
        Utils["Calendar"] & {
            mode?: M;
            default?: ModelType<M>;
            modelValue?: ModelType<M>;
            "onUpdate:modelValue"?: ($event: ModelType<M>) => void;
        };

    type InternalProps = Omit<
        Element<typeof defaults, "calendar">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Utils["Label"] &
        Utils["Error"] &
        Utils["Calendar"] & {
            mode?: Mode;
            default?: unknown;
            modelValue?: unknown;
        };
</script>

<script setup lang="ts" generic="M extends Mode = 'single'">
    const _props = withDefaults(defineProps<Props<M>>(), {
        disabled: undefined,
        required: undefined
    });

    const { props } = useField(_props as unknown as InternalProps);
</script>