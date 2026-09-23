<template>
    <slot :reference="setReference" />

    <Teleport to="#teleports">
        <Transition
            :name="props.ui?.transition?.name"
            :enterActiveClass="props.ui?.transition?.enterActiveClass"
            :enterFromClass="props.ui?.transition?.enterFromClass"
            :enterToClass="props.ui?.transition?.enterToClass"
            :leaveActiveClass="props.ui?.transition?.leaveActiveClass"
            :leaveFromClass="props.ui?.transition?.leaveFromClass"
            :leaveToClass="props.ui?.transition?.leaveToClass"
        >
            <div
                v-show="open"
                ref="floating"
                v-bind="$attrs"
                :style="floatingStyles"
                :class="props.ui?.popover"
                @click.stop
            >
                <slot
                    v-if="everOpened"
                    name="content"
                />
            </div>
        </Transition>
    </Teleport>
</template>

<script lang="ts">
    /**
     * Painel flutuante compartilhado por Select, Date e Color. Posiciona com o
     * floating-ui e só monta o conteúdo no primeiro `open`. O painel é teleportado
     * para `#teleports` — ver "O painel mora em `#teleports`" no `.claude/CLAUDE.md`.
     *
     * @example <RUtilsDropdown v-model:open="open"><template #default="{ reference }">…</template></RUtilsDropdown>
     */
    import {
        autoUpdate,
        useFloating,
        type Middleware,
        type Placement,
        type Strategy
    } from "@floating-ui/vue";
    import {
        computed,
        onMounted,
        onUnmounted,
        ref,
        useTemplateRef,
        watch,
        type ComponentPublicInstance
    } from "vue";

    import { useUtil } from "#rform/composables";
    import type { DeepPartial } from "#rform/types";
    import { defineDefaults, dropdownMiddleware } from "#rform/utils";

    let lockCount = 0;
    const savedBody: {
        overflow: string;
        paddingRight: string;
        paddingLeft: string;
        position: string;
        top: string;
        left: string;
        width: string;
        scrollX: number;
        scrollY: number;
        isIOS: boolean;
    } = {
        overflow: "",
        paddingRight: "",
        paddingLeft: "",
        position: "",
        top: "",
        left: "",
        width: "",
        scrollX: 0,
        scrollY: 0,
        isIOS: false
    };

    const detectIOS = () => {
        if (typeof navigator === "undefined") {
            return false;
        }
        return (
            /iP(hone|ad|od)/.test(navigator.platform) ||
            (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))
        );
    };

    const lockBodyScroll = () => {
        if (lockCount++ > 0) {
            return;
        }
        if (typeof document === "undefined") {
            return;
        }

        const body = document.body;
        const html = document.documentElement;

        savedBody.scrollX = window.scrollX;
        savedBody.scrollY = window.scrollY;
        savedBody.overflow = body.style.overflow;
        savedBody.paddingRight = body.style.paddingRight;
        savedBody.paddingLeft = body.style.paddingLeft;
        savedBody.isIOS = detectIOS();

        if (savedBody.isIOS) {
            savedBody.position = body.style.position;
            savedBody.top = body.style.top;
            savedBody.left = body.style.left;
            savedBody.width = body.style.width;
            body.style.position = "fixed";
            body.style.top = `-${savedBody.scrollY}px`;
            body.style.left = `-${savedBody.scrollX}px`;
            body.style.width = "100%";
            return;
        }

        const scrollbarWidth = window.innerWidth - html.clientWidth;
        const isRTL = getComputedStyle(html).direction === "rtl";

        body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
            if (isRTL) {
                body.style.paddingLeft = `${scrollbarWidth}px`;
            } else {
                body.style.paddingRight = `${scrollbarWidth}px`;
            }
        }
    };

    const unlockBodyScroll = () => {
        if (lockCount === 0 || --lockCount > 0) {
            return;
        }
        if (typeof document === "undefined") {
            return;
        }

        const body = document.body;
        body.style.overflow = savedBody.overflow;
        body.style.paddingRight = savedBody.paddingRight;
        body.style.paddingLeft = savedBody.paddingLeft;

        if (savedBody.isIOS) {
            body.style.position = savedBody.position;
            body.style.top = savedBody.top;
            body.style.left = savedBody.left;
            body.style.width = savedBody.width;
            window.scrollTo(savedBody.scrollX, savedBody.scrollY);
        }
    };

    const ui = {
        transition: {
            name: "",
            enterActiveClass: "transition-opacity duration-300",
            enterToClass: "",
            enterFromClass: "opacity-0",
            leaveActiveClass: "transition-opacity duration-300",
            leaveToClass: "opacity-0",
            leaveFromClass: ""
        },
        popover: "z-999 w-(--width) max-h-[min(var(--available-height),var(--max-height,100vh))]"
    };

    export const defaults = defineDefaults({ ui });

    export type Props = {
        ui?: DeepPartial<typeof defaults.ui>;
    };
</script>

<script setup lang="ts">
    defineOptions({ inheritAttrs: false });

    const {
        middleware,
        strategy = "fixed",
        placement = "bottom-start",
        offset: offsetProp = 5,
        lockScroll = true
    } = defineProps<{
        middleware?: Middleware[];
        strategy?: Strategy;
        placement?: Placement;
        offset?: number;
        lockScroll?: boolean;
    }>();

    const open = defineModel<boolean>("open", { default: false });

    const { props } = useUtil<Props>();

    // O popover fica na árvore (o `useFloating` precisa do ref), mas o conteúdo
    // espera o primeiro `open` — um `RDate` fechado renderizava um mês inteiro.
    // Travar em vez de rastrear `open` deixa reabrir de graça.
    const everOpened = ref(false);

    watch(
        open,
        (isOpen) => {
            if (isOpen) {
                everOpened.value = true;
            }
        },
        { immediate: true }
    );

    const referenceEl = ref<HTMLElement | null>(null);

    const setReference = (el: Element | ComponentPublicInstance | null) => {
        if (el && "$el" in el) {
            referenceEl.value = el.$el as HTMLElement;
            return;
        }
        referenceEl.value = el as HTMLElement | null;
    };

    const floating = useTemplateRef<HTMLElement>("floating");

    const { floatingStyles } = useFloating(referenceEl, floating, {
        strategy: computed(() => strategy),
        placement: computed(() => placement),
        whileElementsMounted: autoUpdate,
        middleware: computed(() => {
            return dropdownMiddleware({ offset: offsetProp, middleware });
        })
    });

    const handleClick = (event: MouseEvent) => {
        const target = event.target as Node;
        if (!referenceEl.value?.contains(target) && !floating.value?.contains(target)) {
            open.value = false;
        }
    };

    let locked = false;

    watch(
        () => open.value && lockScroll,
        (shouldLock) => {
            if (shouldLock && !locked) {
                lockBodyScroll();
                locked = true;
            } else if (!shouldLock && locked) {
                unlockBodyScroll();
                locked = false;
            }
        }
    );

    onMounted(() => {
        document.addEventListener("mousedown", handleClick);
    });

    onUnmounted(() => {
        document.removeEventListener("mousedown", handleClick);
        if (locked) {
            unlockBodyScroll();
            locked = false;
        }
    });
</script>