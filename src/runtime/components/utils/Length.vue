<template>
    <span
        v-if="props.length"
        :class="[props.ui.container, _class]"
    >
        {{ valueLength }} / {{ props.length }}
    </span>
</template>

<script lang="ts">
    /**
     * Contador de caracteres: quanto já foi digitado sobre o `length` do campo.
     */
    import { computed, watch } from "vue";

    import { useUtil } from "#rform/composables";
    import type { DeepPartial } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    const ui = {
        container:
            "absolute right-2 top-0 w-fit -translate-y-1/2 rounded-(--rf-radius-sm) bg-(--rf-color-background-100) text-xs leading-none px-1 py-0.5 font-bold text-(--rf-color-contrast) transition-all duration-300",
        percentages: {
            60: "text-(--rf-color-warn)",
            80: "text-(--rf-color-danger)",
            100: "bg-(--rf-color-danger) text-(--rf-color-danger-fg)"
        } as Record<number, string>
    };

    export const defaults = defineDefaults({ ui });

    export type Props = {
        length?: number | string;
        ui?: DeepPartial<typeof defaults.ui>;
    };
</script>

<script setup lang="ts">
    const { props, upper } = useUtil<Props>();

    const max = computed(() => {
        return typeof props.value.length === "string"
            ? Number.parseInt(props.value.length)
            : props.value.length;
    });

    watch(
        () => upper.model.value,
        (value) => {
            if (max.value === undefined) {
                return;
            }

            const inString = String(value);

            if (inString.length >= max.value + 1) {
                const cut = inString.substring(0, max.value);

                if (typeof value === "number") {
                    value = Number.parseInt(cut);
                    return Number.parseInt(cut);
                }

                upper.model.value = cut;
            }
        }
    );

    const valueLength = computed(() => {
        return String(upper.model.value ?? "").length;
    });

    const _class = computed(() => {
        if (max.value === undefined) {
            return "";
        }

        const currentPercentage = Math.round((valueLength.value / max.value) * 100);

        const percentagesArray = Object.keys(props.value.ui.percentages)
            .map((v) => Number(v))
            .sort((a, b) => b - a);

        for (const percentage of percentagesArray) {
            if (currentPercentage >= percentage && props.value.ui.percentages[percentage]) {
                return props.value.ui.percentages[percentage];
            }
        }

        return "";
    });
</script>