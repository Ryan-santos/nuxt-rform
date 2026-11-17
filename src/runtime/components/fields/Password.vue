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
                    :autocomplete="props.autocomplete"
                    :disabled="props.disabled"
                    :name="String(props.name)"
                    :type="visible ? 'text' : 'password'"
                    :class="props.ui?.group?.field?.input"
                    @input="model = inputValue($event)"
                />
            </div>

            <RUtilsLength v-if="props.length" />

            <button
                v-if="canGenerate"
                type="button"
                :disabled="props.disabled"
                :title="tr(props.text?.generate)"
                :aria-label="tr(props.text?.generate)"
                :class="props.ui?.group?.button"
                data-action="generate"
                @click="generate"
            >
                <Icon :name="icon('key')" />
            </button>

            <button
                type="button"
                :disabled="props.disabled"
                :title="toggleLabel"
                :aria-label="toggleLabel"
                :aria-pressed="visible"
                :class="props.ui?.group?.button"
                data-action="toggle"
                @click="visible = !visible"
            >
                <Icon :name="icon(visible ? 'eye-off' : 'eye')" />
            </button>

            <div
                v-if="$slots.trailing"
                :class="props.ui?.group?.wrapper?.trailing"
            >
                <slot name="trailing" />
            </div>

            <RUtilsLoading v-if="props.loading !== undefined" />
        </div>

        <div
            v-if="showStrength"
            :class="props.ui?.strength?.container"
            :data-level="level"
        >
            <div :class="props.ui?.strength?.bar">
                <span
                    v-for="index in items.length"
                    :key="index"
                    :class="[props.ui?.strength?.segment, segmentClass(index)]"
                />
            </div>
            <span
                v-if="level"
                :class="props.ui?.strength?.text"
            >
                {{ tr(props.text?.strength?.[level]) }}
            </span>
        </div>

        <ul
            v-if="items.length"
            aria-live="polite"
            :data-rform-error="hasFailed || undefined"
            :class="props.ui?.checklist?.container"
        >
            <li
                v-for="(item, index) in items"
                :key="index"
                :class="[props.ui?.checklist?.item, props.ui?.checklist?.[stateOf(index)]]"
                :data-state="stateOf(index)"
            >
                <Icon
                    :name="stateIcon(index)"
                    :class="props.ui?.checklist?.icon"
                />
                {{ tr(item.label) }}
            </li>
        </ul>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="showError" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de senha, com o botão de mostrar e, opcionalmente, a lista de requisitos
     * marcada enquanto se digita (`checklist`), a barra de força (`strength`) e o
     * gerador (`generate`, ou só escutar `@generate`). A lista também valida: um
     * requisito faltando reprova o form, e é ela que mostra o erro.
     *
     * @example <RPassword name="senha" autocomplete="new-password" strength :checklist="requisitos" />
     */
    import { computed, ref, shallowRef, watch } from "vue";

    import { useField } from "#rform/composables";
    import type { Autocomplete, Element, TextProp, TrInput } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import type { Rule } from "#rform/types/presets";
    import {
        defineDefaults,
        generatePassword,
        icon,
        inputValue,
        resolveRule,
        type GenerateOptions
    } from "#rform/utils";

    import { injectFormRoot } from "../../composables/formRoot";

    // Estável: um `[]` novo a cada leitura dispararia o watcher da lista à toa.
    const NO_ITEMS: ChecklistItem[] = [];

    export const defaults = defineDefaults({
        ui: {
            container: "flex w-full flex-col gap-1",
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
                    container: "relative grow",
                    input: "w-full rounded-(--rf-radius-lg) bg-transparent outline-none p-3"
                },
                button: `
                    flex shrink-0 cursor-pointer p-3 pl-0 opacity-60 transition-opacity
                    duration-300
                    hover:opacity-100
                `
            },
            strength: {
                container: "flex min-h-5 flex-row items-center gap-3 px-1 text-sm",
                bar: "flex grow flex-row gap-1",
                segment: "h-1 grow rounded-full transition-colors duration-300",
                empty: "bg-(--rf-color-background-200)",
                weak: "bg-(--rf-color-danger)",
                medium: "bg-(--rf-color-warn)",
                strong: "bg-(--rf-color-success)",
                text: "shrink-0 opacity-80"
            },
            checklist: {
                container: "flex flex-col gap-1 px-1 text-sm",
                item: "flex flex-row items-center gap-2 transition-colors duration-300",
                icon: "shrink-0",
                idle: "opacity-60",
                pending: "opacity-60",
                met: "text-(--rf-color-success)",
                failed: "text-(--rf-color-danger)"
            },
            Utils: {
                // O mesmo do `RText`: uma linha só, cortada na área de texto.
                Placeholder: {
                    notFilled: "absolute top-3 left-3 h-auto max-w-[calc(100%-1.5rem)] truncate"
                }
            }
        },
        default: "",
        text: {
            show: "show",
            hide: "hide",
            generate: "generate",
            checklist: "checklist",
            strength: {
                weak: "weak",
                medium: "medium",
                strong: "strong"
            }
        }
    });

    /** Um requisito da lista: o texto que se lê e a rule que o decide. */
    export type ChecklistItem = {
        label: TrInput;
        rule: Rule<"password">;
    };

    /** Como cada requisito aparece: neutro, faltando, atendido, ou faltando depois de um submit. */
    export type ChecklistState = "idle" | "pending" | "met" | "failed";

    export type Props = Element<typeof defaults, "password"> &
        Autocomplete &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Length"] &
        Utils["Placeholder"] &
        TextProp<typeof defaults.text> & {
            /** Os requisitos, marcados enquanto se digita e conferidos no submit. */
            checklist?: ChecklistItem[];
            /** A barra de força, pela fração de requisitos atendidos. Pede `checklist`. */
            strength?: boolean;
            /** O botão de gerar senha; um objeto ajusta o comprimento e os símbolos. */
            generate?: boolean | GenerateOptions;
            onGenerate?: (password: string) => void;
        };
</script>

<script setup lang="ts">
    const _props = withDefaults(defineProps<Props>(), {
        required: undefined,
        disabled: undefined,
        loading: undefined,
        strength: undefined,
        generate: undefined
    });

    // Fim de uma avaliação: um `true` por requisito que falhou.
    type Results = boolean[];

    const isBlank = (value: unknown) =>
        value === undefined || value === null || (typeof value === "string" && value === "");

    // A mensagem que a lista empurrou por último. O `RUtilsError` cala só para ela:
    // quem fala, nesse caso, é a lista.
    const checklistMessage = ref<string>();

    // Depois de um submit reprovado, o que falta passa a ser erro.
    const attempted = ref(false);

    const results = shallowRef<Results>();

    // Definida antes do `useField` porque o seam de `rule` a acrescenta na hora.
    const checklistRule = async ({ value, form }: { value: unknown; form: unknown }) => {
        if (!items.value.length || isBlank(value)) {
            return;
        }

        // O mesmo token da avaliação ao vivo: se uma tecla chegou durante o submit, a
        // lista é do valor novo, e esta só responde ao validate.
        const mine = ++token;
        const failed = await evaluate(value, form);

        attempted.value = true;

        if (mine === token) {
            results.value = failed;
        }

        if (failed.some(Boolean)) {
            checklistMessage.value = tr(props.value.text?.checklist);
            return checklistMessage.value;
        }
    };

    const { model, props, tr } = useField(_props, {
        // Em forma de método, sem parênteses aninhados além de um nível: o
        // `src/vite.plugin.ts` casa os argumentos por regex.
        rule(source) {
            return withChecklist(source);
        }
    });

    function withChecklist(source: Props["rule"]): Props["rule"] {
        const list = source === undefined || source === null ? [] : [source].flat();
        // A lista primeiro: uma rule do call site que reprovasse antes deixaria os
        // requisitos sem virar erro. O vazio continua do `required`.
        return [checklistRule, ...list] as Props["rule"];
    }

    const items = computed(() => props.value.checklist ?? NO_ITEMS);

    const formRoot = injectFormRoot();

    let rules: (typeof import("#rform/presets"))["rules"] | undefined;

    const loadRules = async () => {
        rules ??= (await import("#rform/presets")).rules;
        return rules;
    };

    async function evaluate(value: unknown, form: unknown): Promise<Results> {
        const table = await loadRules();

        return Promise.all(
            items.value.map(async (item) => {
                const validate = resolveRule(item.rule, table, "password");
                return Boolean(validate && (await validate(value, form)));
            })
        );
    }

    // A corrida de tecla rápida: cada avaliação leva um token, e só a última escreve.
    let token = 0;

    watch(
        [() => model.value, items],
        ([value]) => {
            const mine = ++token;

            if (isBlank(value) || !items.value.length) {
                results.value = undefined;
                return;
            }

            evaluate(value, formRoot?.value)
                .then((failed) => {
                    if (mine === token) {
                        results.value = failed;
                    }
                })
                .catch((cause: unknown) => console.error(cause));
        },
        { immediate: true }
    );

    const stateOf = (index: number): ChecklistState => {
        const failed = results.value?.[index];

        if (failed === undefined) {
            return "idle";
        }

        if (!failed) {
            return "met";
        }

        return attempted.value ? "failed" : "pending";
    };

    const STATE_ICONS: Record<ChecklistState, string> = {
        idle: icon("pending"),
        pending: icon("pending"),
        met: icon("check"),
        failed: icon("remove")
    };

    const stateIcon = (index: number) => STATE_ICONS[stateOf(index)];

    const metCount = computed(() => results.value?.filter((failed) => !failed).length ?? 0);

    const level = computed(() => {
        if (!results.value || !items.value.length) {
            return undefined;
        }

        const ratio = metCount.value / items.value.length;

        if (ratio >= 1) {
            return "strong";
        }

        return ratio < 0.5 ? "weak" : "medium";
    });

    const showStrength = computed(() => Boolean(props.value.strength) && items.value.length > 0);

    watch(
        () => Boolean(props.value.strength) && !items.value.length,
        (orphan) => {
            if (orphan) {
                console.warn("[rform] RPassword: `strength` needs a `checklist` to measure.");
            }
        },
        { immediate: true }
    );

    const segmentClass = (index: number) => {
        const ui = props.value.ui?.strength;

        return level.value && index <= metCount.value ? ui?.[level.value] : ui?.empty;
    };

    // A marca que o `focusFirstError` procura quando quem fala é a lista, e não o
    // `RUtilsError`.
    const hasFailed = computed(() => items.value.some((_, index) => stateOf(index) === "failed"));

    const showError = computed(
        () => Boolean(props.value.error) && props.value.error !== checklistMessage.value
    );

    const visible = ref(false);

    const toggleLabel = computed(() =>
        tr(visible.value ? props.value.text?.hide : props.value.text?.show)
    );

    const canGenerate = computed(() => {
        const generate = props.value.generate;
        return generate === undefined ? Boolean(_props.onGenerate) : generate !== false;
    });

    // Sorteia até a senha passar na própria lista: um `symbols` que a lista recusa
    // nunca passaria, e aí o campo avisa em vez de girar para sempre.
    const generate = async () => {
        const config = props.value.generate;
        const options = typeof config === "object" ? config : {};

        let password = generatePassword(options);

        for (let attempt = 1; items.value.length; attempt++) {
            const failed = await evaluate(password, formRoot?.value);

            if (!failed.some(Boolean)) {
                break;
            }

            if (attempt >= 20) {
                console.warn(
                    "[rform] RPassword: no generated password met the checklist — check that `generate.symbols` and `generate.length` fit it."
                );
                break;
            }

            password = generatePassword(options);
        }

        model.value = password;
        visible.value = true;
        _props.onGenerate?.(password);
    };
</script>