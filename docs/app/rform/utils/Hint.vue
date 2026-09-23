<template>
    <span
        v-if="props.hint"
        :class="props.ui.container"
    >
        <Icon
            :name="props.ui.icon.name"
            :class="props.ui.icon.class"
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
    import type { DeepPartial } from "#rform/types";
    import { defineDefaults, icon } from "#rform/utils";

    export const defaults = defineDefaults({
        hint: "",
        ui: {
            container: "ml-1 flex flex-row items-center gap-1 text-xs text-current/50",
            icon: {
                name: icon("alert"),
                class: "shrink-0"
            }
        }
    });

    export type Props = {
        hint?: string;
        ui?: DeepPartial<typeof defaults.ui>;
    };
</script>

<script setup lang="ts">
    const { props } = useUtil<Props>();
</script>