<template>
    <p
        v-if="props.error"
        :class="props.ui?.container"
    >
        <Icon
            v-if="props.icons.alert"
            :name="props.icons.alert"
            :class="props.ui?.icon"
        />
        {{ props.error }}
    </p>
</template>

<script lang="ts">
    /**
     * Mensagem de erro do campo. Chega pronta: o `errorsBag` empurra a mensagem já
     * resolvida, e o `error` do call site quem traduz é o `useField`.
     */
    import { useUtil } from "#rform/composables";
    import type { DeepPartialUI, IconsProp, TrInput } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    // Sem sentinela `error: ""`, como no Label: `error` é `TrInput`, e num app com
    // i18n `""` não é nenhum dos membros desse tipo.
    export const defaults = defineDefaults({
        ui: {
            container: "text-(--rf-color-danger) ml-1 text-sm font-semibold tracking-wide",
            icon: "mr-0.5 -mb-0.5 animate-pulse"
        },
        // `alert: ""` esconde o ícone.
        icons: {
            alert: "alert"
        }
    });

    export type Props = {
        error?: TrInput;
        ui?: DeepPartialUI<typeof defaults.ui>;
    } & IconsProp<typeof defaults.icons>;
</script>

<script setup lang="ts">
    const { props } = useUtil<Props>();
</script>