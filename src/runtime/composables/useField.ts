import {
    computed,
    inject,
    onUnmounted,
    provide,
    ref,
    useModel,
    watch,
    type ComputedRef,
    type InjectionKey,
    type ModelRef,
    type Ref
} from "vue";

import userDefaults from "#rform/defaults";
// Estático, e é o que mantém a composable síncrona: uma mask não importa zod, então
// ela não paga o import dinâmico que as rules obrigam.
import { masks } from "#rform/masks";
import { components as registry, hooks } from "#rform/registry";
import type { Element } from "#rform/types";
import type Components from "#rform/types/components";
import { hookUi, merger, prefixText, resolveMask, resolveRule, type MaskRef } from "#rform/utils";

import type { Tr } from "../utils/i18n";
import { injectErrorsBag } from "./errorsBag";
import { injectFormRoot } from "./formRoot";
import { injectRulesList } from "./rulesList";
import useTranslate from "./useTranslate";

type Obj = Record<NonNullable<Element["name"]>, unknown>;

export type Value = {
    id: string | null;
    model: ModelRef<Array<unknown> | Obj | undefined>;
};

export const key = Symbol() as InjectionKey<Value>;

/**
 * O que sai do merger: as props do campo com o `error` já resolvido — na entrada ele
 * é `TrInput`, e quem o traduz é este arquivo.
 */
export type FieldProps<T extends object = object> = Omit<Element & T, "error"> & {
    error?: string;
};

export type ValueProp<T extends object = object> = {
    id: string | null;
    props: ComputedRef<FieldProps<T>>;
    model: ModelRef<unknown>;
};

export const keyProp = Symbol() as InjectionKey<ValueProp>;

/** O que a composable devolve. */
export type FieldContext<T extends Element, S = T["modelValue"], G = T["modelValue"]> = {
    id: string | null;
    upper: Value | undefined;
    model: ModelRef<T["modelValue"], string, G, S>;
    mask: ComputedRef<MaskRef | undefined>;
    props: ComputedRef<FieldProps<T>>;
    tr: Tr;
    locale: Ref<string>;
};

type Options<T extends Element, S, G> = {
    set?: (value: T["modelValue"]) => S;
    get?: (value: T["modelValue"]) => G;
};

/**
 * O que o `src/vite.plugin.ts` escreve na chamada: o nome do arquivo e o `defaults`
 * que o componente declara ao lado. `defaults` é opcional — nem todo componente o
 * declara, e aí a chave não sai.
 */
export type Injected<N, D> = {
    name: N;
    defaults?: D;
};

/**
 * A composable de todo campo: resolve props, model, máscara, validação e tradução.
 * Havendo Form pai e `props.name`, o model lê e escreve direto em
 * `upper.model.value[name]`. Ver "useField" no `.claude/CLAUDE.md`.
 *
 * @example const { id, model, props, tr } = useField(_props);
 */
export default function useField<T extends Element, S = T["modelValue"], G = T["modelValue"]>(
    sourceProps: T,
    opts?: Options<T, S, G>,
    /** Escrito pelo vite plugin, nunca pelo campo. */
    injected?: Injected<keyof Components, Element>
): FieldContext<T, S, G> {
    // Sem fallback: cair no nome de outro componente renderiza o campo com os
    // defaults errados e nunca diz nada.
    if (!injected?.name || !registry.has(injected.name)) {
        throw new Error(
            `[rform] useField could not resolve a component name${injected?.name ? ` (got "${injected.name}")` : ""}. A field has to live in the module's own components directory or in app/rform/fields for the build to inject it.`
        );
    }

    // Todo campo ganha `tr` e `locale` sem escrever import, inclusive um campo do
    // usuário em `app/rform/fields`.
    const { tr, locale } = useTranslate();

    // Prefixado **antes** do merger: é o que dá procedência de graça ao texto. Já
    // pronto aqui, e não num ref preenchido depois, então o `props` nasce completo e
    // o watcher de seed enxerga o `default` de verdade na primeira passada.
    const defaults = prefixText(injected.defaults ?? {}, injected.name, "fields") as Element;

    const overrides = userDefaults[injected.name];

    const localProps = ref<Element>({});

    // Fora do `localProps`, e `string`: o que o `errorsBag` empurra já é a mensagem
    // pronta, enquanto o `error` do call site ainda é um `TrInput` a resolver.
    const error = ref<string>();

    // Ausente em `Form` e `Dynamic`: o mapa gerado só lista o que saiu de um
    // diretório `fields`.
    const hook = (hooks.fields as Record<string, string | undefined>)[injected.name];

    const props = computed(() => {
        const merged = merger(defaults, overrides, localProps.value, sourceProps) as FieldProps<T>;

        // A tradução acontece aqui, na fronteira do call site: um segundo `tr` sobre a
        // mensagem do bag a levaria ao `t` do app e cairia no aviso de *missing key*.
        merged.error = sourceProps.error ? tr(sourceProps.error) : error.value;

        merged.ui = hookUi(merged.ui, hook) as typeof merged.ui;

        return merged;
    });

    const upper = inject(key, undefined);

    // Antes do `useModel`: o setter descarta a entrada do bag pelo `id`.
    const upperId = upper?.id ? `${upper.id}.` : "";
    const id = props.value.name !== undefined ? `${upperId}${props.value.name}` : null;

    const errorsBag = injectErrorsBag();

    const cloneDefault = (): unknown => {
        const def = props.value.default;
        if (def !== null && typeof def === "object") {
            return structuredClone(def);
        }
        return def;
    };

    // `sourceProps`, não `props.value`: o snapshot do merger não é rastreável e o
    // `localValue` congelaria (ver "useField" no `.claude/CLAUDE.md`).
    const model = useModel(sourceProps, "modelValue", {
        set(value): S {
            error.value = undefined;

            // Consome a entrada do Form: sem isso, a mesma mensagem empurrada de novo
            // (submit → corrige → submit) não seria mudança e o watcher não dispararia.
            if (id && errorsBag && id in errorsBag.value) {
                delete errorsBag.value[id];
            }

            value = opts?.set?.(value) ?? value ?? cloneDefault();

            if (
                upper?.model?.value &&
                typeof upper.model.value === "object" &&
                props.value?.name !== undefined
            ) {
                (upper.model.value as Obj)[props.value.name] = value;
            }

            return value as S;
        },
        // O fallback clona: entregar o `default` cru deixava um filho poluir o objeto
        // que o componente declarou (ver "useField" no `.claude/CLAUDE.md`).
        get(value): G {
            if (upper?.model && props.value?.name !== undefined) {
                const accessor = upper.model.value as Obj;
                const get = accessor?.[props.value.name] ?? cloneDefault();
                return (opts?.get?.(get) ?? get) as G;
            }

            const get = value ?? cloneDefault();
            return (opts?.get?.(get) ?? get) as G;
        }
    });

    const currentValue = () => {
        if (upper?.model && props.value?.name !== undefined) {
            return (upper.model.value as Obj | undefined)?.[props.value.name];
        }
        return props.value.modelValue;
    };

    const seed = () => {
        if (upper?.model && props.value?.name !== undefined) {
            const acc = upper.model.value;

            if (!acc || typeof acc !== "object") {
                return;
            }

            // Índice além do fim = array que acabou de encolher; semear ali
            // ressuscitaria o slot (ver "useField" no `.claude/CLAUDE.md`).
            if (Array.isArray(acc) && Number(props.value.name) >= acc.length) {
                return;
            }

            (acc as Obj)[props.value.name] = cloneDefault();
            return;
        }
        model.value = cloneDefault();
    };

    watch(
        currentValue,
        (current) => {
            if (current === undefined) {
                seed();
            }
        },
        { immediate: true, flush: "sync" }
    );

    provide(keyProp, {
        id,
        props,
        model
    });

    const rulesList = injectRulesList();
    const formRoot = injectFormRoot();

    // Sem isto, uma linha removida de um `RArray` deixa uma rule órfã reprovando o
    // submit sobre um model já descartado.
    onUnmounted(() => {
        if (id) {
            rulesList?.value.delete(id);
        }
    });

    // O bag é o único escritor do `error`. `flush: "sync"` pelo mesmo motivo do
    // watcher de seed: o setter do model limpa o erro de forma síncrona, e um flush
    // atrasado inverteria a ordem.
    watch(
        () => (id && errorsBag ? errorsBag.value[id] : undefined),
        (message) => {
            error.value = message;
        },
        { immediate: true, flush: "sync" }
    );

    const field = injected.name.toLowerCase();

    // As masks são estáticas, então o `mask` está certo já no primeiro render — sem a
    // carga ansiosa que obrigava o `setup` a ser async.
    const mask = computed(() =>
        resolveMask((props.value as { mask?: Parameters<typeof resolveMask>[0] }).mask, masks)
    );

    // Só as rules ficam no import dinâmico: são elas que trazem zod, e mantê-lo fora
    // do caminho crítico de uma página sem validação é o ponto.
    let rules: (typeof import("#rform/presets"))["rules"] | undefined;

    const loadRules = async () => {
        rules ??= (await import("#rform/presets")).rules;
        return rules;
    };

    watch(
        () => props.value.rule,
        (rule) => {
            if (!id) {
                return;
            }

            // A única saída de `resolveRule` sem validador, e por isso a decisão cabe
            // aqui, síncrona: todo o resto ou resolve ou lança.
            if (rule === null || rule === undefined) {
                error.value = undefined;

                if (errorsBag && id in errorsBag.value) {
                    delete errorsBag.value[id];
                }

                rulesList?.value?.delete(id);
                return;
            }

            // Resolvido já aqui, para um preset inexistente falhar no mount e não só
            // no submit — e o `set` abaixo é **síncrono**, porque o `rulesList` precisa
            // estar completo quando o campo monta: com o `ref` do template em pé
            // (issue #8), um `form.validate()` logo depois passaria por cima da rule.
            const resolved = loadRules().then((table) => resolveRule(rule, table, field));

            // O `fn` relança ao validar, mas pode nunca rodar — sem um dono aqui, um
            // typo de preset vira unhandled rejection solta. Ver "useField" no
            // `.claude/CLAUDE.md`.
            resolved.catch((cause: unknown) => console.error(cause));

            // Só devolve a mensagem: quem a escreve no campo é o `errorsBag`.
            const fn = async () => {
                const validate = await resolved;

                if (!validate) {
                    return;
                }

                try {
                    localProps.value.loading = true;

                    return await validate(model.value, formRoot?.value);
                } finally {
                    localProps.value.loading = undefined;
                }
            };

            rulesList?.value?.set(id, fn);
        },
        {
            immediate: true
        }
    );

    return {
        id,
        upper,
        model,
        mask,
        props,
        tr,
        locale
    };
}