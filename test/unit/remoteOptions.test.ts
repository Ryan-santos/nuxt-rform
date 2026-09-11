import { describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

import useRemoteOptions, {
    type Config,
    type RemoteOptions
} from "../../src/runtime/composables/useRemoteOptions";
import type { OptionsFn, ResolveFn } from "../../src/runtime/type";

/** Uma página de `n` itens, numerados a partir do offset da página. */
const pageOf = (page: number, size = 2) =>
    Array.from({ length: size }, (_, i) => {
        const id = (page - 1) * size + i + 1;

        return { id, name: `Item ${id}` };
    });

/** Monta a composable num escopo, como um setup faria. */
const build = (config: Partial<Config> & Pick<Config, "fn">) => {
    const scope = effectScope();

    let search = "";

    const remote = scope.run(() =>
        useRemoteOptions({
            resolve: () => undefined,
            pick: () => ({ value: "id", label: "name" }),
            search: () => search,
            value: () => undefined,
            form: () => ({}),
            fallback: () => "falhou",
            ...config
        })
    ) as RemoteOptions;

    return {
        remote,
        scope,
        setSearch: (term: string) => {
            search = term;
        }
    };
};

/** Deixa a microtask do `load` resolver. */
const settle = async () => {
    for (let i = 0; i < 6; i++) {
        await Promise.resolve();
    }
};

describe("useRemoteOptions", () => {
    it("pagina 1 → 2 → 3, concatenando", async () => {
        const fn = vi.fn(({ page }) => pageOf(page)) as unknown as OptionsFn;
        const { remote } = build({ fn: () => fn });

        remote.first();
        await settle();

        expect(remote.items.value.map((i) => i.value)).toEqual([1, 2]);

        remote.next();
        await settle();
        remote.next();
        await settle();

        expect(remote.items.value.map((i) => i.value)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(remote.status.value).toBe("idle");
    });

    it("array vazio encerra, e a página 1 vazia é `empty`", async () => {
        const fn = vi.fn(() => []) as unknown as OptionsFn;
        const { remote } = build({ fn: () => fn });

        remote.first();
        await settle();

        expect(remote.status.value).toBe("empty");
        expect(remote.exhausted.value).toBe(true);

        remote.next();
        await settle();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("array vazio na página 2 encerra com `done`, sem apagar a lista", async () => {
        const fn = vi.fn(({ page }) => (page === 1 ? pageOf(1) : [])) as unknown as OptionsFn;
        const { remote } = build({ fn: () => fn });

        remote.first();
        await settle();
        remote.next();
        await settle();

        expect(remote.status.value).toBe("done");
        expect(remote.items.value).toHaveLength(2);
    });

    it("página que não faz a lista crescer encerra — a fn que ignora `page`", async () => {
        const fn = vi.fn(() => pageOf(1)) as unknown as OptionsFn;
        const { remote } = build({ fn: () => fn });

        remote.first();
        await settle();
        remote.next();
        await settle();

        expect(remote.exhausted.value).toBe(true);
        expect(remote.items.value).toHaveLength(2);

        remote.next();
        await settle();

        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("não reentra enquanto a página está em voo", async () => {
        const fn = vi.fn(
            ({ page }) => new Promise((r) => setTimeout(() => r(pageOf(page)), 5))
        ) as unknown as OptionsFn;
        const { remote } = build({ fn: () => fn });

        remote.first();
        remote.first();
        remote.next();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("erro só rearma com `retry()`", async () => {
        let falha = true;

        const fn = vi.fn(({ page }) => {
            if (falha) {
                throw new Error("502");
            }

            return pageOf(page);
        }) as unknown as OptionsFn;

        const { remote } = build({ fn: () => fn });

        remote.first();
        await settle();

        expect(remote.status.value).toBe("error");
        expect(remote.message.value).toBe("502");

        // `next()` não rearma sozinho.
        remote.next();
        await settle();
        expect(fn).toHaveBeenCalledTimes(1);

        falha = false;
        remote.retry();
        await settle();

        expect(remote.status.value).toBe("idle");
        expect(remote.items.value).toHaveLength(2);
    });

    it("erro sem mensagem cai no `fallback`", async () => {
        const fn = vi.fn(() => {
            throw new Error("");
        }) as unknown as OptionsFn;

        const { remote } = build({ fn: () => fn, fallback: () => "o padrão" });

        remote.first();
        await settle();

        expect(remote.message.value).toBe("o padrão");
    });

    it("a corrida: a busca A que resolve depois da B não escreve nada", async () => {
        const gates: Array<(value: unknown) => void> = [];

        const fn = vi.fn(
            ({ search }) =>
                new Promise((resolve) => {
                    gates.push(() =>
                        resolve(
                            search === "A" ? [{ id: 1, name: "de A" }] : [{ id: 2, name: "de B" }]
                        )
                    );
                })
        ) as unknown as OptionsFn;

        const { remote, setSearch } = build({ fn: () => fn });

        setSearch("A");
        remote.first();

        setSearch("B");
        remote.reset();

        // B resolve primeiro, A depois — a ordem que quebra um discriminador ruim.
        gates[1]?.(undefined);
        await settle();
        gates[0]?.(undefined);
        await settle();

        expect(remote.items.value.map((i) => i.label)).toEqual(["de B"]);
    });

    it("`reset()` zera a lista e recarrega da página 1", async () => {
        const fn = vi.fn(({ page, search }) =>
            page === 1 ? [{ id: page, name: search || "vazio" }] : []
        ) as unknown as OptionsFn;

        const { remote, setSearch } = build({ fn: () => fn });

        remote.first();
        await settle();
        expect(remote.items.value[0]?.label).toBe("vazio");

        setSearch("ana");
        remote.reset();
        await settle();

        expect(remote.items.value).toHaveLength(1);
        expect(remote.items.value[0]?.label).toBe("ana");
        expect(remote.exhausted.value).toBe(false);
    });

    it("`remember()` guarda o rótulo, e ele sobrevive ao reset da lista", async () => {
        const fn = vi.fn(({ page }) => pageOf(page)) as unknown as OptionsFn;
        const { remote } = build({ fn: () => fn });

        remote.first();
        await settle();

        remote.remember(remote.items.value[0]!);
        remote.reset();
        await settle();

        expect(remote.pinned.value.get("number:1")?.label).toBe("Item 1");
    });

    it("`hydrate()` roda uma vez por chave desconhecida, e nunca mexe na lista", async () => {
        const fn = vi.fn(({ page }) => pageOf(page)) as unknown as OptionsFn;
        const resolve = vi.fn(({ value }) => [
            { id: value, name: `Resolvido ${String(value)}` }
        ]) as unknown as ResolveFn;

        const { remote } = build({ fn: () => fn, resolve: () => resolve });

        remote.hydrate([99]);
        remote.hydrate([99]);
        await settle();

        expect(resolve).toHaveBeenCalledTimes(1);
        expect(remote.pinned.value.get("number:99")?.label).toBe("Resolvido 99");
        expect(remote.items.value).toHaveLength(0);
    });

    it("`hydrate()` não pede o que a lista ou o cache já respondem, nem valor vazio", async () => {
        const fn = vi.fn(({ page }) => pageOf(page)) as unknown as OptionsFn;
        const resolve = vi.fn(() => []) as unknown as ResolveFn;

        const { remote } = build({ fn: () => fn, resolve: () => resolve });

        remote.first();
        await settle();

        remote.hydrate([1, 2, undefined, null, ""]);
        await settle();

        expect(resolve).not.toHaveBeenCalled();
    });

    it("`hydrate()` marca a chave mesmo quando o resolve falha", async () => {
        const fn = vi.fn(() => []) as unknown as OptionsFn;
        const resolve = vi.fn(() => Promise.reject(new Error("404"))) as unknown as ResolveFn;

        const { remote } = build({ fn: () => fn, resolve: () => resolve });

        remote.hydrate([7]);
        await settle();
        remote.hydrate([7]);
        await settle();

        expect(resolve).toHaveBeenCalledTimes(1);
    });

    it("sem fn nada carrega", async () => {
        const { remote } = build({ fn: () => undefined });

        remote.first();
        await settle();

        expect(remote.status.value).toBe("idle");
        expect(remote.items.value).toHaveLength(0);
    });
});