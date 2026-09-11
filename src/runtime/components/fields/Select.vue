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
                    role="combobox"
                    aria-haspopup="listbox"
                    :aria-expanded="open"
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
                <div :class="props.ui?.list?.container">
                    <div
                        v-if="pinnedRows.length > 0"
                        role="group"
                        :class="props.ui?.list?.pinned"
                    >
                        <div
                            v-for="(option, key) in pinnedRows"
                            :key
                            role="option"
                            aria-selected="true"
                            :class="[
                                props.ui?.list?.option?.container,
                                key === 0 ? props.ui?.list?.option?.first : undefined,
                                props.ui?.list?.option?.selected
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
                        </div>
                    </div>

                    <div
                        v-if="status === 'loading'"
                        :class="props.ui?.list?.state"
                    >
                        <Icon :name="icon('loading')" />
                        {{ tr(props.text?.loading) }}
                    </div>

                    <div
                        v-else-if="status === 'error' && rows.length === 0"
                        :class="props.ui?.list?.state"
                    >
                        <Icon :name="icon('alert')" />
                        {{ errorText }}
                        <button
                            type="button"
                            :class="props.ui?.list?.retry"
                            @click.stop="retry"
                        >
                            {{ tr(props.text?.retry) }}
                        </button>
                    </div>

                    <slot
                        v-else-if="isEmpty"
                        name="empty"
                    >
                        <div :class="props.ui?.list?.state">
                            {{ tr(props.text?.empty) }}
                        </div>
                    </slot>

                    <div
                        v-else
                        ref="scroller"
                        role="listbox"
                        :class="props.ui?.list?.scroller"
                    >
                        <VirtualRows
                            v-if="virtualized"
                            v-slot="{ item, index }"
                            :items="rows"
                            :scroller="scroller"
                            :estimate="rowHeight"
                        >
                            <div
                                role="option"
                                :aria-selected="isOptionSelected(item)"
                                :class="[
                                    props.ui?.list?.option?.container,
                                    index === 0 ? props.ui?.list?.option?.first : undefined,
                                    isOptionSelected(item)
                                        ? props.ui?.list?.option?.selected
                                        : undefined
                                ]"
                                @click="select(item)"
                            >
                                <slot
                                    :selected="rowSlot(item)"
                                    :list="true"
                                >
                                    <p :class="props.ui?.list?.option?.text">
                                        {{ item.label }}
                                    </p>
                                </slot>
                            </div>
                        </VirtualRows>

                        <template v-else>
                            <div
                                v-for="(option, key) in rows"
                                :key
                                role="option"
                                :aria-selected="isOptionSelected(option)"
                                :class="[
                                    props.ui?.list?.option?.container,
                                    key === 0 ? props.ui?.list?.option?.first : undefined,
                                    isOptionSelected(option)
                                        ? props.ui?.list?.option?.selected
                                        : undefined
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
                            </div>
                        </template>

                        <div
                            ref="sentinel"
                            aria-hidden="true"
                            :class="props.ui?.list?.sentinel"
                        />
                    </div>

                    <slot
                        v-if="footerStatus"
                        name="footer"
                        :status="footerStatus"
                        :retry="retry"
                    >
                        <div :class="props.ui?.list?.footer">
                            <template v-if="footerStatus === 'loadingMore'">
                                <Icon :name="icon('loading')" />
                                {{ tr(props.text?.loadingMore) }}
                            </template>
                            <template v-else>
                                <Icon :name="icon('alert')" />
                                {{ errorText }}
                                <button
                                    type="button"
                                    :class="props.ui?.list?.retry"
                                    @click.stop="retry"
                                >
                                    {{ tr(props.text?.retry) }}
                                </button>
                            </template>
                        </div>
                    </slot>
                </div>
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
    import {
        computed,
        defineAsyncComponent,
        onMounted,
        onUnmounted,
        ref,
        useTemplateRef,
        watch
    } from "vue";

    import { useField } from "#rform/composables";
    import type {
        Element,
        OptArrayObj,
        OptionItem,
        Options,
        OptionsFn,
        Primitive,
        ResolveFn,
        TextProp
    } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import {
        defineDefaults,
        dropdownFit,
        fnProp,
        getProperty,
        icon,
        keyOf,
        normalizeOptions
    } from "#rform/utils";

    import { injectFormRoot } from "../../composables/formRoot";
    import useRemoteOptions, { type ListStatus } from "../../composables/useRemoteOptions";

    // Os formatos de `options` moram em `#rform/types`, ao lado do `UploadFn`: são
    // contrato de função de app, e o `#rform/builtin/fields/Select.vue` continua
    // alcançando os nomes daqui.
    export type {
        OptArray,
        OptArrayObj,
        OptionItem,
        OptionsContext,
        OptionsFn,
        OptObj,
        Options,
        Primitive,
        ResolveContext,
        ResolveFn
    } from "#rform/types";

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

    /**
     * Acima disto a lista vira janela virtual. Constante, e não prop: quantas linhas
     * o DOM aguenta não é conhecimento do app.
     */
    const VIRTUAL_THRESHOLD = 100;

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
                    container: "relative shrink-0 bg-(--rf-color-background-300)",
                    icon: "absolute top-1/2 left-3 -z-1 -translate-y-1/2 opacity-60",
                    input: `
                        w-full p-3 pl-10 outline-0
                        placeholder:text-current/30
                    `
                },
                container: "flex min-h-0 flex-1 flex-col",
                // A segunda caixa rolável: com `multiple` e dez seleções ela para de
                // crescer e rola por dentro, em vez de espremer a lista de baixo.
                pinned: "max-h-40 shrink-0 overflow-auto overscroll-contain",
                scroller: "min-h-0 flex-1 overflow-auto overscroll-contain",
                sentinel: "h-px w-full",
                option: {
                    container: `
                        flex w-full cursor-pointer flex-row items-center gap-1 border-t
                        border-(--rf-color-border) p-3 transition-all duration-300
                        hover:bg-(--rf-color-primary)/20
                    `,
                    first: "border-t-0",
                    selected: "text-(--rf-color-primary-fg) bg-(--rf-color-primary)!",
                    text: "truncate"
                },
                state: `
                    flex flex-row items-center justify-center gap-2 p-3 text-sm
                    opacity-60
                `,
                footer: `
                    flex shrink-0 flex-row items-center justify-center gap-2 border-t
                    border-(--rf-color-border) p-3 text-sm
                `,
                retry: "cursor-pointer underline underline-offset-2"
            },
            Utils: {
                Dropdown: {
                    popover: `
                        [--max-height:25rem] flex flex-col overflow-hidden rounded-(--rf-radius-lg) border border-(--rf-color-border)
                        bg-(--rf-color-background-100)
                    `
                }
            }
        },
        default: null,
        // Derivado do `ui.list.option.container`, e mora ao lado dele por isso. Só
        // governa a barra antes da primeira medição — o virtualizer remede de
        // verdade com `measureElement`.
        rowHeight: 48,
        // Uma prop só para dizer uma coisa só. O `merger` recursiona em objeto que
        // não é array, então `:pick="{ value: 'codigo' }"` conserva o `label` daqui.
        pick: { value: "id", label: "name" },
        search: false,
        text: {
            search: "search",
            loading: "loading",
            loadingMore: "loadingMore",
            empty: "empty",
            failed: "failed",
            retry: "retry"
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
            // `Opts` continua sendo o tipo dos **dados**, nunca o da função: o TS o
            // infere de uma posição de retorno tão bem quanto de um valor, então
            // `OriginalOf`/`ValueOf` não mudam uma linha.
            options: Opts | OptionsFn<Opts>;
            /** Traduz o valor do model no item, para a tela de edição mostrar o rótulo. */
            resolve?: ResolveFn<Opts> | false;
            /** Espera antes de levar o termo à fn de `options`. `0` desliga. */
            debounce?: number;
            /** Altura estimada de uma linha, para a barra antes da primeira medição. */
            rowHeight?: number;
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
            options: Options | OptionsFn;
            resolve?: ResolveFn | false;
            debounce?: number;
            rowHeight?: number;
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
            search: undefined,
            resolve: undefined
        }
    );

    type Original = OriginalOf<Opts>;

    type Item = OptionItem<Original, ValueOf<Opts, KeyValue>, LabelOf<Opts, KeyLabel>>;
    type Selected = Multiple extends true ? Item[] : Item;

    defineSlots<{
        default(props: { selected: Selected; list: boolean }): void;
        leading(): void;
        trailing(): void;
        /** No lugar da lista, quando não há nada a mostrar. */
        empty(): void;
        /** A faixa abaixo da lista: a próxima página em voo, ou o erro com retry. */
        footer(props: { status: ListStatus; retry: () => void }): void;
    }>();

    const { model, props, tr } = await useField(_props as unknown as InternalProps);

    // Por caminho relativo, como o `Form.vue` faz: o barrel `#rform/composables` só
    // reexporta o default de cada arquivo.
    const formRoot = injectFormRoot();

    const isRecord = (value: unknown): value is Record<string, unknown> => {
        return typeof value === "object" && value !== null;
    };

    // `keys`, e não `pick`: o vue-tsc intersecciona props e bindings do setup no
    // contexto do template, e um binding com o nome de uma prop reduz o componente
    // inteiro a `never` — é a mesma parede que fez o `search` virar `term`.
    const keys = computed(() => props.value.pick ?? {});

    // O único ponto onde o dinâmico vira o tipo declarado: o `normalizeOptions` é
    // puro e devolve `unknown`, e é o generic de `options` que diz o que ele é.
    const asItems = (items: OptionItem[]): Item[] => items as Item[];

    // `term`, e não `search`: o vue-tsc intersecciona props e bindings do setup no
    // contexto do template, e um ref de string com o nome da prop booleana reduz o
    // componente inteiro a `never`.
    const term = ref("");

    // O termo sai por `_props`, e não por `props.value`: é um callback do call site,
    // como o `onComplete` do `RPin` — não há sentido em um `defineFieldDefaults`
    // decidir quem responde à busca de um campo.
    watch(term, (current) => _props.onSearch?.(current));

    // `@search` liga a busca sozinho: o termo só nasce no input, então um
    // `<RSelect @search>` sem `search` nunca dispararia nada — calado. `options`
    // função **não** liga: ela pagina sem termo nenhum, e lista infinita sem busca
    // é uso legítimo.
    const searchable = computed(() => props.value.search || Boolean(_props.onSearch));

    /** A fn de `options`, quando há uma. É ela que decide "remoto". */
    const remoteFn = computed(() => {
        const { options } = props.value;

        return typeof options === "function" ? (options as OptionsFn) : undefined;
    });

    const remoteMode = computed(() => Boolean(remoteFn.value));

    // Opt-out por `false` na prop crua, como o `upload`/`remove` do `RFile`: com o
    // app padronizando `resolve` pelo `defineFieldDefaults`, um campo precisa de
    // como recusar, e `:resolve="undefined"` não serve — o `merger` não apaga.
    const resolveFn = computed(() => fnProp<ResolveFn>(_props.resolve, props.value.resolve));

    // Fora do `defaults`, como o `focusError` do `RForm`: um `300` ali seria um
    // resultado truthy, e a regra "não apaga" do `merger` engoliria todo
    // `:debounce="0"` — desligar o debounce ficaria impossível, calado. O `merger`
    // copia a chave do `defineFieldDefaults` de qualquer jeito, então padronizar
    // pelo app continua valendo; e aí é a leitura crua que devolve o `0` à tag.
    const debounce = computed(() => _props.debounce ?? props.value.debounce ?? 300);

    const remote = useRemoteOptions({
        fn: () => remoteFn.value,
        resolve: () => resolveFn.value,
        pick: () => keys.value,
        search: () => term.value.trim(),
        value: () => model.value,
        form: () => formRoot?.value,
        fallback: () => tr(props.value.text?.failed)
    });

    /** A lista estática, ou a página corrente da remota. */
    const _options = computed<Item[]>(() => {
        if (remoteMode.value) {
            return asItems(remote.items.value);
        }

        return asItems(normalizeOptions(props.value.options as Options, keys.value));
    });

    const filteredOptions = computed<Item[]>(() => {
        const query = term.value.trim().toLowerCase();

        // Quem escuta `@search` assume o filtro, e `options` função idem: a lista
        // que voltou já é a resposta ao termo, e filtrá-la de novo aqui esconderia
        // item que o servidor casou por um campo que não é a label — um contato
        // achado pelo telefone sumiria enquanto se digita o telefone.
        if (!query || !props.value.search || _props.onSearch || remoteMode.value) {
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

        // Semeia **antes** de escrever no model: é o que faz o rótulo sobreviver a
        // digitar na busca, paginar e reabrir o painel.
        //
        // Só em modo remoto, e a guarda não é higiene: em estático o cache
        // responderia por um valor que saiu do `options`, onde hoje o campo cai no
        // placeholder. Seria mudança semântica calada no caminho que todo mundo usa.
        if (remoteMode.value) {
            remote.remember(option);
        }

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

    /** Os valores que estão no model, sempre como lista. */
    const modelValues = computed<unknown[]>(() => {
        const current = model.value as unknown;

        if (props.value.multiple) {
            return Array.isArray(current) ? current : [];
        }

        return current === undefined || current === null || current === "" ? [] : [current];
    });

    /** O valor de uma entrada do model — o objeto inteiro em `modelFull`, senão ele mesmo. */
    const valueOfEntry = (entry: unknown): unknown => {
        const key = props.value.pick?.value;

        return props.value.modelFull && key && isRecord(entry) ? entry[key] : entry;
    };

    /**
     * A leitura tem duas etapas: a página corrente responde primeiro, e só o que ela
     * não responde cai no cache. Se o cache absorvesse a lista, cinquenta buscas
     * seguidas acumulariam cinquenta páginas que ninguém mais lê.
     *
     * Com `modelFull` não há cache nem `resolve`: o model **é** o objeto, e o rótulo
     * sai dele por `getProperty`. É a rota barata para tela de edição.
     */
    const itemFor = (entry: unknown): Item | undefined => {
        const value = valueOfEntry(entry);
        const onPage = _options.value.find((item) => item.value === value);

        if (onPage) {
            return onPage;
        }

        if (props.value.modelFull && isRecord(entry)) {
            return asItems([
                { value, label: getProperty(entry, keys.value.label), original: entry }
            ]).at(0);
        }

        const cached = remote.pinned.value.get(keyOf(value));

        if (cached) {
            return asItems([cached]).at(0);
        }

        // Em modo remoto o valor cru evita o piscar de vazio até o `resolve` voltar;
        // em modo estático "não está na lista" é "não existe", e mudar isso seria
        // alteração semântica calada no caminho que todo mundo já usa.
        if (remoteMode.value) {
            return asItems([{ value, label: value, original: entry }]).at(0);
        }

        return undefined;
    };

    const selected = computed<Item | Item[] | undefined>(() => {
        const found = modelValues.value
            .map((entry) => itemFor(entry))
            .filter((item): item is Item => item !== undefined);

        if (props.value.multiple) {
            return found;
        }

        return found.at(0);
    });

    /**
     * A quarta fonte do cache: a opção que está na página **e** no model. Sem ela um
     * form carregado do servidor (model já preenchido, ninguém clicou, sem
     * `resolve`) perderia o rótulo no instante em que a busca troca a página — que é
     * exatamente a falha que o cache existe para consertar.
     *
     * Continua limitado ao número de seleções, e não à lista: só o que o model
     * aponta entra.
     */
    watch(
        [_options, modelValues],
        ([options, values]) => {
            if (!remoteMode.value || props.value.modelFull) {
                return;
            }

            for (const entry of values) {
                const value = valueOfEntry(entry);
                const found = options.find((item) => item.value === value);

                if (found) {
                    remote.remember(found);
                }
            }
        },
        { immediate: true }
    );

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

    // `defineAsyncComponent` é a fronteira de *setup* que o `useVirtualizer` exige
    // — ele registra watch/onMounted e precisa da instância corrente, que não
    // sobrevive a um `await import()` no meio deste setup — e a fronteira de *chunk*
    // que o bundle exige, de uma vez.
    const VirtualRows = defineAsyncComponent(() => import("../internal/VirtualRows.vue"));

    const scroller = useTemplateRef<HTMLElement>("scroller");
    const sentinel = useTemplateRef<HTMLElement>("sentinel");

    /**
     * A seção do selecionado, acima do scroller. **Só em modo remoto**: com
     * `options` estática o escolhido já está na lista e sempre esteve, e subi-lo
     * reordenaria a lista de todo mundo, calado.
     *
     * Não guarda estado — é o mesmo `selected` que o cache já computa —, então a
     * ordem é a do model e um item removido sai daqui sozinho.
     */
    const pinnedRows = computed<Item[]>(() => {
        if (!remoteMode.value) {
            return [];
        }

        const current = selected.value;

        if (Array.isArray(current)) {
            return current;
        }

        return current ? [current] : [];
    });

    const pinnedKeys = computed(() => new Set(pinnedRows.value.map((item) => keyOf(item.value))));

    /**
     * As linhas do painel. Em modo estático é a lista inteira, filtrada ou não; em
     * remoto, o que a seção de cima já mostra sai daqui — senão o item que está na
     * página corrente **e** selecionado apareceria duas vezes.
     */
    const rows = computed<Item[]>(() => {
        if (pinnedRows.value.length === 0) {
            return filteredOptions.value;
        }

        return filteredOptions.value.filter((item) => !pinnedKeys.value.has(keyOf(item.value)));
    });

    const status = computed(() => remote.status.value);

    const isEmpty = computed(() => rows.value.length === 0);

    const errorText = computed(() => remote.message.value || tr(props.value.text?.failed));

    const retry = () => remote.retry();

    /**
     * O rodapé só existe para o que acontece **abaixo** de uma lista que já tem
     * linhas: a próxima página em voo, e o erro que não pode tomar a tela inteira.
     */
    const footerStatus = computed<ListStatus | undefined>(() => {
        if (status.value === "loadingMore") {
            return "loadingMore";
        }

        if (status.value === "error" && rows.value.length > 0) {
            return "error";
        }

        return undefined;
    });

    const rowHeight = computed(() => props.value.rowHeight ?? 48);

    /**
     * Acima do limiar a lista vira janela virtual, sozinha — não é prop, é decisão.
     * A troca é **monotônica dentro de uma abertura**: uma vez virtualizado
     * continua assim até fechar, porque alternar a estratégia a cada tecla é jitter
     * de scroll e de foco.
     */
    const virtualized = ref(false);

    watch([rows, open], ([list, isOpen]) => {
        if (!isOpen) {
            virtualized.value = false;
            return;
        }

        if (list.length > VIRTUAL_THRESHOLD) {
            virtualized.value = true;
        }
    });

    // Pré-carrega o chunk no `open` quando `options` é função: ele chega muito antes
    // da centésima linha, e a troca deixa de ter um quadro em branco.
    watch(open, (isOpen) => {
        if (isOpen && remoteMode.value) {
            void import("../internal/VirtualRows.vue");
        }
    });

    let timer: ReturnType<typeof setTimeout> | undefined;

    // Trocar o termo zera tudo e **dispara a página 1 direto**: o observer só reporta
    // mudança de interseção, então a primeira página nunca pode depender dele.
    watch(term, () => {
        if (!remoteMode.value) {
            return;
        }

        clearTimeout(timer);

        const wait = debounce.value;
        const run = () => remote.reset();

        if (wait <= 0) {
            run();
            return;
        }

        timer = setTimeout(run, wait);
    });

    // Primeiro `open`, e não antes: o painel já é lazy, e carregar na montagem seria
    // uma requisição por campo na tela. Fechar **não** reseta — reabrir não custa.
    watch(
        open,
        (isOpen) => {
            if (isOpen && remoteMode.value) {
                remote.first();
            }
        },
        { flush: "post" }
    );

    // O `resolve` é client-only, por `onMounted`: a alternativa (`useAsyncData`)
    // quebraria a regra de que nada em `src/` importa `#app`, e quebraria o campo
    // montado fora de app Nuxt, que é o projeto `unit`.
    onMounted(() => {
        if (remoteMode.value && !props.value.modelFull) {
            remote.hydrate(modelValues.value);
        }
    });

    // O model mudando por fora — reset do Form, `carregar(id)` de um CRUD — é a outra
    // porta de entrada do `resolve`.
    watch(modelValues, (values) => {
        if (remoteMode.value && !props.value.modelFull) {
            remote.hydrate(values);
        }
    });

    let observer: IntersectionObserver | undefined;

    const disconnect = () => {
        observer?.disconnect();
        observer = undefined;
    };

    /**
     * A próxima página por interseção, e não por listener de scroll: o observer não
     * refaz layout a cada quadro para responder a mesma pergunta.
     *
     * O `root` é o scroller, e é o que torna a coluna flex requisito e não gosto —
     * o painel mora em `#teleports`, `position: fixed`, então com `root: null` o
     * observer mede contra a viewport do documento e um painel cheio de itens nunca
     * reporta interseção.
     *
     * A sentinela só existe depois que a primeira página assentou, então armar pela
     * ref dela é o que garante que a página 1 nunca dependa do observer.
     */
    watch([sentinel, scroller], ([mark, root]) => {
        disconnect();

        // Sem `IntersectionObserver` (SSR, happy-dom) não há paginação por scroll —
        // a página 1 continua carregando pelo caminho direto. Mesma disciplina do
        // `isFile` com `typeof File !== "undefined"`.
        if (!mark || !root || typeof IntersectionObserver === "undefined") {
            return;
        }

        observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    remote.next();
                }
            },
            { root, rootMargin: "200px 0px" }
        );

        observer.observe(mark);
    });

    onUnmounted(() => {
        clearTimeout(timer);
        disconnect();
        remote.stop();
    });
</script>