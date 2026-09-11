<template>
    <div
        :style="{ height: `${virtualizer.getTotalSize()}px` }"
        class="relative w-full"
    >
        <div
            v-for="row in windowed"
            :key="row.index"
            :ref="measure"
            :data-index="row.index"
            class="absolute top-0 left-0 w-full"
            :style="{ transform: `translateY(${row.start}px)` }"
        >
            <slot
                :item="row.item"
                :index="row.index"
            />
        </div>
    </div>
</template>

<script lang="ts">
    /**
     * A janela virtual de uma lista longa. Componente **interno**: não é campo nem
     * util, não passa por `useField`/`useUtil`, não tem `defaults` e não é
     * registrado pelo `addComponentsDir` — o `RSelect` o carrega por
     * `defineAsyncComponent`, que é a fronteira de *setup* que o `useVirtualizer`
     * exige e a fronteira de *chunk* que o bundle exige, de uma vez.
     *
     * O import do `@tanstack/vue-virtual` é **estático** de propósito: assim o
     * pacote viaja no chunk assíncrono, uma vez, e só quando a lista cruza o
     * limiar.
     *
     * @example <VirtualRows v-slot="{ item }" :items :scroller :estimate="48"> … </VirtualRows>
     */
    import { useVirtualizer } from "@tanstack/vue-virtual";
    import { computed, type ComponentPublicInstance } from "vue";

    export type Props<T> = {
        items: readonly T[];
        /** O elemento que rola. É o `[role=listbox]` do campo. */
        scroller: HTMLElement | null;
        /** Só governa a barra antes da primeira medição — `measureElement` remede. */
        estimate: number;
    };
</script>

<script setup lang="ts" generic="T">
    // Genérico sobre o item para o slot chegar tipado do outro lado: sem isso o
    // `RSelect` precisaria de um `as Item` no template, que é o que a convenção da
    // casa proíbe.
    const props = defineProps<Props<T>>();

    defineSlots<{
        default(slotProps: { item: T; index: number }): void;
    }>();

    const virtualizer = useVirtualizer(
        computed(() => ({
            count: props.items.length,
            getScrollElement: () => props.scroller,
            estimateSize: () => props.estimate,
            // ~380px de folga de cada lado: o suficiente para a rolagem rápida não
            // mostrar buraco, e pouco o bastante para o DOM ficar em O(20).
            overscan: 8
        }))
    );

    /**
     * A janela já casada com o item. Resolver o índice aqui, e não no template, é o
     * que tira o `item!` de lá: `items[i]` é `T | undefined` para o checker, e a
     * convenção da casa não deixa tipagem entrar no `<template>`.
     */
    const windowed = computed(() =>
        virtualizer.value
            .getVirtualItems()
            .map((row) => ({ index: row.index, start: row.start, item: props.items[row.index] }))
            .filter(
                (row): row is { index: number; start: number; item: T } => row.item !== undefined
            )
    );

    /**
     * As linhas têm slot livre, então altura fixa está errada por construção: o
     * `measureElement` é o que remede de verdade depois do primeiro render.
     */
    const measure = (el: Element | ComponentPublicInstance | null) => {
        if (el instanceof HTMLElement) {
            virtualizer.value.measureElement(el);
        }
    };
</script>