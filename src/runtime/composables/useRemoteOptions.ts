import { ref, shallowRef, type Ref } from "vue";

import type { OptionItem, Options, OptionsFn, ResolveFn } from "#rform/types";
import { keyOf, normalizeOptions, type Pick } from "#rform/utils";

/**
 * O estado da lista remota. `loadingMore` é a página seguinte, e é o que separa o
 * rodapé (há itens na tela) do lugar da lista (não há).
 */
export type ListStatus = "idle" | "loading" | "loadingMore" | "error" | "empty" | "done";

export type RemoteOptions = {
    items: Ref<OptionItem[]>;
    status: Ref<ListStatus>;
    /** A mensagem do erro, quando há um. */
    message: Ref<string>;
    /** Não há mais página: array vazio, ou página que não fez a lista crescer. */
    exhausted: Ref<boolean>;
    /** O rótulo do que foi escolhido ou resolvido — nunca a lista. */
    pinned: Ref<Map<string, OptionItem>>;
    /** Semeia o cache antes de o valor ir ao model. */
    remember: (option: OptionItem) => void;
    /** A página 1, uma vez por abertura. */
    first: () => void;
    /** A próxima página. Não reentra, e para em `error` até um `retry()`. */
    next: () => void;
    retry: () => void;
    /** Zera tudo e recarrega — é o que o termo de busca dispara. */
    reset: () => void;
    /** Traduz um valor do model em item, uma vez por chave desconhecida. */
    hydrate: (values: unknown[]) => void;
    stop: () => void;
};

export type Config = {
    /** Getter, para acompanhar a prop: sem função, a lista é estática. */
    fn: () => OptionsFn | undefined;
    resolve: () => ResolveFn | undefined;
    pick: () => Pick;
    search: () => string;
    value: () => unknown;
    form: () => unknown;
    /** A mensagem quando o erro não traz uma. */
    fallback: () => string;
};

/** A mensagem que o app pôs no erro, ou vazio — nunca um `[object Object]`. */
const errorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return typeof error === "string" ? error : "";
};

/**
 * A fila de `options` remotas do `RSelect`: página, fim da lista, erro com retry e
 * o cache de rótulos que faz o selecionado sobreviver a uma busca que não o traz.
 *
 * Sem tradução por dentro — a mensagem entra por `fallback`, no molde do
 * `useUploadQueue`, e é o que a mantém testável sem app.
 *
 * @example const remote = useRemoteOptions({ fn: () => remoteFn.value, pick: () => keys.value, ... });
 */
export default function useRemoteOptions(config: Config): RemoteOptions {
    const items = ref<OptionItem[]>([]);
    const status = ref<ListStatus>("idle");
    const message = ref("");
    const exhausted = ref(false);

    // shallowRef e troca do Map inteiro: a leitura é por chave, e o que muda é a
    // entrada — não o interior de um item.
    const pinned = shallowRef(new Map<string, OptionItem>());

    // As chaves já tentadas pelo `resolve`, inclusive as que ele **não** resolveu:
    // sem isso cada re-render dispararia a requisição de novo.
    const tried = new Set<string>();

    let page = 0;
    let token = 0;
    let controller: AbortController | undefined;

    const abort = () => {
        controller?.abort();
        controller = undefined;
    };

    const remember = (option: OptionItem) => {
        const next = new Map(pinned.value);

        next.set(keyOf(option.value), option);
        pinned.value = next;
    };

    /**
     * Uma página. O `mine !== token` na volta é o discriminador de corrida, o mesmo
     * do `useUploadQueue`: a resposta obsoleta não toca em nada.
     */
    const load = async (more: boolean) => {
        const fn = config.fn();

        // (a) não reentra se já está carregando, e não tenta depois do fim.
        if (
            !fn ||
            exhausted.value ||
            status.value === "loading" ||
            status.value === "loadingMore"
        ) {
            return;
        }

        const mine = ++token;

        abort();
        controller = new AbortController();

        const mineController = controller;

        status.value = more ? "loadingMore" : "loading";
        message.value = "";

        const wanted = page + 1;

        try {
            const result = await fn({
                search: config.search(),
                value: config.value(),
                form: config.form(),
                page: wanted,
                loaded: items.value,
                signal: mineController.signal
            });

            if (mine !== token) {
                return;
            }

            const fresh = normalizeOptions(result as Options, config.pick());

            // (b) array vazio encerra — é o contrato.
            if (fresh.length === 0) {
                exhausted.value = true;
                status.value = items.value.length === 0 ? "empty" : "done";

                return;
            }

            const seen = new Set(items.value.map((item) => keyOf(item.value)));
            const added = fresh.filter((item) => !seen.has(keyOf(item.value)));

            items.value = more ? [...items.value, ...added] : fresh;
            page = wanted;

            // (c) página que não faz a lista crescer também encerra: é a guarda
            // contra a fn que ignora `page` e devolve sempre o mesmo. Sem ela o
            // sintoma é o navegador travando.
            if (more && added.length === 0) {
                exhausted.value = true;
                status.value = "done";

                return;
            }

            status.value = items.value.length === 0 ? "empty" : "idle";
        } catch (error: unknown) {
            if (mine !== token || mineController.signal.aborted) {
                return;
            }

            // (d) erro para a paginação até um retry explícito: rearmar sozinho é
            // uma tempestade contra um servidor que já está caindo.
            message.value = errorMessage(error) || config.fallback();
            status.value = "error";
        }
    };

    const first = () => {
        if (page > 0 || status.value === "loading") {
            return;
        }

        void load(false);
    };

    const next = () => {
        if (page === 0 || status.value === "error") {
            return;
        }

        void load(true);
    };

    const retry = () => {
        if (status.value !== "error") {
            return;
        }

        status.value = "idle";

        void load(page > 0);
    };

    const reset = () => {
        abort();
        ++token;
        page = 0;
        items.value = [];
        exhausted.value = false;
        message.value = "";
        status.value = "idle";

        void load(false);
    };

    /**
     * O `resolve`, uma vez por chave que nem a lista nem o cache respondem. Tudo que
     * ele devolve entra no cache — inclusive o que não foi pedido —, e **nunca** na
     * lista: um item resolvido aparecendo no painel seria duplicata.
     */
    const hydrate = (values: unknown[]) => {
        const resolve = config.resolve();

        if (!resolve) {
            return;
        }

        const known = new Set(items.value.map((item) => keyOf(item.value)));

        const missing = values.filter((value) => {
            if (value === undefined || value === null || value === "") {
                return false;
            }

            const key = keyOf(value);

            return !known.has(key) && !pinned.value.has(key) && !tried.has(key);
        });

        for (const value of missing) {
            tried.add(keyOf(value));

            const own = new AbortController();

            void Promise.resolve(resolve({ value, form: config.form(), signal: own.signal }))
                .then((result) => {
                    const next = new Map(pinned.value);

                    for (const item of normalizeOptions(result as Options, config.pick())) {
                        next.set(keyOf(item.value), item);
                    }

                    pinned.value = next;
                })
                .catch(() => {
                    // Rótulo é aparência: uma tradução que falhou deixa o valor cru
                    // na tela e não tem onde reclamar — o `error` do campo é do
                    // `errorsBag`, que tem um escritor só.
                });
        }
    };

    const stop = () => {
        abort();
        ++token;
    };

    return {
        items,
        status,
        message,
        exhausted,
        pinned,
        remember,
        first,
        next,
        retry,
        reset,
        hydrate,
        stop
    };
}