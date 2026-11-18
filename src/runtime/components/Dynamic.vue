<template>
    <template v-if="isSchema">
        <template
            v-for="(field, key) in entries"
            :key="key"
        >
            <slot
                v-if="'slot' in field"
                :name="field.slot"
                :field-name="key"
                :rule="field.rule"
            />
            <RDynamic
                v-else
                :name="key"
                :schema="field"
            />
        </template>
    </template>

    <template v-else-if="visible">
        <component
            v-if="config?.type === 'object'"
            :is="resolved"
            :name="name"
            v-bind="rest"
        >
            <RDynamic :schema="objectChildren">
                <template
                    v-for="(_, slotName) in $slots"
                    #[slotName]="scope"
                >
                    <slot
                        :name="slotName"
                        v-bind="scope || {}"
                    />
                </template>
            </RDynamic>
        </component>

        <component
            v-else-if="config?.type === 'array'"
            :is="resolved"
            :name="name"
            v-bind="rest"
        >
            <template v-slot="{ index }">
                <RDynamic
                    v-if="arrayChild"
                    :name="index"
                    :schema="arrayChild"
                />
            </template>
        </component>

        <component
            v-else
            :is="resolved"
            :name="name"
            v-bind="rest"
        />
    </template>
</template>

<script setup lang="ts">
    /**
     * Renderiza um `schema` de `useRForm`: recursivo em `object` e `array`, e cada
     * entrada com `slot` vira um slot nomeado que sobe até o `RForm`.
     *
     * É também quem resolve as condições do schema — `visibleWhen` decide o `v-if` e
     * `disabledWhen` preenche o `disabled` do campo. Ver "Condicionais no schema" no
     * `.claude/CLAUDE.md`.
     *
     * @example <RDynamic :schema />
     */
    import { computed, inject, onUnmounted, watch, type Component } from "vue";

    import map from "#rform/components-map";
    import type { Condition, SlotScope } from "#rform/types";
    import type { FieldConfig, FieldType, Schema } from "#rform/types/schema";
    import { matchCondition } from "#rform/utils";

    import { injectFormRoot } from "../composables/formRoot";
    import { injectHiddenList } from "../composables/hiddenList";
    import { key as upperKey } from "../composables/useField";

    export type Props = {
        name?: string | number;
        schema: Schema | FieldConfig;
    };

    const props = defineProps<Props>();

    // Declarado, não inferido: RDynamic renderiza RDynamic, e inferir o escopo do
    // slot pelo uso o faria depender de si mesmo (TS7022).
    defineSlots<Record<string, (scope: SlotScope) => unknown>>();

    const isSchema = computed(
        () =>
            !!props.schema &&
            typeof props.schema === "object" &&
            !("type" in props.schema) &&
            !("slot" in props.schema)
    );

    /** As entradas de um schema aninhado; vazio quando o `schema` é um campo. */
    const entries = computed((): Schema => (isSchema.value ? (props.schema as Schema) : {}));

    /** O campo, quando não é schema. Todo narrowing mora aqui e não no template. */
    const config = computed(() => (isSchema.value ? undefined : (props.schema as FieldConfig)));

    const objectChildren = computed(() =>
        config.value?.type === "object" ? config.value.children : {}
    );

    /** O item de um `array`; `undefined` quando é slot, e aí quem renderiza é o pai. */
    const arrayChild = computed(() => {
        const current = config.value;

        if (current?.type !== "array" || "slot" in current.children) {
            return undefined;
        }

        return current.children;
    });

    // Anotado como `Component`: unir os tipos dos campos num condicional estoura o
    // TS2590 — ver "Toda prop `TrInput` do topo aparece duas vezes" no `.claude/CLAUDE.md`.
    const fields = map as unknown as Record<FieldType, Component>;

    const resolved = computed(() => (config.value ? fields[config.value.type] : null));

    const upper = inject(upperKey, undefined);

    const formRoot = injectFormRoot();

    const hiddenList = injectHiddenList();

    // Montado uma vez, como no `useField`: um `RDynamic` de linha de `RArray` fica
    // com o índice que recebeu, e é o mesmo `id` pontilhado que chaveia as rules.
    const upperId = upper?.id ? `${upper.id}.` : "";
    const id = props.name === undefined ? null : `${upperId}${props.name}`;

    /** As duas grafias de cada condição; no schema o objeto vem de uma API. */
    const CONDITIONS = {
        visibleWhen: "visible_when",
        disabledWhen: "disabled_when"
    } as const;

    const warned = new Set<string>();

    const evaluate = (prop: keyof typeof CONDITIONS): boolean | undefined => {
        const source = config.value as Record<string, Condition | undefined> | undefined;

        // camelCase vence, como no `rest`.
        const when = source?.[prop] ?? source?.[CONDITIONS[prop]];

        // Sai antes de ler o `formRoot`: sem condição não há por que o `rest` deste
        // campo passar a depender do model.
        if (when === undefined) {
            return undefined;
        }

        // Avaliar contra `undefined` esconderia o campo calado.
        if (!formRoot) {
            if (!warned.has(prop)) {
                warned.add(prop);

                console.warn(
                    `[rform] "${prop}" needs an RForm ancestor to read the form from; the condition on "${String(props.name)}" was ignored.`
                );
            }

            return undefined;
        }

        return matchCondition(when, { form: formRoot.value, path: id ?? undefined });
    };

    const visible = computed(() => evaluate("visibleWhen") ?? true);

    // snake_case estrito: `_priv`, `__proto__`, `a__b` e `Foo_bar` não casam — é ela
    // que mantém poluição de protótipo fora do `r[camel]` de chave calculada.
    const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

    const camelize = (key: string) =>
        key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());

    /** O `components-map` importa estaticamente, então isto é a declaração compilada. */
    const declares = (component: unknown, prop: string) => {
        const declared = (component as { props?: unknown })?.props;

        if (Array.isArray(declared)) {
            return declared.includes(prop);
        }

        return !!declared && typeof declared === "object" && prop in declared;
    };

    const rest = computed(() => {
        if (!config.value) {
            return {};
        }

        const { type, children, slot, ...r } = props.schema as Record<string, unknown>;

        // Consumidas aqui e não repassadas: as duas não são props de campo nenhum, e
        // sem o `delete` sairiam como atributo de fallthrough no `<div>` raiz.
        for (const [camel, snake] of Object.entries(CONDITIONS)) {
            delete r[camel];
            delete r[snake];
        }

        // Duas procedências, como o `error` do `useField`: o `disabled` escrito no
        // schema vence a condição, nos dois sentidos.
        const disabled = (r.disabled as boolean | undefined) ?? evaluate("disabledWhen");

        if (disabled !== undefined) {
            r.disabled = disabled;
        }

        // No schema o objeto vem de uma API, e snake_case é a convenção da casa. A
        // regra é geral, mas ancorada nas props reais do componente resolvido: uma
        // chave que ele não declara continua sendo o atributo de fallthrough que já
        // era. Ver "Condicionais no schema" no `.claude/CLAUDE.md`.
        for (const key of Object.keys(r)) {
            if (!SNAKE.test(key)) {
                continue;
            }

            const camel = camelize(key);

            if (!declares(resolved.value, camel)) {
                continue;
            }

            // camelCase vence: quem escreveu as duas quis a explícita.
            r[camel] ??= r[key];

            // Sem o `delete` a chave crua sairia como atributo de fallthrough no
            // `<div>` raiz do campo, ao lado da prop certa.
            delete r[key];
        }

        return r;
    });

    // O campo escondido não monta, então não tem como tirar a própria mensagem da
    // validação: quem o registra é este `RDynamic`, que continua na árvore.
    watch(
        visible,
        (is) => {
            if (!id) {
                return;
            }

            if (is) {
                hiddenList?.value.delete(id);
            } else {
                hiddenList?.value.add(id);
            }
        },
        { immediate: true, flush: "sync" }
    );

    onUnmounted(() => {
        if (id) {
            hiddenList?.value.delete(id);
        }
    });
</script>