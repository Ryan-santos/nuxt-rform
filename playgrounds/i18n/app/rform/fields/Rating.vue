<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel />

        <div :class="props.ui?.group">
            <button
                v-for="star in props.max"
                :key="star"
                :disabled="props.disabled"
                type="button"
                :class="[
                    props.ui?.star?.base,
                    star <= current ? props.ui?.star?.on : props.ui?.star?.off
                ]"
                @click="model = star"
            >
                <Icon name="fa6-solid:star" />
            </button>
        </div>

        <RUtilsHint />
        <RUtilsDescription />
        <RUtilsError />
    </div>
</template>

<script lang="ts">
    /**
     * Campo do usuário: entra no `FieldType`, no `components-map` e no `Components`, do
     * mesmo jeito que um embutido. `max` é o número de estrelas.
     *
     * @example <RRating name="nota" label="Nota" :max="10" />
     */
    import { computed } from "vue";

    import { useField } from "#rform/composables";
    import type { Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: "flex w-fit flex-row gap-1 rounded-xl bg-background-100 p-2",
            star: {
                base: "cursor-pointer rounded-md p-1 text-xl transition-colors",
                on: "text-warn",
                off: `
                    text-contrast/20
                    hover:text-contrast/40
                `
            }
        },
        default: 0,
        max: 5
    });

    export type Props = Element<typeof defaults, "rating"> &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Hint"] & {
            max?: number;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined
    });

    const { model, props } = useField(_props);

    const current = computed(() => Number(model.value ?? 0));
</script>