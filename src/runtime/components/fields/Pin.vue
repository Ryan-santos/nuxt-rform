<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <div :class="props.ui?.group?.container">
            <template
                v-for="(_, index) in count"
                :key="index"
            >
                <input
                    :autocomplete="index === 0 ? props.autocomplete : undefined"
                    :disabled="props.disabled"
                    :ref="(el) => setBox(index, el)"
                    :type="props.secret ? 'password' : 'text'"
                    :inputmode="charset.inputmode"
                    :value="chars[index] ?? ''"
                    :class="props.ui?.group?.input"
                    @input="onInput(index, $event)"
                    @keydown="onKeydown(index, $event)"
                    @focus="onFocus(index)"
                    @paste="onPaste(index, $event)"
                />

                <span
                    v-if="hasSeparator(index)"
                    aria-hidden="true"
                    :class="props.ui?.group?.separator"
                >
                    <slot name="separator">&ndash;</slot>
                </span>
            </template>
        </div>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de código em células separadas. `length` diz quantas, `type` restringe a
     * numérico ou alfanumérico, `secret` esconde o valor digitado.
     *
     * @example <RPin name="codigo" :length="4" @complete="confirmar" />
     */
    import { computed, onMounted, ref, watch } from "vue";

    import { useField } from "#rform/composables";
    import type { Autocomplete, Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                container: "flex flex-row items-center gap-2",
                input: "size-12 rounded-(--rf-radius-xl) bg-(--rf-color-background-100) text-center outline-none",
                separator: "px-1 text-current/40"
            }
        },
        default: "",
        length: 6,
        type: "numeric"
    });

    export type Props = Element<typeof defaults, "pin"> &
        Autocomplete &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Loading"] & {
            length?: number;
            type?: "numeric" | "alphanumeric";
            secret?: boolean;
            autofocus?: boolean;
            separator?: number;
            onComplete?: (value: string) => void;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined,
        secret: undefined,
        autofocus: undefined
    });

    const { model, props } = useField(_props);

    const count = computed(() => props.value.length ?? defaults.length);

    // Espelho síncrono do model: sob `v-model` controlado o `useModel` só emite, e
    // duas escritas no mesmo tick perderiam um caractere. O watcher devolve a
    // verdade ao model.
    const value = ref("");

    watch(model, (current) => (value.value = String(current ?? "")), { immediate: true });

    const chars = computed(() => value.value.split(""));

    const commit = (next: string) => {
        const capped = next.slice(0, count.value);
        value.value = capped;
        model.value = capped;
    };

    const charset = computed(() =>
        props.value.type === "alphanumeric"
            ? ({ inputmode: "text", strip: /[^a-zA-Z0-9]/g, upper: true } as const)
            : ({ inputmode: "numeric", strip: /[^0-9]/g, upper: false } as const)
    );

    const clean = (raw: string) => {
        const kept = raw.replace(charset.value.strip, "");
        return charset.value.upper ? kept.toUpperCase() : kept;
    };

    const boxes = ref<Array<HTMLInputElement | null>>([]);

    const setBox = (index: number, el: unknown) => {
        boxes.value[index] = (el as HTMLInputElement | null) ?? null;
    };

    const focus = (index: number) => {
        boxes.value[Math.min(Math.max(index, 0), count.value - 1)]?.focus();
    };

    const write = (index: number, char: string) => {
        const next = chars.value.slice();
        next[Math.min(index, next.length)] = char;
        commit(next.join(""));
    };

    const remove = (index: number) => {
        const next = chars.value.slice();
        next.splice(index, 1);
        commit(next.join(""));
    };

    // Escreve uma sequência a partir de `index`, empurrando o que vier depois.
    const fill = (index: number, value: string) => {
        const start = Math.min(index, chars.value.length);

        commit(chars.value.slice(0, start).join("") + value);
        focus(start + value.length);
    };

    const onInput = (index: number, event: Event) => {
        const el = event.target as HTMLInputElement;
        const raw = clean(el.value);
        const current = chars.value[index] ?? "";

        // O autofill de `one-time-code` entrega o código inteiro num `input`, nunca
        // num `paste`. Digitar numa célula dá exatamente um caractere a mais do que
        // ela já tem; qualquer coisa acima disso é preenchimento e se espalha.
        if (raw.length > 1 && raw.length !== current.length + 1) {
            el.value = current;
            fill(index, raw);
            return;
        }

        const char = raw.slice(-1);

        el.value = char || current;

        if (!char) {
            return;
        }

        write(index, char);
        focus(index + 1);
    };

    const onKeydown = (index: number, event: KeyboardEvent) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            focus(index - 1);
            return;
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            focus(index + 1);
            return;
        }

        if (event.key !== "Backspace") {
            return;
        }

        event.preventDefault();

        if (chars.value[index]) {
            remove(index);
            return;
        }

        if (index > 0) {
            remove(index - 1);
            focus(index - 1);
        }
    };

    const onPaste = (index: number, event: ClipboardEvent) => {
        event.preventDefault();

        const pasted = clean(event.clipboardData?.getData("text") ?? "");

        if (!pasted) {
            return;
        }

        fill(index, pasted);
    };

    // O valor é sempre denso: focar além do fim volta pra primeira célula vazia,
    // então nenhuma interação deixa buraco no meio.
    const onFocus = (index: number) => {
        if (index > chars.value.length) {
            focus(chars.value.length);
        }
    };

    const hasSeparator = (index: number) => {
        const every = props.value.separator;
        return !!every && (index + 1) % every === 0 && index < count.value - 1;
    };

    // Dispara na transição para valor completo, não a cada mudança enquanto ele
    // continua completo.
    watch(value, (current, previous) => {
        if (current.length < count.value || (previous?.length ?? 0) >= count.value) {
            return;
        }

        _props.onComplete?.(current);
    });

    onMounted(() => {
        if (props.value.autofocus) {
            focus(chars.value.length);
        }
    });
</script>