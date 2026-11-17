<template>
    <span
        v-if="props.hint"
        :class="props.ui.container"
    >
        <Icon
            :name="props.icons.hint"
            :class="props.ui.icon"
        />
        {{ props.hint }}
    </span>
</template>

<script lang="ts">
    /**
     * Util do usuário: a prop `hint` que ele declara passa a existir em todo campo, e o
     * `ui` dele fica em `ui.Utils.Hint`.
     *
     * @example <RRating name="nota" hint="De 1 a 5" />
     */
    import { useUtil } from "#rform/composables";
    import type { DeepPartial, IconsProp } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    export const defaults = defineDefaults({
        hint: "",
        ui: {
            container: "ml-1 flex flex-row items-center gap-1 text-xs text-current/50",
            icon: "shrink-0"
        },
        icons: {
            hint: "alert"
        }
    });

    export type Props = {
        hint?: string;
        ui?: DeepPartial<typeof defaults.ui>;
    } & IconsProp<typeof defaults.icons>;
</script>

<script setup lang="ts">
    const { props } = useUtil<Props>();
</script>