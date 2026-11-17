const FOCUSABLE = [
    "input:not([type='hidden']):not([disabled])",
    "textarea:not([disabled])",
    "select:not([disabled])",
    "button:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
].join(", ");

/**
 * Foca e rola até o primeiro campo com erro dentro de `root`. Devolve o elemento
 * focado, ou `undefined` quando não há erro na tela.
 *
 * Pelo DOM, e não pelo registro do `rulesList`: "primeiro campo com erro" é uma
 * afirmação sobre a ordem **visual**, e `querySelector` já responde em ordem de
 * documento. Ver "O `errorsBag`" no `.claude/CLAUDE.md`.
 *
 * @example focusFirstError(formEl)
 */
export default function focusFirstError(root: HTMLElement | null | undefined) {
    // SSR e ambiente de teste sem DOM não podem lançar.
    if (typeof root?.querySelector !== "function") {
        return undefined;
    }

    // O `v-if` do `RUtilsError` garante que só campo com erro tem um. O
    // `[data-rform-error]` é de quem mostra o erro por outro caminho — a lista do
    // `RPassword`.
    const message = root.querySelector(".RUtilsError, [data-rform-error]");
    const field = message?.closest(".RField");

    if (!field) {
        return undefined;
    }

    const focusable = field.querySelector<HTMLElement>(FOCUSABLE);

    // `preventScroll` e depois `scrollIntoView`: o `focus()` sozinho rola de forma
    // abrupta e descentralizada.
    focusable?.focus?.({ preventScroll: true });

    // Um campo que é só leitura de slot não tem focável, e ainda assim rola.
    field.scrollIntoView?.({ block: "center", behavior: "smooth" });

    return focusable ?? undefined;
}