import { computed, inject, type ComputedRef, type Ref } from "vue";

import userDefaults from "#rform/defaults";
import { utils as registry, hooks } from "#rform/registry";
import type { DeepRequired, WithTextSource } from "#rform/types";
import type Utils from "#rform/types/components/utils";
import { hookUi, merger, prefixText } from "#rform/utils";

import type { Tr } from "../utils/i18n";
import type { FieldProps, Injected, ValueProp } from "./useField";
import { keyProp } from "./useField";
import useTranslate from "./useTranslate";

/**
 * O que um util de fato recebe: as props `Element` do campo pai, as próprias, e um
 * `ui` mesclado sobre os defaults completos — então toda chave de `ui` existe, que
 * é o que os templates já assumem.
 *
 * `error` chega `string`, e não `TrInput`: quem traduz é o `useField`, na fronteira
 * do call site.
 */
export type UtilProps<P extends object> = Omit<FieldProps<P>, "ui"> & {
    ui: DeepRequired<NonNullable<P extends { ui?: infer U } ? U : never>>;
};

export type UtilContext<P extends Record<string, unknown>> = {
    props: ComputedRef<UtilProps<P>>;
    upper: ValueProp<P>;
    tr: Tr;
    locale: Ref<string>;
};

const build = <P extends Record<string, unknown>>(
    upper: ValueProp<P>,
    overrides: P,
    defaults: P,
    componentName: keyof Utils,
    translate: Pick<UtilContext<P>, "tr" | "locale">
): UtilContext<P> => {
    // Uma vez, fora do computed: o `prefixText` copia, e o objeto `defaults` do
    // componente é compartilhado por todas as instâncias.
    const prefixed = prefixText(defaults, componentName, "utils") as P;

    const props = computed((): UtilProps<P> => {
        const { ui, ...rest } = upper.props.value;

        const utilUi = typeof ui === "object" ? (ui?.Utils as Utils) : undefined;

        const merged = merger(prefixed, overrides, {
            ...rest,
            ui: utilUi?.[componentName] as P["ui"]
        });

        return {
            ...merged,
            ui: hookUi(merged.ui as UtilProps<P>["ui"], hooks.utils[componentName])
        } as unknown as UtilProps<P>;
    });

    return {
        props,
        upper,
        ...translate
    };
};

/**
 * A composable de todo util: devolve `{ props, upper, tr, locale }`, com as props do
 * campo pai já mescladas. Ver "useUtil" no `.claude/CLAUDE.md`.
 *
 * @example const { props, upper, tr } = useUtil<Props>();
 */
export default function useUtil<P extends Record<string, unknown>>(
    /** Escrito pelo vite plugin, nunca pelo util. */
    injected?: Injected<keyof Utils, WithTextSource<P>>
): UtilContext<P> {
    // Sem fallback: cair no nome de outro componente renderiza com os defaults
    // errados e nunca diz nada.
    if (!injected?.name || !registry.has(injected.name)) {
        throw new Error(
            `[rform] useUtil could not resolve a component name${injected?.name ? ` (got "${injected.name}")` : ""}. A util has to live in the module's own components/utils directory or in app/rform/utils for the build to inject it.`
        );
    }

    const upper = inject<ValueProp<P>>(keyProp, {} as ValueProp<P>);
    const overrides = userDefaults.Utils?.[injected.name] as P;
    const translate = useTranslate();

    return build(upper, overrides, (injected.defaults ?? {}) as P, injected.name, translate);
}