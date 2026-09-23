<template>
    <span
        v-if="props.hint"
        data-testid="hint"
        :class="props.ui.container"
    >
        {{ props.hint }}
    </span>
</template>

<script lang="ts">
    /**
     * Util novo do usuário — cobre a prop que um `app/rform/utils` contribui a todo
     * campo, e o espaço dele em `ui.Utils.Hint`.
     *
     * @example <RRating name="nota" hint="De 1 a 5" />
     */
    import { useUtil } from "#rform/composables";
    import type { DeepPartial } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    export const defaults = defineDefaults({
        hint: "",
        ui: {
            container: "hint"
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