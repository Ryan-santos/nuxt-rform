<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel />

        <div :class="props.ui?.stars">
            <button
                v-for="star in props.max"
                :key="star"
                :disabled="props.disabled"
                type="button"
                :data-testid="`rating-${star}`"
                :class="star <= Number(model ?? 0) ? props.ui?.on : props.ui?.off"
                @click="model = star"
            >
                *
            </button>
        </div>

        <RUtilsHint />
        <RUtilsError />
    </div>
</template>

<script lang="ts">
    /**
     * Campo novo do usuário — cobre o caminho de um `.vue` em `app/rform/fields` que
     * não substitui nada.
     *
     * O `disabled` é o que um campo próprio precisa honrar sozinho: o `useField` o
     * entrega em `props.disabled`, e o template o repassa ao controle e ao container.
     * O `visibleWhen` do schema não pede nada — quem decide montar é o `RDynamic`.
     *
     * @example <RRating name="nota" :max="10" />
     */
    import { useField } from "#rform/composables";
    import type { Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "rating",
            disabled: "pointer-events-none opacity-60",
            stars: "rating-stars",
            on: "rating-on",
            off: "rating-off"
        },
        default: 0,
        max: 5
    });

    export type Props = Element<typeof defaults, "rating"> &
        Utils["Label"] &
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
</script>