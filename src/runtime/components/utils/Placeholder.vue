<template>
    <span
        :data-floating="floating || undefined"
        :class="[
            props.ui?.default,
            floating ? props.ui?.filled : props.ui?.notFilled,
            floatingDisable ? props.ui?.disable : ''
        ]"
    >
        {{ tr(props.placeholder) }}
        <span
            v-if="props.required && !props.label"
            :class="props.ui?.required"
        >
            *
        </span>
    </span>
</template>

<script lang="ts">
    /**
     * Placeholder que vira label flutuante quando o campo tem valor. Emite
     * `data-floating` nesse estado — é por ele que o reset de autofill se ancora.
     */
    import { computed } from "vue";

    import { useUtil } from "#rform/composables";
    import type { DeepPartial, TrInput } from "#rform/types";
    import { defineDefaults } from "#rform/utils";

    const ui = {
        default: `
            text-(--rf-color-contrast)/30 bg-(--rf-color-background-100) pointer-events-none block w-fit rounded-(--rf-radius-sm)
            transition-[translate,top,left,font-size,padding] duration-300
        `,
        filled: "absolute inset-x-0 top-0 left-2 -translate-y-1/2 px-1 py-0.5 text-xs",
        notFilled: "relative top-3 left-3 -z-10 h-0",
        disable: "font-bold opacity-0",
        required: "text-(--rf-color-danger) font-bold"
    };

    export const defaults = defineDefaults({ ui });

    export type Props = {
        placeholder?: TrInput;
        label?: TrInput;
        ui?: DeepPartial<typeof defaults.ui>;
    };
</script>

<script setup lang="ts">
    const componentProps = defineProps<{
        focused?: boolean;
    }>();

    const { props, upper, tr } = useUtil<Props>();

    const modelFilled = computed(() => {
        const value = upper.model.value;

        // `String(["", ""])` é `","`: sem olhar item a item, um range vazio conta
        // como preenchido e o placeholder sobe num campo que não tem nada.
        if (Array.isArray(value)) {
            return value.some((item) => !!String(item ?? "").length);
        }

        return !!String(value ?? "").length;
    });

    const floating = computed(() => {
        if (props.value.label) {
            return false;
        }

        if (!props.value.placeholder) {
            return false;
        }

        return modelFilled.value || !!componentProps.focused;
    });

    // Quem não pode flutuar tem de sumir: com `label` o placeholder fica parado sobre
    // o input, e no foco disputaria o mesmo espaço com o hint nativo do Date/Hour.
    const floatingDisable = computed(() => {
        return !floating.value && (modelFilled.value || !!componentProps.focused);
    });
</script>