<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <ul
            ref="list"
            :class="props.ui?.list?.container"
            :style="named('list')"
        >
            <li
                v-for="index in length"
                :key="index - 1"
                :class="[
                    props.ui?.list?.item?.container,
                    drag.dragging.value === index - 1 && props.ui?.list?.item?.dragging,
                    drag.dropAt.value === index - 1 && props.ui?.list?.item?.dropBefore,
                    drag.dropAt.value === length &&
                        index === length &&
                        props.ui?.list?.item?.dropAfter
                ]"
                :style="named(keys[index - 1])"
            >
                <span
                    v-if="draggable"
                    data-action="drag"
                    aria-hidden="true"
                    :class="props.ui?.list?.item?.handle"
                    @pointerdown="drag.start($event, index - 1)"
                >
                    <Icon :name="props.icons.drag" />
                </span>
                <div :class="props.ui?.list?.item?.field">
                    <Row :index="index - 1" />
                </div>
                <div
                    v-if="canRemove || arrows"
                    :class="props.ui?.list?.item?.actions"
                >
                    <template v-if="arrows">
                        <button
                            type="button"
                            data-action="up"
                            :disabled="props.disabled || index === 1"
                            :aria-label="tr(props.text?.up)"
                            :class="props.ui?.list?.item?.move"
                            @click="move(index - 1, -1)"
                        >
                            <Icon :name="props.icons.up" />
                        </button>
                        <button
                            type="button"
                            data-action="down"
                            :disabled="props.disabled || index === length"
                            :aria-label="tr(props.text?.down)"
                            :class="props.ui?.list?.item?.move"
                            @click="move(index - 1, 1)"
                        >
                            <Icon :name="props.icons.down" />
                        </button>
                    </template>
                    <button
                        v-if="canRemove"
                        type="button"
                        data-action="remove"
                        :disabled="props.disabled"
                        :aria-label="tr(props.text?.remove)"
                        :class="props.ui?.list?.item?.remove"
                        @click="remove(index - 1)"
                    >
                        <Icon :name="props.icons.remove" />
                    </button>
                </div>
            </li>
            <li
                v-if="canAdd"
                key="add"
                :style="named('add')"
            >
                <button
                    :disabled="props.disabled"
                    type="button"
                    data-action="add"
                    :class="props.ui?.list?.add"
                    @click="add"
                >
                    <Icon :name="props.icons.add" />
                    {{ tr(props.text?.button) }}
                </button>
            </li>
        </ul>

        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Container de lista: repete o próprio slot por item do model, e cuida de
     * adicionar, remover e — com `sortable` — reordenar, respeitando `min` e `max`.
     * As mudanças animam pela View Transitions API onde o browser a tem.
     *
     * @example <RArray name="telefones" sortable><RText mask="brTelefone" /></RArray>
     * @example <RArray name="etapas" sortable="drag"><RText /></RArray>
     */
    import {
        computed,
        defineComponent,
        nextTick,
        ref,
        shallowRef,
        useId,
        useSlots,
        useTemplateRef,
        watch
    } from "vue";

    import { useField, useProvide } from "#rform/composables";
    import type { Element, IconsProp, TextProp } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults, remapIndexKeys, ruleLimits } from "#rform/utils";

    import { injectErrorsBag } from "../../composables/errorsBag";
    import useDragSort from "../../composables/useDragSort";

    export const defaults = defineDefaults({
        ui: {
            container: "flex flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            list: {
                container: `
                    relative flex flex-col gap-6 rounded-(--rf-radius-xl) border border-(--rf-color-border)
                    p-4
                `,
                item: {
                    container:
                        "relative flex w-full flex-row items-center gap-2 transition-opacity",
                    field: "w-full min-w-0",
                    dragging: "opacity-40",
                    dropBefore: `before:absolute before:inset-x-0 before:-top-3.25 before:h-0.5 before:rounded-full before:bg-(--rf-color-primary)`,
                    dropAfter: `after:absolute after:inset-x-0 after:-bottom-3.25 after:h-0.5 after:rounded-full after:bg-(--rf-color-primary)`,
                    handle: `
                        flex size-8 shrink-0 cursor-grab touch-none items-center justify-center text-sm
                        text-(--rf-color-contrast)/30 transition-colors duration-300 select-none
                        hover:text-(--rf-color-primary)
                        active:cursor-grabbing
                    `,
                    actions: "flex shrink-0 items-center gap-0.5",
                    move: `
                        flex size-8 cursor-pointer items-center justify-center rounded-(--rf-radius-md) text-sm
                        text-(--rf-color-contrast)/30 transition-colors duration-300
                        hover:text-(--rf-color-primary)
                        focus-visible:outline-2 focus-visible:outline-(--rf-color-primary)
                        disabled:pointer-events-none disabled:opacity-40
                    `,
                    remove: `
                        flex size-8 cursor-pointer items-center justify-center rounded-(--rf-radius-md) text-base
                        text-(--rf-color-contrast)/30 transition-colors duration-300
                        hover:bg-(--rf-color-danger)/10 hover:text-(--rf-color-danger)
                        focus-visible:outline-2 focus-visible:outline-(--rf-color-danger)
                    `
                },
                add: `
                    flex w-full cursor-pointer items-center justify-center gap-2 rounded-(--rf-radius-xl) border-2
                    border-dashed border-(--rf-color-border) px-2 py-1 text-(--rf-color-contrast)/30
                    transition-colors duration-300
                    hover:border-(--rf-color-primary) hover:text-(--rf-color-primary)
                    focus-visible:border-(--rf-color-primary) focus-visible:text-(--rf-color-primary)
                    focus-visible:outline-none
                `
            }
        },
        default: [],
        sortable: false as Sortable,
        text: {
            button: "add",
            remove: "remove",
            up: "up",
            down: "down"
        },
        icons: {
            add: "plus",
            remove: "trash",
            up: "chevron-up",
            down: "chevron-down",
            drag: "grip"
        }
    });

    /** `true` liga as setas e o arrastar; o nome de um liga só ele. */
    export type Sortable = boolean | "arrows" | "drag";

    export type Props = Element<typeof defaults, "array"> &
        Utils["Label"] &
        Utils["Error"] &
        TextProp<typeof defaults.text> &
        IconsProp<typeof defaults.icons> & {
            min?: number;
            max?: number;
            /** Mostra os botões de subir e descer em cada linha. */
            sortable?: Sortable;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined,
        sortable: undefined
    });

    const { id, model, props, tr } = useField(_props);

    useProvide({ id, model });

    const errorsBag = injectErrorsBag();
    const list = useTemplateRef<HTMLUListElement>("list");

    const length = computed(() => model.value?.length ?? 0);
    const arrows = computed(() => [true, "arrows"].includes(props.value.sortable ?? false));
    const draggable = computed(() => [true, "drag"].includes(props.value.sortable ?? false));

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

    // Sem a prop, o limite sai da `rule` (preset ou zod): o botão some no mesmo
    // ponto em que a validação passaria a reprovar. A prop escrita vence.
    const limits = computed(() => ruleLimits(props.value.rule));
    const min = computed(() => props.value.min ?? limits.value.min);
    const max = computed(() => props.value.max ?? limits.value.max);

    const canRemove = computed(() => (min.value ? length.value > min.value : true));
    const canAdd = computed(() => (max.value ? length.value < max.value : true));

    // A lista nunca fica abaixo do `min`: na montagem, num reset ou num model que
    // chega curto de fora, as linhas que faltam entram vazias, como o "Adicionar".
    watch(
        [length, min],
        ([size, floor]) => {
            const arr = model.value;
            if (!arr || !floor || size >= floor) {
                return;
            }
            for (let index = size; index < floor; index++) {
                arr.push(undefined);
            }
        },
        { immediate: true }
    );

    // Identidade de cada item, paralela ao model: as instâncias ficam presas ao
    // índice (o `id` dos filhos é montado uma vez), e só o nome da transição segue
    // o item. Mudança vinda de fora só acerta o tamanho.
    let seq = 0;
    const keys = shallowRef<number[]>([]);

    watch(
        length,
        (size) => {
            if (keys.value.length === size) {
                return;
            }
            const next = keys.value.slice(0, size);
            while (next.length < size) {
                next.push(seq++);
            }
            keys.value = next;
        },
        { immediate: true, flush: "sync" }
    );

    const base = `rform-array-${useId()}`.replace(/[^\w-]/g, "-");
    const naming = ref(false);
    let token = 0;

    // O nome só existe durante a própria transição: sempre ligado, ele entraria
    // também na transição de rota do app.
    const named = (suffix: string | number | undefined) =>
        naming.value && suffix !== undefined
            ? { viewTransitionName: `${base}-${suffix}`, viewTransitionClass: "rform-array" }
            : undefined;

    const animate = async (mutate: () => void) => {
        const start =
            typeof document === "undefined"
                ? undefined
                : document.startViewTransition?.bind(document);
        const reduced =
            typeof matchMedia === "function" &&
            matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!start || reduced) {
            mutate();
            await nextTick();
            return;
        }

        const mine = ++token;
        naming.value = true;
        // Os nomes precisam estar no DOM antes do snapshot do estado antigo.
        await nextTick();

        const transition = start(async () => {
            mutate();
            await nextTick();
        });

        // Pulada (outra transição começou) rejeita o `ready`; não é erro.
        transition.ready.catch(() => undefined);
        void transition.finished.finally(() => {
            if (mine === token) {
                naming.value = false;
            }
        });

        await transition.updateCallbackDone.catch(() => undefined);
    };

    // O erro de cada linha é chaveado pelo índice: sem renumerar, ele ficaria
    // na posição e passaria a apontar para outro item.
    const remap = (map: (index: number) => number | null) => {
        if (id && errorsBag) {
            errorsBag.value = remapIndexKeys(errorsBag.value, id, map);
        }
    };

    const add = () =>
        animate(() => {
            keys.value = [...keys.value, seq++];
            model.value?.push(undefined);
        });

    const remove = (at: number) =>
        animate(() => {
            keys.value = keys.value.filter((_, index) => index !== at);
            remap((index) => (index === at ? null : index > at ? index - 1 : index));
            model.value?.splice(at, 1);
        });

    // Leva o item de `from` para `to`; quem estava no meio anda uma casa.
    const reorder = (from: number, to: number) => {
        if (props.value.disabled || from === to || to < 0 || to >= length.value) {
            return Promise.resolve();
        }

        return animate(() => {
            const arr = model.value;
            if (!arr) {
                return;
            }

            const next = [...keys.value];
            next.splice(to, 0, ...next.splice(from, 1));
            keys.value = next;

            const [low, high] = from < to ? [from, to] : [to, from];
            const shift = from < to ? -1 : 1;
            remap((index) =>
                index === from ? to : index >= low && index <= high ? index + shift : index
            );
            arr.splice(to, 0, ...arr.splice(from, 1));
        });
    };

    const move = async (from: number, step: -1 | 1) => {
        const to = from + step;
        await reorder(from, to);

        // O foco segue o item: o botão clicado continua no índice antigo.
        const row = list.value?.children[to];
        const target =
            row?.querySelector<HTMLButtonElement>(
                `button[data-action="${step < 0 ? "up" : "down"}"]:not(:disabled)`
            ) ?? row?.querySelector<HTMLButtonElement>("button[data-action]:not(:disabled)");
        target?.focus({ preventScroll: true });
    };

    const drag = useDragSort({
        rows: () => [...(list.value?.children ?? [])].slice(0, length.value) as HTMLElement[],
        onMove: (from, to) => void reorder(from, to),
        disabled: () => Boolean(props.value.disabled)
    });
</script>