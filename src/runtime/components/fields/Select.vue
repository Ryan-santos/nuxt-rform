<template>
    <div :class="[props.ui?.container, props.disabled && props.ui?.disabled]">
        <RUtilsLabel v-if="props.label" />

        <RUtilsDropdown
            v-model:open="open"
            :middleware="dropdownMiddleware"
        >
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
                        <RUtilsPlaceholder v-if="props.placeholder" />
                        <div :class="props.ui?.group?.field?.selected">
                            <slot
                                v-if="hasSelection && selected"
                                :selected="fieldSlot()"
                                :list="false"
                            >
                                <p
                                    v-if="Array.isArray(selected)"
                                    :class="props.ui?.group?.field?.text"
                                >
                                    {{ selected.map((item) => item.label).join(", ") }}
                                </p>
                                <p
                                    v-else
                                    :class="props.ui?.group?.field?.text"
                                >
                                    {{ selected.label }}
                                </p>
                            </slot>
                        </div>
                    </div>

                    <div
                        v-if="$slots.trailing"
                        :class="props.ui?.group?.wrapper?.trailing"
                    >
                        <slot name="trailing" />
                    </div>

                    <Icon
                        :name="icon('select')"
                        :class="props.ui?.group?.icon"
                    />

                    <RUtilsLoading v-if="props.loading !== undefined" />
                </div>
            </template>

            <template #content>
                <div
                    v-if="searchable"
                    :class="props.ui?.list?.search?.container"
                >
                    <Icon
                        :name="icon('search')"
                        :class="props.ui?.list?.search?.icon"
                    />
                    <input
                        v-model="term"
                        :disabled="props.disabled"
                        type="search"
                        :placeholder="tr(props.text?.search)"
                        :class="props.ui?.list?.search?.input"
                    />
                </div>
                <ul :class="props.ui?.list?.container">
                    <li
                        v-for="(option, key) in filteredOptions"
                        :key
                        :class="[
                            props.ui?.list?.option?.container,
                            isOptionSelected(option) ? props.ui?.list?.option?.selected : undefined
                        ]"
                        @click="select(option)"
                    >
                        <slot
                            :selected="rowSlot(option)"
                            :list="true"
                        >
                            <p :class="props.ui?.list?.option?.text">
                                {{ option.label }}
                            </p>
                        </slot>
                    </li>
                </ul>
            </template>
        </RUtilsDropdown>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de seleção com dropdown e busca. As `options` podem ser array primitivo,
     * array de objetos (`pick: { value, label }`) ou objeto `{ chave: rótulo }`;
     * `multiple` e `modelFull` decidem o que chega ao model, e `search` liga o campo
     * de busca dentro do painel.
     *
     * `@search` reporta o termo digitado e transfere o filtro para quem escuta —
     * é o que permite buscar no servidor em vez de na lista já carregada. Ele
     * liga o campo de busca sozinho.
     *
     * @example <RSelect name="uf" :options="ufs" multiple search />
     * @example <RSelect name="form" :options :loading @search="buscar" />
     */
    import { computed, ref, watch } from "vue";

    import { useField } from "#rform/composables";
    import type { Element, TextProp } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import { defineDefaults, dropdownFit, icon } from "#rform/utils";

    export type Primitive = string | number | boolean;
    export type OptArray = Array<Primitive>;
    export type OptArrayObj = Record<string | number, unknown>[];
    export type OptObj<T = unknown> = Record<string | number, T>;
    export type Options = OptArray | OptArrayObj | OptObj;

    /** O item bruto de `options`: elemento do array, ou valor do objeto. */
    export type OptionOf<Opts> = Opts extends readonly (infer U)[]
        ? U
        : Opts extends Record<string | number, infer V>
          ? V
          : unknown;

    /** O que o `original` de uma opção guarda — e, com `modelFull`, o que vai ao model. */
    export type OriginalOf<Opts> = Opts extends readonly (infer U)[]
        ? U
        : Opts extends Record<string | number, infer V>
          ? Record<string | number, V>
          : unknown;

    /**
     * `item[K]`, e o próprio item quando ele é primitivo. Cai em `unknown` quando `K`
     * não é chave simples — um caminho pontilhado (`user.id`), que o `getProperty`
     * resolve mas o `keyof` não enxerga.
     */
    type PropOf<U, K extends string> = U extends Primitive ? U : K extends keyof U ? U[K] : unknown;

    /**
     * A chave de um `options` em forma de objeto. `Object.entries` devolve a chave já
     * convertida, então uma chave numérica sai `string` — estreitar seria mentira.
     */
    type KeyOf<Opts> = keyof Opts extends string ? keyof Opts : string;

    /** O `value` de uma opção: `item[pick.value]` no array, a chave no objeto. */
    export type ValueOf<Opts, KV extends string> = Opts extends readonly (infer U)[]
        ? PropOf<U, KV>
        : KeyOf<Opts>;

    /** O `label` de uma opção: `item[pick.label]`, ou o próprio item quando primitivo. */
    export type LabelOf<Opts, KL extends string> = Opts extends readonly (infer U)[]
        ? PropOf<U, KL>
        : Opts extends Record<string | number, infer V>
          ? PropOf<V, KL>
          : unknown;

    /**
     * As chaves que o `pick` sugere, sem fechar o campo: o `string & {}` é o que
     * mantém `pick: { value: "user.id" }` válido, e sem ele o `getProperty` perderia
     * o caminho pontilhado que ele sabe resolver.
     */
    export type OptionKey<Opts> =
        OptionOf<Opts> extends Primitive ? string : (keyof OptionOf<Opts> & string) | (string & {});

    export type OptionItem<O = unknown, V = unknown, L = unknown> = {
        value: V;
        label: L;
        original: O;
    };

    export const defaults = defineDefaults({
        ui: {
            container: "flex w-full flex-col gap-1",
            disabled: "pointer-events-none opacity-60",
            group: {
                wrapper: {
                    container: `
                        relative z-10 flex w-full cursor-pointer flex-row items-center
                        rounded-(--rf-radius-xl) bg-(--rf-color-background-100) outline-2 transition-all duration-300
                    `,
                    open: "text-(--rf-color-primary) outline-(--rf-color-primary)",
                    closed: "outline-transparent",
                    leading: "flex p-3 pr-0",
                    trailing: "flex p-3 pl-0"
                },
                field: {
                    container: "flex min-w-0 grow flex-col",
                    selected: `
                        flex min-h-12 w-full grow flex-row items-center gap-2
                        p-3
                    `,
                    text: "truncate"
                },
                icon: "m-3 ml-0"
            },
            list: {
                search: {
                    container: "sticky top-0 z-0 bg-(--rf-color-background-300)",
                    icon: "absolute top-1/2 left-3 -z-1 -translate-y-1/2 opacity-60",
                    input: `
                        w-full p-3 pl-10 outline-0
                        placeholder:text-current/30
                    `
                },
                container: "divide-y divide-(--rf-color-border)",
                option: {
                    container: `
                        flex w-full cursor-pointer flex-row items-center gap-1 p-3
                        transition-all duration-300
                        hover:bg-(--rf-color-primary)/20
                    `,
                    selected: "text-(--rf-color-primary-fg) bg-(--rf-color-primary)!",
                    text: "truncate"
                }
            },
            Utils: {
                Dropdown: {
                    popover: `[--max-height:25rem] overflow-auto rounded-(--rf-radius-lg) border border-(--rf-color-border) bg-(--rf-color-background-100)`
                }
            }
        },
        default: null,
        // Uma prop só para dizer uma coisa só. O `merger` recursiona em objeto que
        // não é array, então `:pick="{ value: 'codigo' }"` conserva o `label` daqui.
        pick: { value: "id", label: "name" },
        search: false,
        text: {
            search: "search"
        }
    });

    /** O que uma seleção guarda: o item inteiro com `modelFull`, senão só o `value`. */
    export type SelectedOf<
        Opts,
        KeyValue extends string,
        ModelFull extends boolean
    > = ModelFull extends true ? OriginalOf<Opts> : ValueOf<Opts, KeyValue>;

    /** O model do campo: a seleção, ou a lista delas com `multiple`. */
    export type ModelOf<
        Opts,
        KeyValue extends string,
        ModelFull extends boolean,
        Multiple extends boolean
    > = Multiple extends true
        ? SelectedOf<Opts, KeyValue, ModelFull>[]
        : SelectedOf<Opts, KeyValue, ModelFull>;

    export type Props<
        Opts extends Options = OptArrayObj,
        Multiple extends boolean = false,
        KeyValue extends string = "id",
        KeyLabel extends string = "name",
        ModelFull extends boolean = false
    > = Omit<Element<typeof defaults, "select">, "modelValue" | "onUpdate:modelValue" | "default"> &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Dropdown"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Placeholder"] &
        TextProp<typeof defaults.text> & {
            options: Opts;
            // Escrito por extenso, e não num alias de dois parâmetros: com a
            // interseção atrás de um alias, o `Element` de todo campo estoura o
            // "union type too complex".
            //
            // A inferência anda por propriedade, então `:pick="{ value: 'id' }"`
            // escrito inline preserva o literal. Um `const` de objeto alarga para
            // `string` e o valor volta a `unknown` — daí o `as const` na doc.
            pick?: {
                value?: KeyValue & OptionKey<Opts> & string;
                label?: KeyLabel & OptionKey<Opts> & string;
            };
            modelFull?: ModelFull & boolean;
            multiple?: Multiple & boolean;
            search?: boolean;
            onSearch?: (term: string) => void;
            default?: ModelOf<Opts, KeyValue, ModelFull, Multiple>;
            modelValue?: ModelOf<Opts, KeyValue, ModelFull, Multiple>;
            "onUpdate:modelValue"?: ($event: ModelOf<Opts, KeyValue, ModelFull, Multiple>) => void;
        };

    type InternalProps = Omit<
        Element<typeof defaults, "select">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        Utils["Loading"] &
        Utils["Placeholder"] &
        TextProp<typeof defaults.text> & {
            options: Options;
            pick?: { value?: string; label?: string };
            modelFull?: boolean;
            multiple?: boolean;
            search?: boolean;
            onSearch?: (term: string) => void;
            default?: unknown;
            modelValue?: unknown;
        };
</script>

<script
    setup
    lang="ts"
    generic="
        Opts extends Options,
        Multiple extends boolean = false,
        KeyValue extends string = 'id',
        KeyLabel extends string = 'name',
        ModelFull extends boolean = false
    "
>
    // `disabled: undefined` como nos outros campos: `disabled?: boolean` compila com
    // `type: Boolean`, e o boolean casting do Vue apagaria a diferença entre a prop
    // ausente e um `:disabled="false"`. Este era o único campo sem `withDefaults`
    // nenhum — o `required` e o `loading` daqui continuam sendo castados. O `search`
    // entra pelo mesmo motivo: sem isso a prop ausente chegaria como `false` e
    // apagaria um `defineFieldDefaults({ Select: { search: true } })`.
    const _props = withDefaults(
        defineProps<Props<Opts, Multiple, KeyValue, KeyLabel, ModelFull>>(),
        {
            disabled: undefined,
            search: undefined
        }
    );

    type Original = OriginalOf<Opts>;

    type Item = OptionItem<Original, ValueOf<Opts, KeyValue>, LabelOf<Opts, KeyLabel>>;
    type Selected = Multiple extends true ? Item[] : Item;

    defineSlots<{
        default(props: { selected: Selected; list: boolean }): void;
        leading(): void;
        trailing(): void;
    }>();

    const { model, props, tr } = await useField(_props as unknown as InternalProps);

    const isRecord = (value: unknown): value is Record<string, unknown> => {
        return typeof value === "object" && value !== null;
    };

    const getProperty = (obj: unknown, path: string | undefined): unknown => {
        if (!path || !isRecord(obj)) {
            return undefined;
        }

        return path.split(".").reduce<unknown>((acc, part) => {
            return isRecord(acc) ? acc[part] : undefined;
        }, obj);
    };

    /**
     * O único ponto onde o dinâmico vira o tipo declarado: `getProperty` devolve
     * `unknown`, e é o generic de `options` que diz o que ele de fato é.
     */
    const toItem = (value: unknown, label: unknown, original: unknown): Item => {
        return { value, label, original } as Item;
    };

    const _options = computed<Item[]>(() => {
        const { options, pick } = props.value;

        if (!options) {
            return [];
        }

        if (Array.isArray(options)) {
            if (options.length === 0) {
                return [];
            }

            if (options.every((entry) => typeof entry !== "object" || entry === null)) {
                return options.map((entry) => toItem(entry, entry, entry));
            }

            return options.map((entry) => {
                return toItem(
                    getProperty(entry, pick?.value),
                    getProperty(entry, pick?.label),
                    entry
                );
            });
        }

        if (typeof options === "object") {
            return Object.entries(options).map(([key, value]) => {
                const label = isRecord(value) ? getProperty(value, pick?.label) : value;

                return toItem(key, label, { [key]: value });
            });
        }

        return [];
    });

    // `term`, e não `search`: o vue-tsc intersecciona props e bindings do setup no
    // contexto do template, e um ref de string com o nome da prop booleana reduz o
    // componente inteiro a `never`.
    const term = ref("");

    // O termo sai por `_props`, e não por `props.value`: é um callback do call site,
    // como o `onComplete` do `RPin` — não há sentido em um `defineFieldDefaults`
    // decidir quem responde à busca de um campo.
    watch(term, (current) => _props.onSearch?.(current));

    // `@search` liga a busca sozinho: o termo só nasce no input, então um
    // `<RSelect @search>` sem `search` nunca dispararia nada — calado.
    const searchable = computed(() => props.value.search || Boolean(_props.onSearch));

    const filteredOptions = computed<Item[]>(() => {
        const query = term.value.trim().toLowerCase();

        // Quem escuta `@search` assume o filtro: a lista que voltou já é a resposta
        // ao termo, e filtrá-la de novo aqui esconderia item que o servidor casou
        // por um campo que não é a label — um contato achado pelo telefone sumiria
        // enquanto se digita o telefone.
        if (!query || !props.value.search || _props.onSearch) {
            return _options.value;
        }

        return _options.value.filter(({ label }) => {
            return String(label ?? "")
                .toLowerCase()
                .includes(query);
        });
    });

    const select = (option: Item) => {
        const stored = props.value.modelFull ? option.original : option.value;

        if (!props.value.multiple) {
            model.value = stored;
            return;
        }

        const current = model.value as unknown;
        const list: unknown[] = Array.isArray(current) ? [...current] : [];
        const key = props.value.pick?.value;

        const idx =
            props.value.modelFull && key
                ? list.findIndex((item) => isRecord(item) && item[key] === option.value)
                : list.indexOf(stored);

        if (idx >= 0) {
            list.splice(idx, 1);
        } else {
            list.push(stored);
        }

        model.value = list;
    };

    const matchesModel = (value: unknown): boolean => {
        const key = props.value.pick?.value;
        const current = model.value as unknown;

        if (props.value.multiple && Array.isArray(current)) {
            const arr = current as unknown[];

            if (props.value.modelFull && key) {
                return arr.some((item) => isRecord(item) && item[key] === value);
            }

            return arr.includes(value);
        }

        if (props.value.modelFull && key && isRecord(current)) {
            return value === current[key];
        }

        return value === current;
    };

    const selected = computed<Item | Item[] | undefined>(() => {
        const filtered = _options.value.filter(({ value }) => matchesModel(value));

        if (props.value.multiple) {
            return filtered;
        }

        return filtered.at(0);
    });

    const hasSelection = computed(() => {
        if (Array.isArray(selected.value)) {
            return selected.value.length > 0;
        }

        return selected.value !== undefined;
    });

    const isOptionSelected = (option: Item): boolean => {
        const current = selected.value;

        if (Array.isArray(current)) {
            return current.some((item) => item.value === option.value);
        }

        return current?.value === option.value;
    };

    const fieldSlot = (): Selected => selected.value as Selected;

    const rowSlot = (option: Item): Selected => {
        return (props.value.multiple ? [option] : option) as Selected;
    };

    const open = ref(false);

    const dropdownMiddleware = [dropdownFit()];
</script>