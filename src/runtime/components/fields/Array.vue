<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <TransitionGroup
            v-bind="props.ui?.list?.transitionGroup"
            appear
            tag="ul"
            :class="props.ui?.list?.container"
        >
            <li
                v-for="index in length"
                :key="index - 1"
                :class="props.ui?.list?.item?.container"
            >
                <Row :index="index - 1" />
                <Icon
                    v-if="canRemove"
                    :name="icon('remove')"
                    size="1.2rem"
                    :class="props.ui?.list?.item?.remove"
                    @click="model?.splice(index - 1, 1)"
                />
            </li>
            <li
                v-if="canAdd"
                key="remover"
            >
                <button
                    :disabled="props.disabled"
                    type="button"
                    :class="props.ui?.list?.add"
                    @click="model?.push(undefined)"
                >
                    <Icon :name="icon('plus')" />
                    {{ tr(props.text?.button) }}
                </button>
            </li>
        </TransitionGroup>

        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Container de lista: repete o próprio slot por item do model, e cuida de
     * adicionar e remover respeitando `min` e `max`.
     *
     * @example <RArray name="telefones"><RText mask="brTelefone" /></RArray>
     */
    import { computed, defineComponent, useSlots } from "vue";

    import { useField, useProvide } from "#rform/composables";
    import type { Element, TextProp } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults, icon } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "flex flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            list: {
                transitionGroup: {
                    name: "",
                    enterActiveClass: "transition-opacity duration-500",
                    moveClass: "transition-all duration-500",
                    enterFromClass: "opacity-0",
                    enterToClass: "opacity-100",
                    leaveActiveClass: "absolute transition-opacity duration-500",
                    leaveFromClass: "opacity-100",
                    leaveToClass: "opacity-0"
                },
                container: `
                    relative flex flex-col gap-6 rounded-(--rf-radius-xl) border border-(--rf-color-border)
                    p-4
                `,
                item: {
                    container: "flex flex-row items-center gap-2",
                    remove: `
                        shrink-0 cursor-pointer text-(--rf-color-contrast)/20 transition-all duration-300
                        hover:text-(--rf-color-danger)
                    `
                },
                add: `
                    w-full rounded-(--rf-radius-xl) border-2 border-dashed border-(--rf-color-border) px-2 py-1
                    text-(--rf-color-contrast)/20 transition-all duration-300
                    hover:border-(--rf-color-primary) hover:text-(--rf-color-primary)
                `
            }
        },
        default: [],
        text: {
            button: "add"
        }
    });

    export type Props = Element<typeof defaults, "array"> &
        Utils["Label"] &
        Utils["Error"] &
        TextProp<typeof defaults.text> & {
            min?: number;
            max?: number;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined
    });

    const { id, model, props, tr } = useField(_props);

    useProvide({ id, model });

    const length = computed(() => model.value?.length ?? 0);

    // Um render effect por linha, para `item` ser lido dentro da linha que o possui
    // — só a fronteira de componente escopa a dependência (ver "RArray" no
    // `.claude/CLAUDE.md`).
    const slots = useSlots();

    const Row = defineComponent({
        name: "RArrayRow",
        props: {
            index: {
                type: Number,
                required: true
            }
        },
        setup: (rowProps) => () =>
            slots.default?.({
                index: rowProps.index,
                item: (model.value as unknown[] | undefined)?.[rowProps.index]
            })
    });

    const canRemove = computed(() => {
        return props.value?.min ? length.value > props.value.min : true;
    });

    const canAdd = computed(() => {
        return props.value?.max ? length.value < props.value.max : true;
    });
</script>