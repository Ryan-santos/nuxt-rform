<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <label
            :class="[
                props.ui?.group?.container,
                props.placeholder ? props.ui?.group?.ifPlaceholder : ''
            ]"
        >
            {{ tr(props.placeholder) }}

            <span :class="props.ui?.group?.button?.container">
                <input
                    :checked="model"
                    :disabled="props.disabled"
                    type="checkbox"
                    :class="props.ui?.group?.button?.input"
                    @change="model = inputChecked($event)"
                />
                <span :class="props.ui?.group?.button?.indicator">
                    <Transition
                        :enterActiveClass="props.ui?.transition?.enterActiveClass"
                        :enterToClass="props.ui?.transition?.enterToClass"
                        :enterFromClass="props.ui?.transition?.enterFromClass"
                        :leaveActiveClass="props.ui?.transition?.leaveActiveClass"
                        :leaveToClass="props.ui?.transition?.leaveToClass"
                        :leaveFromClass="props.ui?.transition?.leaveFromClass"
                        mode="out-in"
                    >
                        <Icon
                            v-if="_icon"
                            :key="_icon"
                            :name="_icon"
                        />
                    </Transition>
                </span>
            </span>
        </label>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo booleano em forma de switch. `icon` troca o indicador por ícone, e aceita
     * um por estado.
     *
     * @example <RSwitch name="ativo" label="Ativo" icon />
     */
    import { computed } from "vue";

    import { useField } from "#rform/composables";
    import type { Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults, icon, inputChecked } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                container: "relative z-0 flex cursor-pointer items-center justify-between gap-4",
                ifPlaceholder:
                    "rounded-(--rf-radius-xl) border border-(--rf-color-border) p-2 pl-4",
                button: {
                    container: `
                        relative flex w-11 flex-row rounded-full bg-(--rf-color-background-100) p-0.5
                        contain-content
                    `,
                    input: "peer pointer-events-none absolute -z-50 opacity-0",
                    indicator: `
                        flex size-5 flex-row items-center justify-center rounded-full bg-current/20
                        p-0.5 transition-all
                        peer-checked:translate-x-full peer-checked:bg-(--rf-color-success)
                    `
                }
            },
            transition: {
                enterActiveClass: "transition-all duration-500",
                enterToClass: "",
                enterFromClass: "opacity-0",
                leaveActiveClass: "transition-all duration-500",
                leaveToClass: "opacity-0",
                leaveFromClass: ""
            }
        },
        default: false
    });

    export type IconConfig = {
        loading?: string;
        true?: string;
        false?: string;
    };

    export type Props = Element<typeof defaults, "switch"> &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Placeholder"] & {
            icon?: boolean | IconConfig;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        disabled: undefined,
        icon: undefined,
        required: undefined,
        loading: undefined
    });

    const { model, props, tr } = await useField(_props);

    const iconDefaults: Required<IconConfig> = {
        loading: icon("loading"),
        true: icon("check"),
        false: ""
    };

    const _icon = computed(() => {
        const config = props.value.icon;

        if (config === false) {
            return undefined;
        }

        const names =
            config && typeof config === "object" ? { ...iconDefaults, ...config } : iconDefaults;

        if (props.value.loading) {
            return names.loading;
        }

        return model.value ? names.true : names.false;
    });
</script>