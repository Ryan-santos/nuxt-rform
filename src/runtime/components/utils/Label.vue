<template>
    <label
        v-if="props.label"
        :class="props.ui.container"
    >
        {{ tr(props.label) }}
        <span
            v-if="props.required"
            :class="props.ui.required"
        >
            *
        </span>
    </label>
</template>

<script lang="ts">
    /**
     * Rótulo do campo. Só renderiza quando o campo tem `label`.
     */
    import { useUtil } from "#rform/composables";
    import type { DeepPartial, TrInput } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    // Sem sentinela `label: ""`: `label` é `TrInput`, e num app com i18n esse tipo é
    // `ModuleKey | Literal` — `""` não é nenhum dos dois, e o `v-if` lê `undefined`
    // exatamente como lia `""`.
    export const defaults = defineDefaults({
        ui: {
            container: "",
            required: "font-bold text-(--rf-color-danger)"
        }
    });

    export type Props = {
        label?: TrInput;
        ui?: DeepPartial<typeof defaults.ui>;
    };
</script>

<script setup lang="ts">
    const { props, tr } = useUtil<Props>();
</script>