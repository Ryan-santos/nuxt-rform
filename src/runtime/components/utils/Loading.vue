<template>
    <Transition v-bind="props.ui.transition">
        <Icon
            v-if="props.loading"
            :name="props.icons.loading"
            size="1.2rem"
            :class="props.ui.icon"
        />
    </Transition>
</template>

<script lang="ts">
    /**
     * Indicador de carregamento, ligado enquanto uma validação async está em voo.
     */
    import { useUtil } from "#rform/composables";
    import type { DeepPartialUI, IconsProp } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    const ui = {
        transition: {
            name: "",
            enterActiveClass: "transition-all duration-500",
            enterToClass: "",
            enterFromClass: "opacity-0",
            leaveActiveClass: "transition-all duration-500",
            leaveToClass: "opacity-0",
            leaveFromClass: ""
        },
        icon: "shrink-0 text-(--rf-color-primary) m-3 ml-0"
    };

    export const defaults = defineDefaults({ ui, icons: { loading: "loading" } });

    export type Props = {
        loading?: boolean;
        ui?: DeepPartialUI<typeof defaults.ui>;
    } & IconsProp<typeof defaults.icons>;
</script>

<script setup lang="ts">
    const { props } = useUtil<Props>();
</script>