<template>
    <div :class="props.ui?.container">
        <div :class="props.ui?.header?.container">
            <button
                type="button"
                :class="props.ui?.header?.nav"
                @click="shiftView(-1)"
            >
                <Icon :name="icon('chevron-left')" />
            </button>
            <div :class="props.ui?.header?.title?.container">
                <button
                    v-if="viewMode === 'days'"
                    type="button"
                    :class="props.ui?.header?.title?.button?.container"
                    @click="toggleViewMode('months')"
                >
                    {{ headerLabel.month }}
                </button>
                <button
                    type="button"
                    :class="[
                        props.ui?.header?.title?.button?.container,
                        viewMode === 'years' ? props.ui?.header?.title?.button?.active : ''
                    ]"
                    @click="toggleViewMode('years')"
                >
                    {{ headerLabel.year }}
                </button>
            </div>
            <button
                type="button"
                :class="props.ui?.header?.nav"
                @click="shiftView(1)"
            >
                <Icon :name="icon('chevron-right')" />
            </button>
        </div>

        <div :class="props.ui?.viewport">
            <Transition
                :enterActiveClass="props.ui?.transition?.enterActiveClass"
                :enterFromClass="props.ui?.transition?.enterFromClass"
                :leaveActiveClass="props.ui?.transition?.leaveActiveClass"
                :leaveToClass="props.ui?.transition?.leaveToClass"
            >
                <div :key="`${viewMode}-${view.year}-${view.month}`">
                    <template v-if="viewMode === 'days'">
                        <div :class="props.ui?.weekdays">
                            <span
                                v-for="d in weekdays"
                                :key="d"
                            >
                                {{ d }}
                            </span>
                        </div>

                        <div :class="props.ui?.grid">
                            <button
                                v-for="cell in cells"
                                :key="cell.key"
                                type="button"
                                :disabled="cell.disabled"
                                :class="[
                                    props.ui?.day?.container,
                                    cell.outside ? props.ui?.day?.outside : '',
                                    cell.isToday ? props.ui?.day?.today : '',
                                    cell.inRange ? props.ui?.day?.inRange : '',
                                    cell.isStart ? props.ui?.day?.start : '',
                                    cell.isEnd ? props.ui?.day?.end : '',
                                    cell.isSelected ? props.ui?.day?.selected : '',
                                    cell.disabled ? props.ui?.day?.disabled : ''
                                ]"
                                @click="selectDay(cell)"
                            >
                                {{ cell.day }}
                            </button>
                        </div>
                    </template>

                    <div
                        v-else-if="viewMode === 'months'"
                        :class="props.ui?.months?.grid"
                    >
                        <button
                            v-for="m in monthsView"
                            :key="m.month"
                            type="button"
                            :class="[
                                props.ui?.months?.cell,
                                m.isCurrent ? props.ui?.day?.today : '',
                                m.isSelected ? props.ui?.day?.selected : ''
                            ]"
                            @click="selectMonth(m.month)"
                        >
                            {{ m.label }}
                        </button>
                    </div>

                    <div
                        v-else
                        :class="props.ui?.years?.grid"
                    >
                        <button
                            v-for="y in yearsView"
                            :key="y.year"
                            type="button"
                            :class="[
                                props.ui?.years?.cell,
                                y.isCurrent ? props.ui?.day?.today : '',
                                y.isSelected ? props.ui?.day?.selected : ''
                            ]"
                            @click="selectYear(y.year)"
                        >
                            {{ y.year }}
                        </button>
                    </div>
                </div>
            </Transition>
        </div>

        <div
            v-if="props.time && timeSlots.length"
            :class="props.ui?.time?.container"
        >
            <label
                v-for="idx in timeSlots"
                :key="idx"
                :class="props.ui?.time?.block"
            >
                <span :class="props.ui?.time?.label">
                    {{
                        props.mode === "range"
                            ? idx === 0
                                ? tr(props.text?.start)
                                : tr(props.text?.end)
                            : tr(props.text?.time)
                    }}
                </span>
                <input
                    :value="timeInputs[idx]"
                    v-mask="timeMask"
                    type="text"
                    inputmode="numeric"
                    :placeholder="tr('rform.fields.hour.hint')"
                    :class="props.ui?.time?.input"
                    @input="onTimeInput(idx, $event)"
                    @blur="commitTime(idx)"
                    @keydown.enter.prevent="commitTime(idx)"
                />
            </label>
        </div>
    </div>
</template>

<script lang="ts">
    /**
     * Grade de calendário: navegação por mês e ano, seleção `single`, `multiple` ou
     * `range`, e o painel de hora opcional. Nomes de mês e de dia saem do `Intl` do
     * locale ativo.
     */
    import { computed, ref, watch } from "vue";

    import { useUtil } from "#rform/composables";
    import type { DeepPartial, TextProp } from "#rform/types";
    import { dateFormat, defineDefaults, inputValue, vMask, icon } from "#rform/utils";

    import { formatTime, pad, parseTime } from "../fields/Hour.vue";

    export type Mode = "single" | "range" | "multiple";

    export type DateValue = string | (string | undefined)[] | string[] | undefined;

    export type ModelType<M extends Mode> = M extends "single"
        ? string | undefined
        : M extends "range"
          ? [string | undefined, string | undefined] | undefined
          : M extends "multiple"
            ? string[] | undefined
            : DateValue;

    export type DisableSpec = {
        before?: string;
        after?: string;
        between?: [string, string];
        dates?: string[];
    };

    export const formatIsoDate = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    export const formatIsoDateTime = (d: Date) =>
        `${formatIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    export const formatIso = (d: Date | null | undefined, time: boolean): string | undefined => {
        if (!d) {
            return undefined;
        }
        return time ? formatIsoDateTime(d) : formatIsoDate(d);
    };

    /**
     * O ramo ISO fica primeiro e não se mexe: ISO é o formato do model, e é
     * locale-independente por definição. Só o segundo ramo — uma string
     * digitada pelo usuário — depende do pack, daí o `pattern`.
     *
     * Sem `pattern` cai no `DD/MM/YYYY` do `dateFormat`, o que mantém a função
     * chamável direto (é o que os testes fazem). Todo call site de verdade passa
     * o `formats.date` do locale ativo.
     */
    export const parseIncoming = (val: unknown, pattern?: string): Date | null => {
        if (val instanceof Date) {
            return val;
        }

        if (typeof val !== "string" || !val) {
            return null;
        }

        const trimmed = val.trim();

        const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
        if (iso) {
            const [, yy, mm, dd, hh, mi] = iso as unknown as [
                string,
                string,
                string,
                string,
                string?,
                string?
            ];
            const d = new Date(+yy, +mm - 1, +dd, hh ? +hh : 0, mi ? +mi : 0);
            if (!Number.isNaN(d.getTime())) {
                return d;
            }
        }

        // "optional": a mesma string pode ou não trazer hora.
        return dateFormat(pattern).parse(trimmed, "optional");
    };

    const ui = {
        container: `
            flex w-full flex-col gap-3 rounded-(--rf-radius-xl) border border-(--rf-color-border)
            bg-(--rf-color-background-100) p-3 shadow-lg
        `,
        header: {
            container: "flex flex-row items-center justify-between gap-1",
            nav: `
                flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-(--rf-radius-md)
                transition-colors
                hover:bg-(--rf-color-primary)/10 hover:text-(--rf-color-primary)
            `,
            title: {
                container: "flex flex-row items-center gap-1",
                button: {
                    container: `
                        cursor-pointer rounded-(--rf-radius-md) px-2 py-1 font-semibold capitalize transition-colors
                        hover:bg-(--rf-color-primary)/10 hover:text-(--rf-color-primary)
                    `,
                    active: "bg-(--rf-color-primary)/10 text-(--rf-color-primary)"
                }
            }
        },
        viewport: "relative",
        transition: {
            enterActiveClass: "transition duration-200 ease-out",
            enterFromClass: "opacity-0 scale-95",
            leaveActiveClass: "absolute inset-0 transition duration-150 ease-in",
            leaveToClass: "opacity-0 scale-95"
        },
        weekdays: "grid grid-cols-7 text-center text-xs opacity-60",
        grid: "grid grid-cols-7 justify-items-center gap-y-1",
        day: {
            container: `
                flex size-9 cursor-pointer items-center justify-center rounded-(--rf-radius-md) text-sm
                transition-colors
                hover:bg-(--rf-color-primary)/20
            `,
            outside: "opacity-30",
            today: "outline outline-1 outline-(--rf-color-primary)/50",
            inRange: "rounded-none bg-(--rf-color-primary)/15",
            start: "rounded-r-none bg-(--rf-color-primary)! text-(--rf-color-primary-fg)",
            end: "rounded-l-none bg-(--rf-color-primary)! text-(--rf-color-primary-fg)",
            selected: "bg-(--rf-color-primary)! text-(--rf-color-primary-fg)",
            disabled: `
                cursor-not-allowed opacity-30 line-through
                hover:bg-transparent!
            `
        },
        months: {
            grid: "grid grid-cols-3 gap-1",
            cell: `
                flex h-12 cursor-pointer items-center justify-center rounded-(--rf-radius-md) text-sm capitalize
                transition-colors
                hover:bg-(--rf-color-primary)/20
            `
        },
        years: {
            grid: "grid grid-cols-3 gap-1",
            cell: `
                flex h-12 cursor-pointer items-center justify-center rounded-(--rf-radius-md) text-sm
                transition-colors
                hover:bg-(--rf-color-primary)/20
            `
        },
        time: {
            container: "flex flex-row gap-3 border-t border-(--rf-color-border) pt-3",
            block: "flex grow flex-row items-center justify-between gap-2",
            label: "text-xs opacity-60",
            input: `
                w-20 rounded-(--rf-radius-md) bg-(--rf-color-background-300) p-2 text-center font-mono outline-none
                focus:outline-2 focus:outline-(--rf-color-primary)
            `
        }
    };

    export const defaults = defineDefaults({
        ui,
        // `time` também é o booleano que decide se o relógio aparece, e não colide:
        // `text` fica aninhado, então a mensagem mora em `props.text.time`.
        text: {
            start: "start",
            end: "end",
            time: "time"
        }
    });

    // Um util escreve `Props` à mão — não há `Element` aqui, então a árvore de
    // `text` entra pelo `TextProp`.
    export type Props = TextProp<typeof defaults.text> & {
        mode?: Mode;
        time?: boolean;
        disable?: DisableSpec;
        ui?: DeepPartial<typeof defaults.ui>;
    };

    const stripTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const sameDay = (a: Date | null, b: Date | null) =>
        !!a &&
        !!b &&
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const capitalize = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

    const timeFromDate = (d: Date | null | undefined) =>
        d ? formatTime(d.getHours(), d.getMinutes()) : "";
</script>

<script setup lang="ts">
    const { props, upper, tr, locale } = useUtil<Props>(defaults);

    const mode = computed<Mode>(() => props.value.mode ?? "single");

    /**
     * Nomes de mês e de dia da semana saem do `Intl` do locale ativo, não de um
     * array cravado — é por isso que estes três são `computed` e não constantes
     * de módulo. O locale é o mesmo que `t` lê, então trocar de idioma troca
     * "Maio" por "May" e "dom" por "Sun".
     */
    const monthLongNames = computed(() =>
        Array.from({ length: 12 }, (_, i) =>
            capitalize(new Date(2000, i, 1).toLocaleString(locale.value, { month: "long" }))
        )
    );

    const monthShortNames = computed(() =>
        Array.from({ length: 12 }, (_, i) =>
            capitalize(
                new Date(2000, i, 1)
                    .toLocaleString(locale.value, { month: "short" })
                    .replace(/\.$/, "")
            )
        )
    );

    // 2023-01-01 caiu num domingo, que é a coluna 0 da grade.
    const weekdays = computed(() =>
        Array.from({ length: 7 }, (_, i) =>
            new Date(2023, 0, 1 + i)
                .toLocaleString(locale.value, { weekday: "short" })
                .replace(/\.$/, "")
        )
    );

    /**
     * O que `parseIncoming` usa no ramo não-ISO. Envolvido porque o segundo
     * parâmetro é o pattern: `arr.map(parseIncoming)` passaria o índice ali.
     */
    const incoming = (value: unknown) => parseIncoming(value, tr("rform.formats.date"));

    const parsedAll = computed<Date[]>(() => {
        const m = mode.value;
        const val = upper.model.value;

        if (m === "single") {
            const d = incoming(val);
            return d ? [d] : [];
        }

        if (m === "range") {
            const arr = Array.isArray(val) ? val : [];
            return [incoming(arr[0]), incoming(arr[1])].filter((d): d is Date => !!d);
        }

        const arr: unknown[] = Array.isArray(val) ? val : [];
        return arr.map((value) => incoming(value)).filter((d): d is Date => !!d);
    });

    const rangeBounds = computed<[Date | null, Date | null]>(() => {
        if (mode.value !== "range") {
            return [null, null];
        }
        const arr = Array.isArray(upper.model.value) ? upper.model.value : [];
        return [incoming(arr[0]), incoming(arr[1])];
    });

    const writeSingle = (d: Date | null) => {
        upper.model.value = formatIso(d, !!props.value.time) ?? "";
    };

    const writeRange = (a: Date | null, b: Date | null) => {
        const time = !!props.value.time;
        upper.model.value = [formatIso(a, time), formatIso(b, time)];
    };

    const writeMultiple = (dates: Date[]) => {
        const time = !!props.value.time;
        const sorted = [...dates].sort((x, y) => x.getTime() - y.getTime());
        upper.model.value = sorted.map((d) => formatIso(d, time)).filter((s): s is string => !!s);
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const view = ref({
        year: (parsedAll.value[0] ?? today).getFullYear(),
        month: (parsedAll.value[0] ?? today).getMonth()
    });

    const viewMode = ref<"days" | "months" | "years">("days");

    watch(
        () => parsedAll.value[0],
        (d) => {
            if (d) {
                view.value = {
                    year: d.getFullYear(),
                    month: d.getMonth()
                };
            }
        }
    );

    const shiftView = (delta: number) => {
        if (viewMode.value === "days") {
            const d = new Date(view.value.year, view.value.month + delta, 1);
            view.value = {
                year: d.getFullYear(),
                month: d.getMonth()
            };
            return;
        }

        if (viewMode.value === "months") {
            view.value = {
                year: view.value.year + delta,
                month: view.value.month
            };
            return;
        }

        view.value = {
            year: view.value.year + delta * 12,
            month: view.value.month
        };
    };

    const toggleViewMode = (next: "months" | "years") => {
        viewMode.value = viewMode.value === next ? "days" : next;
    };

    const yearWindowBase = computed(() => Math.floor(view.value.year / 12) * 12);

    const headerLabel = computed(() => {
        if (viewMode.value === "days") {
            return {
                month: monthLongNames.value[view.value.month] ?? "",
                year: String(view.value.year)
            };
        }

        if (viewMode.value === "months") {
            return { month: "", year: String(view.value.year) };
        }

        const base = yearWindowBase.value;
        return { month: "", year: `${base} — ${base + 11}` };
    });

    const isDateDisabled = computed(() => {
        const spec = props.value.disable;

        if (!spec) {
            return (_: Date) => false;
        }

        const before = spec.before ? incoming(spec.before) : null;
        const after = spec.after ? incoming(spec.after) : null;
        const beforeTime = before ? stripTime(before).getTime() : null;
        const afterTime = after ? stripTime(after).getTime() : null;

        const bStart = spec.between?.[0] ? incoming(spec.between[0]) : null;
        const bEnd = spec.between?.[1] ? incoming(spec.between[1]) : null;
        const bStartTime = bStart ? stripTime(bStart).getTime() : null;
        const bEndTime = bEnd ? stripTime(bEnd).getTime() : null;

        const specific = (spec.dates ?? [])
            .map((value) => incoming(value))
            .filter((v): v is Date => !!v)
            .map((d) => stripTime(d).getTime());

        return (date: Date) => {
            const t = stripTime(date).getTime();
            if (beforeTime !== null && t < beforeTime) {
                return true;
            }
            if (afterTime !== null && t > afterTime) {
                return true;
            }
            if (bStartTime !== null && bEndTime !== null && t >= bStartTime && t <= bEndTime) {
                return true;
            }
            if (specific.includes(t)) {
                return true;
            }
            return false;
        };
    });

    type Cell = {
        key: string;
        year: number;
        month: number;
        day: number;
        outside: boolean;
        isToday: boolean;
        isStart: boolean;
        isEnd: boolean;
        inRange: boolean;
        isSelected: boolean;
        disabled: boolean;
    };

    const cells = computed<Cell[]>(() => {
        const firstOfMonth = new Date(view.value.year, view.value.month, 1);
        const startOffset = firstOfMonth.getDay();
        const start = new Date(view.value.year, view.value.month, 1 - startOffset);

        const m = mode.value;
        const disabledFn = isDateDisabled.value;
        const [rangeStart, rangeEnd] = rangeBounds.value;
        const startDay = rangeStart ? stripTime(rangeStart) : null;
        const endDay = rangeEnd ? stripTime(rangeEnd) : null;

        const selectedSet = new Set(parsedAll.value.map((d) => stripTime(d).getTime()));

        const list: Cell[] = [];

        for (let i = 0; i < 42; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);

            const day = d.getDate();
            const month = d.getMonth();
            const year = d.getFullYear();
            const outside = month !== view.value.month;
            const isToday = sameDay(d, today);
            const dayTime = stripTime(d).getTime();

            const isStart = m === "range" && sameDay(d, startDay);
            const isEnd = m === "range" && sameDay(d, endDay);
            const inRange =
                m === "range" &&
                !!startDay &&
                !!endDay &&
                dayTime > startDay.getTime() &&
                dayTime < endDay.getTime();
            const isSelected = m !== "range" && selectedSet.has(dayTime);
            const disabled = disabledFn(d);

            list.push({
                key: `${year}-${month}-${day}-${i}`,
                year,
                month,
                day,
                outside,
                isToday,
                isStart,
                isEnd,
                inRange,
                isSelected,
                disabled
            });
        }

        return list;
    });

    const monthsView = computed(() => {
        const selectedSlots = new Set(
            parsedAll.value.map((d) => `${d.getFullYear()}-${d.getMonth()}`)
        );

        return Array.from({ length: 12 }, (_, m) => ({
            month: m,
            label: monthShortNames.value[m] ?? "",
            isCurrent: m === today.getMonth() && view.value.year === today.getFullYear(),
            isSelected: selectedSlots.has(`${view.value.year}-${m}`)
        }));
    });

    const yearsView = computed(() => {
        const base = yearWindowBase.value;
        const selectedYears = new Set(parsedAll.value.map((d) => d.getFullYear()));

        return Array.from({ length: 12 }, (_, i) => {
            const year = base + i;
            return {
                year,
                isCurrent: year === today.getFullYear(),
                isSelected: selectedYears.has(year)
            };
        });
    });

    const selectMonth = (m: number) => {
        view.value = { year: view.value.year, month: m };
        viewMode.value = "days";
    };

    const selectYear = (y: number) => {
        view.value = { year: y, month: view.value.month };
        viewMode.value = "months";
    };

    const selectDay = (cell: Cell) => {
        if (cell.disabled) {
            return;
        }

        const m = mode.value;

        if (m === "single") {
            const existing = parsedAll.value[0];
            const d = new Date(
                cell.year,
                cell.month,
                cell.day,
                existing?.getHours() ?? 0,
                existing?.getMinutes() ?? 0
            );
            writeSingle(d);
            return;
        }

        if (m === "range") {
            const [start, end] = rangeBounds.value;
            const clicked = new Date(cell.year, cell.month, cell.day);

            if (!start || end) {
                const d = new Date(
                    cell.year,
                    cell.month,
                    cell.day,
                    start?.getHours() ?? 0,
                    start?.getMinutes() ?? 0
                );
                writeRange(d, null);
                return;
            }

            if (clicked.getTime() < stripTime(start).getTime()) {
                const d = new Date(
                    cell.year,
                    cell.month,
                    cell.day,
                    start.getHours(),
                    start.getMinutes()
                );
                writeRange(d, null);
                return;
            }

            const d = new Date(cell.year, cell.month, cell.day, 0, 0);
            writeRange(start, d);
            return;
        }

        const clicked = new Date(cell.year, cell.month, cell.day);
        const existing = parsedAll.value;
        const idx = existing.findIndex((d) => sameDay(d, clicked));

        if (idx >= 0) {
            const next = [...existing];
            next.splice(idx, 1);
            writeMultiple(next);
            return;
        }

        writeMultiple([...existing, clicked]);
    };

    const timeSlots = computed<number[]>(() => {
        if (mode.value === "range") {
            return [0, 1];
        }
        if (mode.value === "multiple") {
            return [];
        }
        return [0];
    });

    const timeMask = {
        mask: "##:##",
        eager: true
    };

    const timeInputs = ref<[string, string]>(["", ""]);

    watch(
        () => {
            if (mode.value === "range") {
                return rangeBounds.value;
            }
            return [parsedAll.value[0] ?? null, null] as [Date | null, Date | null];
        },
        ([a, b]) => {
            const next: [string, string] = [timeFromDate(a), timeFromDate(b)];
            if (next[0] !== timeInputs.value[0] || next[1] !== timeInputs.value[1]) {
                timeInputs.value = next;
            }
        },
        {
            immediate: true
        }
    );

    const commitTime = (idx: number) => {
        const parts = parseTime(timeInputs.value[idx]);

        if (!parts) {
            const fallbackDate =
                mode.value === "range"
                    ? rangeBounds.value[idx]
                    : idx === 0
                      ? (parsedAll.value[0] ?? null)
                      : null;
            const restored = timeFromDate(fallbackDate);
            if (restored !== timeInputs.value[idx]) {
                const next: [string, string] = [...timeInputs.value] as [string, string];
                next[idx] = restored;
                timeInputs.value = next;
            }
            return;
        }

        if (mode.value === "range") {
            const [start, end] = rangeBounds.value;
            const existing = idx === 0 ? start : end;
            const other = idx === 0 ? end : start;
            const baseDate =
                existing ??
                (other ? new Date(other.getFullYear(), other.getMonth(), other.getDate()) : null) ??
                new Date(view.value.year, view.value.month, today.getDate());

            const d = new Date(baseDate);
            d.setHours(parts.hours);
            d.setMinutes(parts.minutes);

            const a = idx === 0 ? d : start;
            const b = idx === 1 ? d : end;
            writeRange(a, b);
            return;
        }

        const existing = parsedAll.value[0];
        const baseDate = existing ?? new Date(view.value.year, view.value.month, today.getDate());

        const d = new Date(baseDate);
        d.setHours(parts.hours);
        d.setMinutes(parts.minutes);
        writeSingle(d);
    };

    const onTimeInput = (idx: number, event: Event) => {
        timeInputs.value[idx] = inputValue(event);

        if (parseTime(timeInputs.value[idx])) {
            commitTime(idx);
        }
    };
</script>