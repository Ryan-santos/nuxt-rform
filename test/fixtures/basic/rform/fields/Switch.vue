<template>
    <div
        :class="props.ui?.container"
        data-testid="custom-switch"
    >
        <RUtilsLabel />
        <button
            type="button"
            data-testid="custom-switch-toggle"
            @click="model = !model"
        >
            {{ model ? "on" : "off" }}
        </button>
    </div>
</template>

<script lang="ts">
    /**
     * Substituição de um embutido: mesmo nome troca o componente inteiro, e o original
     * continua alcançável pelo alias `#rform/builtin` — é o que deixa embrulhar em vez
     * de reescrever.
     *
     * @example <RSwitch name="ativo" />
     */
    import { defaults as builtin } from "#rform/builtin/fields/Switch.vue";
    import { useField } from "#rform/composables";
    import type { Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults } from "#rform/utils";

    export const defaults = defineDefaults({
        ...builtin,
        ui: {
            ...builtin.ui,
            container: "custom-switch"
        },
        default: true
    });

    export type Props = Element<typeof defaults, "switch"> & Utils["Label"];
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        loading: undefined
    });

    const { model, props } = useField(_props);
</script>