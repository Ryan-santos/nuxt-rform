<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <div :class="props.ui?.group?.wrapper?.container">
            <div
                v-if="$slots.leading"
                :class="props.ui?.group?.wrapper?.leading"
            >
                <slot name="leading" />
            </div>

            <div :class="props.ui?.group?.field?.container">
                <RUtilsPlaceholder v-if="props.placeholder" />
                <input
                    :value="model"
                    v-mask="mask"
                    :autocomplete="props.autocomplete"
                    :disabled="props.disabled"
                    :name="String(props.name)"
                    type="text"
                    :class="props.ui?.group?.field?.input"
                    @input="model = inputValue($event)"
                />
            </div>

            <RUtilsLength v-if="props.length" />

            <div
                v-if="$slots.trailing"
                :class="props.ui?.group?.wrapper?.trailing"
            >
                <slot name="trailing" />
            </div>

            <RUtilsLoading v-if="props.loading !== undefined" />
        </div>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de texto de uma linha. Aceita `mask` e os utils de label, descrição, erro,
     * contador e placeholder.
     *
     * @example <RText name="cpf" label="CPF" mask="brCpf" />
     */
    import { useField } from "#rform/composables";
    import type { Autocomplete, Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import type { Mask } from "#rform/types/presets";
    import { defineDefaults, inputValue, vMask } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                wrapper: {
                    container: `
                        relative z-0 flex w-full flex-row items-center rounded-(--rf-radius-xl)
                        bg-(--rf-color-background-100) outline-2 outline-transparent transition-all duration-300
                        has-[:focus]:text-(--rf-color-primary) has-[:focus]:outline-(--rf-color-primary)
                    `,
                    leading: "p-3 pr-0 flex",
                    trailing: "p-3 pl-0 flex"
                },
                field: {
                    container: "grow",
                    input: "w-full rounded-(--rf-radius-lg) bg-transparent outline-none p-3"
                }
            }
        },
        default: ""
    });

    export type Props = Element<typeof defaults, "text"> &
        Autocomplete &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Length"] &
        Utils["Placeholder"] & {
            mask?: Mask;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined
    });

    const { mask, model, props } = await useField(_props);
</script>