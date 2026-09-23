<template>
    <p
        v-if="props.description"
        :class="props.ui"
    >
        {{ tr(props.description) }}
    </p>
</template>

<script lang="ts">
    /**
     * Texto auxiliar do campo. Só renderiza quando o campo tem `description`.
     */
    import { useUtil } from "#rform/composables";
    import type { TrInput } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    // Sem sentinela `description: ""` — ver a nota em `utils/Label.vue`.
    export const defaults = defineDefaults({
        ui: "text-xs text-current/50"
    });

    export type Props = {
        description?: TrInput;
        ui?: typeof defaults.ui;
    };
</script>

<script setup lang="ts">
    const { props, tr } = useUtil<Props>();
</script>