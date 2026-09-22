<template>
    <div
        :class="[props.ui?.container, props.disabled && props.ui?.disabled]"
        data-allow-mismatch
    >
        <RUtilsLabel v-if="props.label" />

        <RUtilsDropdown v-model:open="open">
            <template #default="{ reference }">
                <div
                    :ref="reference"
                    :class="[
                        props.ui?.group?.wrapper?.container,
                        open ? props.ui?.group?.wrapper?.open : props.ui?.group?.wrapper?.closed
                    ]"
                    @click="open = !open"
                >
                    <div
                        v-if="$slots.leading"
                        :class="props.ui?.group?.wrapper?.leading"
                    >
                        <slot name="leading" />
                    </div>

                    <div :class="props.ui?.group?.field?.container">
                        <span
                            :class="props.ui?.group?.field?.swatch"
                            :style="`background-color: ${model || 'transparent'}`"
                        />
                        <div :class="props.ui?.group?.field?.content">
                            <RUtilsPlaceholder v-if="props.placeholder" />
                            <span
                                :class="props.ui?.group?.field?.text"
                                data-allow-mismatch
                            >
                                {{ model }}
                            </span>
                        </div>
                    </div>

                    <div
                        v-if="$slots.trailing"
                        :class="props.ui?.group?.wrapper?.trailing"
                    >
                        <slot name="trailing" />
                    </div>

                    <RUtilsLoading v-if="props.loading !== undefined" />
                </div>
            </template>

            <template #content>
                <div
                    ref="svArea"
                    :class="props.ui?.picker?.sv"
                    :style="svBackground"
                    @pointerdown="startSV"
                >
                    <div
                        :class="props.ui?.picker?.svMarker"
                        :style="svMarkerStyle"
                    />
                </div>

                <div
                    ref="hueArea"
                    :class="props.ui?.picker?.hue"
                    @pointerdown="startHue"
                >
                    <div
                        :class="props.ui?.picker?.hueMarker"
                        :style="hueMarkerStyle"
                    />
                </div>

                <div :class="props.ui?.picker?.footer">
                    <span
                        :class="props.ui?.picker?.preview"
                        :style="`background-color: ${model || 'transparent'}`"
                    />
                    <input
                        :value="hexInput"
                        :disabled="props.disabled"
                        :class="props.ui?.picker?.input"
                        maxlength="7"
                        spellcheck="false"
                        @input="hexInput = inputValue($event)"
                        @blur="commitHex"
                        @keydown.enter.prevent="commitHex"
                    />
                </div>
            </template>
        </RUtilsDropdown>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de cor com dropdown: matiz, saturação, alfa e entrada em hexadecimal.
     *
     * @example <RColor name="cor" />
     */
    import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";

    import { useField } from "#rform/composables";
    import type { Element } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults, inputValue } from "#rform/utils";

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                wrapper: {
                    container: `
                        relative z-0 flex w-full cursor-pointer flex-row items-center
                        rounded-(--rf-radius-xl) bg-(--rf-color-background-100) outline-2 transition-all duration-300
                    `,
                    open: "text-(--rf-color-primary) outline-(--rf-color-primary)",
                    closed: "outline-transparent",
                    leading: "p-3 pr-0 flex",
                    trailing: "p-3 pl-0 flex"
                },
                field: {
                    container: "flex grow flex-row gap-3 p-3",
                    swatch: "block size-6 rounded-(--rf-radius-md) border border-(--rf-color-border) shadow-inner",
                    content: "flex grow flex-col",
                    text: "my-auto leading-none font-medium uppercase tracking-wide"
                }
            },
            picker: {
                sv: "relative h-40 w-full cursor-crosshair overflow-hidden rounded-(--rf-radius-lg) touch-none",
                svMarker: `
                    pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2
                    border-white shadow
                `,
                hue: `
                    relative h-3 w-full cursor-pointer overflow-hidden rounded-full touch-none
                    bg-[linear-gradient(to_right,#f00_0%,#ff0_17%,#0f0_33%,#0ff_50%,#00f_67%,#f0f_83%,#f00_100%)]
                `,
                hueMarker: `
                    pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full
                    border-2 border-white shadow
                `,
                footer: "flex flex-row items-center gap-2",
                preview: "size-8 rounded-(--rf-radius-md) border border-(--rf-color-border)",
                input: `
                    grow rounded-(--rf-radius-md) bg-(--rf-color-background-300) px-2 py-1 font-mono text-sm
                    uppercase outline-none
                    focus:outline-2 focus:outline-(--rf-color-primary)
                `
            },
            Utils: {
                Placeholder: {
                    notFilled: "top-0 left-0"
                },
                Dropdown: {
                    popover: `
                        flex w-64 flex-col gap-3 rounded-(--rf-radius-xl) border border-(--rf-color-border)
                        bg-(--rf-color-background-100) p-3 shadow-lg
                    `
                }
            }
        },
        default: "#000000"
    });

    export type Props = Element<typeof defaults, "color"> &
        Utils["Description"] &
        Utils["Dropdown"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Placeholder"];
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined
    });

    const { model, props } = await useField(_props);

    const hexToRgb = (hex: string): [number, number, number] | null => {
        const match = /^#?([a-f\d]{6})$/i.exec(hex);
        if (!match) {
            return null;
        }
        const body = match[1] ?? "";
        return [
            Number.parseInt(body.slice(0, 2), 16),
            Number.parseInt(body.slice(2, 4), 16),
            Number.parseInt(body.slice(4, 6), 16)
        ];
    };

    const rgbToHex = (r: number, g: number, b: number) => {
        const channel = (n: number) => Math.round(n).toString(16).padStart(2, "0");
        return `#${channel(r)}${channel(g)}${channel(b)}`;
    };

    const rgbToHsv = (r: number, g: number, b: number) => {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        if (d !== 0) {
            switch (max) {
                case r:
                    h = ((g - b) / d) % 6;
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h *= 60;
            if (h < 0) {
                h += 360;
            }
        }
        const s = max === 0 ? 0 : d / max;
        return { h, s, v: max };
    };

    const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r = 0;
        let g = 0;
        let b = 0;
        if (h < 60) {
            [r, g, b] = [c, x, 0];
        } else if (h < 120) {
            [r, g, b] = [x, c, 0];
        } else if (h < 180) {
            [r, g, b] = [0, c, x];
        } else if (h < 240) {
            [r, g, b] = [0, x, c];
        } else if (h < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }
        return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    };

    const hsv = ref({ h: 0, s: 0, v: 0 });
    const hexInput = ref("");

    const syncFromHex = (hex: string) => {
        const rgb = hexToRgb(hex);

        if (!rgb) {
            return;
        }

        hsv.value = rgbToHsv(...rgb);
        hexInput.value = hex.toUpperCase();
    };

    watch(
        model,
        (val) => {
            if (typeof val === "string" && val.toUpperCase() !== hexInput.value) {
                syncFromHex(val);
            }
        },
        {
            immediate: true
        }
    );

    const writeModel = () => {
        const [r, g, b] = hsvToRgb(hsv.value.h, hsv.value.s, hsv.value.v);
        const hex = rgbToHex(r, g, b).toUpperCase();
        hexInput.value = hex;
        model.value = hex;
    };

    const commitHex = () => {
        let value = hexInput.value.trim();

        if (!value.startsWith("#")) {
            value = `#${value}`;
        }
        if (hexToRgb(value)) {
            syncFromHex(value);
            model.value = value.toUpperCase();
        } else if (typeof model.value === "string") {
            hexInput.value = model.value.toUpperCase();
        }
    };

    const svArea = useTemplateRef<HTMLElement>("svArea");
    const hueArea = useTemplateRef<HTMLElement>("hueArea");

    const svBackground = computed(
        () => `background:
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #FFF, transparent),
            hsl(${hsv.value.h}, 100%, 50%);`
    );

    const svMarkerStyle = computed(() => ({
        left: `${hsv.value.s * 100}%`,
        top: `${(1 - hsv.value.v) * 100}%`,
        backgroundColor: typeof model.value === "string" ? model.value : "transparent"
    }));

    const hueMarkerStyle = computed(() => ({
        left: `${(hsv.value.h / 360) * 100}%`,
        backgroundColor: `hsl(${hsv.value.h}, 100%, 50%)`
    }));

    let dragging: "sv" | "hue" | null = null;

    const updateSV = (event: PointerEvent) => {
        if (!svArea.value) {
            return;
        }
        const rect = svArea.value.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        hsv.value.s = x;
        hsv.value.v = 1 - y;
        writeModel();
    };

    const updateHue = (event: PointerEvent) => {
        if (!hueArea.value) {
            return;
        }
        const rect = hueArea.value.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        hsv.value.h = x * 360;
        writeModel();
    };

    const startSV = (event: PointerEvent) => {
        dragging = "sv";
        updateSV(event);
    };

    const startHue = (event: PointerEvent) => {
        dragging = "hue";
        updateHue(event);
    };

    const onPointerMove = (event: PointerEvent) => {
        if (dragging === "sv") {
            updateSV(event);
        } else if (dragging === "hue") {
            updateHue(event);
        }
    };

    const onPointerUp = () => {
        dragging = null;
    };

    const open = ref(false);

    onMounted(() => {
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    });

    onUnmounted(() => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
    });
</script>