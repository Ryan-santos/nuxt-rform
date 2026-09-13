import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";
import { h } from "vue";

import { RSelect } from "#components";

const open = async (wrapper: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) => {
    await wrapper.get('[aria-haspopup="listbox"]').trigger("click");
};

/**
 * Deixa o `load()` e o render que ele dispara assentarem. Relógio de verdade: o
 * `mountSuspended` espera timer, e fingi-lo aqui trava a montagem em vez de
 * acelerar a espera.
 */
const settle = async (wrapper: { vm: { $nextTick: () => Promise<void> } }, ms = 0) => {
    await new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < 6; i++) {
        await Promise.resolve();
    }

    await wrapper.vm.$nextTick();
};

const users = [
    { id: 1, name: "Ana" },
    { id: 2, name: "Bruno" }
];

const pick = { value: "id", label: "name" };

/** O que o campo entrega à fn — só o que estes casos leem. */
type Ctx = { search: string; page: number };

type Finder = { findAll: (s: string) => { text: () => string }[] };

/** As linhas do painel, na ordem em que aparecem. */
const rows = (wrapper: Finder) =>
    wrapper.findAll('[role="listbox"] [role="option"]').map((row) => row.text());

type Listed = { get: (s: string) => { element: Element } };

/** O papel de cada filho da lista, na ordem — a sentinela não tem nenhum. */
const structure = (wrapper: Listed) =>
    [...wrapper.get('[role="listbox"]').element.children]
        .map((child) => child.getAttribute("role"))
        .filter((role): role is string => role !== null);

type Clicker = {
    findAll: (s: string) => { text: () => string; trigger: (e: string) => Promise<void> }[];
};

/** Clica na linha com este rótulo. */
const click = async (wrapper: Clicker, label: string) => {
    const row = wrapper.findAll('[role="listbox"] [role="option"]').find((r) => r.text() === label);

    if (!row) {
        throw new Error(`row not found: ${label}`);
    }

    await row.trigger("click");
};

/**
 * `options` como função: quem busca e pagina é o app, e o módulo é dono do ciclo
 * (debounce, página, fim da lista, erro, retry).
 */
describe("RSelect com options em função", () => {
    it("carrega no primeiro open, e não antes", async () => {
        const options = vi.fn(() => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, pick } as never
        });

        expect(options).not.toHaveBeenCalled();

        await open(wrapper);
        await settle(wrapper);

        expect(options).toHaveBeenCalledTimes(1);
        expect(rows(wrapper)).toEqual(["Ana", "Bruno"]);
    });

    it("a fn recebe `page` 1-based e o contexto do campo", async () => {
        const options = vi.fn((_ctx: Ctx) => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(options.mock.calls[0]?.[0]).toMatchObject({ page: 1, search: "" });
    });

    it("reabrir não custa requisição — fechar não reseta", async () => {
        const options = vi.fn(() => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);
        await open(wrapper);
        await open(wrapper);
        await settle(wrapper);

        expect(options).toHaveBeenCalledTimes(1);
    });

    it("não liga a busca sozinha — lista infinita sem busca é uso legítimo", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(wrapper.findAll("input[type=search]")).toHaveLength(0);
    });

    it("digitar leva o termo à fn depois do debounce", async () => {
        const options = vi.fn((_ctx: Ctx) => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 120, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("an");
        await settle(wrapper);

        // Antes do debounce, nada de novo saiu.
        expect(options).toHaveBeenCalledTimes(1);

        await settle(wrapper, 200);

        expect(options).toHaveBeenCalledTimes(2);
        expect(options.mock.calls.at(-1)?.[0]).toMatchObject({ search: "an", page: 1 });
    });

    it("debounce 0 de fato desliga — é a armadilha do merger", async () => {
        const options = vi.fn(() => users);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("an");
        await settle(wrapper);

        // Sem `setTimeout` nenhum no caminho: o `0` não foi engolido pelo merger.
        expect(options).toHaveBeenCalledTimes(2);
    });

    it("o rótulo do escolhido sobrevive a uma busca que não o traz", async () => {
        // A busca não devolve a Ana: sem o cache o campo ficaria em branco.
        const options = vi.fn(({ search }: Ctx) => (search ? [{ id: 9, name: "Outro" }] : users));

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.findAll('[role="listbox"] [role="option"]')[0]!.trigger("click");
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("outro");
        await settle(wrapper);

        // A página já não traz a Ana: ela sobe ao topo, e o campo mantém o rótulo.
        expect(rows(wrapper)).toEqual(["Ana", "Outro"]);
        expect(wrapper.get(".RSelect").text()).toContain("Ana");
    });

    it("renderiza o estado vazio quando a fn não devolve nada", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => [], pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toHaveLength(0);
        expect(wrapper.text()).toContain("Nada encontrado");
    });

    it("a fn que rejeita mostra a mensagem e um retry que funciona", async () => {
        let falha = true;

        const options = vi.fn(() => {
            if (falha) {
                return Promise.reject(new Error("502 no servidor"));
            }

            return Promise.resolve(users);
        });

        const wrapper = await mountSuspended(RSelect, {
            props: { options, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(wrapper.text()).toContain("502 no servidor");
        expect(wrapper.text()).toContain("Tentar de novo");

        falha = false;
        await wrapper.get("button").trigger("click");
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana", "Bruno"]);
    });

    it("o erro não vira o `error` do campo — o errorsBag tem um escritor só", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => Promise.reject(new Error("caiu")), pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(wrapper.findAll(".RUtilsError")).toHaveLength(0);
    });

    it("com options estática o filtro local continua sendo o do campo", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["alfa", "beta", "gama"], search: true } as never
        });

        await open(wrapper);
        await wrapper.find("input[type=search]").setValue("ga");

        expect(rows(wrapper)).toEqual(["gama"]);
    });

    it("com options em função o filtro local desiste — a resposta já é a resposta", async () => {
        // O servidor casa por um campo que não é o rótulo; filtrar de novo aqui
        // esconderia justamente a linha que ele acabou de casar.
        const options = vi.fn(() => [{ id: 1, name: "Ana" }]);

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("11999");
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana"]);
    });
});

/**
 * `resolve` traduz o valor que já está no model no item, para a tela de edição
 * mostrar o rótulo em vez do id.
 */
describe("a prop resolve do RSelect", () => {
    it("traduz um valor que não está na página", async () => {
        const resolve = vi.fn(({ value }: { value: unknown }) => [
            { id: value, name: "Ana resolvida" }
        ]);

        const wrapper = await mountSuspended(RSelect, {
            props: {
                options: () => [{ id: 2, name: "Bruno" }],
                resolve,
                modelValue: 7,
                pick
            } as never
        });

        await settle(wrapper);

        expect(resolve).toHaveBeenCalledTimes(1);
        expect(wrapper.get(".RSelect").text()).toContain("Ana resolvida");
    });

    it("não roda com options estática — ali `não está na lista` é `não existe`", async () => {
        const resolve = vi.fn(() => []);

        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, resolve, modelValue: 7, pick } as never
        });

        await settle(wrapper);

        expect(resolve).not.toHaveBeenCalled();
    });

    it("não roda com modelFull — o model já é o objeto", async () => {
        const resolve = vi.fn(() => []);

        const wrapper = await mountSuspended(RSelect, {
            props: {
                options: () => [],
                resolve,
                modelFull: true,
                modelValue: { id: 7, name: "Do model" },
                pick
            } as never
        });

        await settle(wrapper);

        expect(resolve).not.toHaveBeenCalled();
        // O rótulo sai do próprio model, sem cache e sem requisição.
        expect(wrapper.get(".RSelect").text()).toContain("Do model");
    });

    it("não roda com o model vazio", async () => {
        const resolve = vi.fn(() => []);

        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => [], resolve, pick } as never
        });

        await settle(wrapper);

        expect(resolve).not.toHaveBeenCalled();
    });

    it("resolve false recusa o que o defineFieldDefaults padronizou", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => [], resolve: false, modelValue: 7, pick } as never
        });

        await settle(wrapper);

        // Sem rótulo a resolver, o valor cru é o que aparece — e nada quebrou.
        expect(wrapper.get(".RSelect").text()).toContain("7");
    });

    it("escolher pela UI não dispara resolve — o select semeia antes de escrever", async () => {
        const resolve = vi.fn(() => []);

        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, resolve, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.findAll('[role="listbox"] [role="option"]')[0]!.trigger("click");
        await settle(wrapper);

        expect(resolve).not.toHaveBeenCalled();
    });
});
/**
 * O escolhido sobe ao topo da lista, e a lista só é recomposta no `open` e
 * quando uma página assenta sem trazê-lo — nunca no clique. É o que faz uma linha
 * não mudar de lugar sob o cursor.
 */
describe("o escolhido no topo da lista do RSelect", () => {
    it("sobe em modo remoto e fica onde está em estático", async () => {
        const remoto = await mountSuspended(RSelect, {
            props: { options: () => users, modelValue: 2, pick } as never
        });

        await open(remoto);
        await settle(remoto);

        expect(rows(remoto)).toEqual(["Bruno", "Ana"]);

        const estatico = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, pick } as never
        });

        await open(estatico);
        await settle(estatico);

        // Em estático o escolhido já está na lista e sempre esteve; subi-lo
        // reordenaria a lista de todo mundo, calado.
        expect(rows(estatico)).toEqual(["Ana", "Bruno"]);
    });

    it("o item que está na página corrente aparece uma vez só", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, modelValue: 2, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Bruno", "Ana"]);
        expect(wrapper.findAll('[aria-selected="true"]')).toHaveLength(1);
    });

    it("um termo que não casa o rótulo não tira o escolhido da lista", async () => {
        const options = vi.fn(({ search }: Ctx) => (search ? [{ id: 9, name: "Outro" }] : users));

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, modelValue: 1, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("zzz");
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana", "Outro"]);
    });

    it("marcar durante a sessão não move a linha; reabrir é o que a sobe", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, multiple: true, modelValue: [], pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await click(wrapper, "Bruno");
        await settle(wrapper);

        // Marcado, e no mesmo lugar.
        expect(rows(wrapper)).toEqual(["Ana", "Bruno"]);

        await open(wrapper);
        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Bruno", "Ana"]);
    });

    it("desmarcar uma linha do topo a deixa lá até fechar — nada muda sob o cursor", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, multiple: true, modelValue: [2], pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Bruno", "Ana"]);

        await click(wrapper, "Bruno");
        await settle(wrapper);

        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toEqual([]);
        expect(rows(wrapper)).toEqual(["Bruno", "Ana"]);
        expect(wrapper.findAll('[aria-selected="true"]')).toHaveLength(0);

        await open(wrapper);
        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana", "Bruno"]);
    });

    it("o marcado durante a sessão sobe quando a página seguinte não o traz", async () => {
        const options = vi.fn(({ search }: Ctx) => (search ? [{ id: 9, name: "Outro" }] : users));

        const wrapper = await mountSuspended(RSelect, {
            props: {
                options,
                search: true,
                debounce: 0,
                multiple: true,
                modelValue: [],
                pick
            } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await click(wrapper, "Bruno");
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("zzz");
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Bruno", "Outro"]);
    });

    it("a página que volta a trazer o item não o duplica", async () => {
        const options = vi.fn(({ search }: Ctx) => (search ? [{ id: 9, name: "Outro" }] : users));

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, modelValue: 1, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("zzz");
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana", "Outro"]);

        await wrapper.find("input[type=search]").setValue("");
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana", "Bruno"]);
    });

    it("o empty renderiza abaixo do topo, nunca no lugar dele", async () => {
        const options = vi.fn(({ search }: Ctx) => (search ? [] : users));

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, modelValue: 1, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        await wrapper.find("input[type=search]").setValue("zzz");
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana"]);
        expect(wrapper.text()).toContain("Nada encontrado");
    });

    it("não é 'vazio' quando tudo o que a página trouxe já está no topo", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, multiple: true, modelValue: [1, 2], pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Ana", "Bruno"]);
        expect(wrapper.text()).not.toContain("Nada encontrado");
    });
});

/**
 * A quarta fonte do cache: a opção que está na página **e** no model. É o caso do
 * form carregado do servidor em que ninguém clicou e não há `resolve`.
 */
describe("o cache de rótulos do RSelect sem resolve", () => {
    it("aprende o rótulo do que já está no model, e ele sobrevive à troca de página", async () => {
        const options = vi.fn(({ search }: Ctx) => (search ? [{ id: 9, name: "Outro" }] : users));

        const wrapper = await mountSuspended(RSelect, {
            props: { options, search: true, debounce: 0, modelValue: 1, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        // Antes de trocar de página o rótulo sai da própria lista.
        expect(wrapper.get(".RSelect").text()).toContain("Ana");

        await wrapper.find("input[type=search]").setValue("zzz");
        await settle(wrapper);

        // A página já não traz a Ana; o rótulo dela é o do cache — no topo e no campo.
        expect(rows(wrapper)).toEqual(["Ana", "Outro"]);
        expect(wrapper.get(".RSelect").text()).toContain("Ana");
    });

    it("sem nada que o responda, o valor cru aparece em vez de um vazio", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => [{ id: 2, name: "Bruno" }], modelValue: 77, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(wrapper.get(".RSelect").text()).toContain("77");
    });

    it("a marca do fim do topo é um elemento entre os dois blocos", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, modelValue: 2, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        // ["Bruno" (do model), "Ana" (da página)], com a marca no meio.
        expect(rows(wrapper)).toEqual(["Bruno", "Ana"]);
        expect(structure(wrapper)).toEqual(["option", "presentation", "option"]);
    });

    it("sem topo não há marca — a lista é um bloco só", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: users, modelValue: 2, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(structure(wrapper)).toEqual(["option", "option"]);
    });

    it("nem quando a página só traz o que já está no topo", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => [users[1]], modelValue: 2, pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toEqual(["Bruno"]);
        expect(structure(wrapper)).toEqual(["option"]);
    });

    it("o slot divider recebe quantas linhas vieram do model", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: () => users, modelValue: 2, pick } as never,
            slots: { divider: ({ count }: { count: number }) => h("b", `${count} no topo`) }
        });

        await open(wrapper);
        await settle(wrapper);

        expect(wrapper.get('[role="presentation"]').text()).toBe("1 no topo");
    });
});
/**
 * Da virtualização só o **chaveamento** é testável aqui: happy-dom não tem layout
 * e todo rect é 0, então a janela em si só se vê em tela.
 */
describe("a virtualização do RSelect", () => {
    const muitos = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

    it("não entra numa lista curta", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: muitos.slice(0, 20), pick } as never
        });

        await open(wrapper);
        await settle(wrapper);

        expect(rows(wrapper)).toHaveLength(20);
    });

    it("entra acima do limiar, e o DOM deixa de ter uma linha por item", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: muitos, pick } as never
        });

        await open(wrapper);
        await settle(wrapper, 50);

        // Sem layout o virtualizer não sabe quantas linhas cabem, mas o que importa
        // aqui é que ele assumiu a lista: 150 `role=option` não sobraram no DOM.
        expect(rows(wrapper).length).toBeLessThan(150);
    });

    it("a marca do fim do topo entra na conta da janela, como qualquer linha", async () => {
        const altura = (wrapper: Listed) =>
            wrapper.get('[role="listbox"] > div').element.getAttribute("style");

        const semTopo = await mountSuspended(RSelect, {
            props: { options: () => muitos, pick, rowHeight: 10 } as never
        });

        await open(semTopo);
        await settle(semTopo, 50);

        expect(altura(semTopo)).toContain("height: 1500px");

        const comTopo = await mountSuspended(RSelect, {
            props: { options: () => muitos, modelValue: 2, pick, rowHeight: 10 } as never
        });

        await open(comTopo);
        await settle(comTopo, 50);

        // A marca é a 151ª entrada, medida pelo virtualizer como as outras: um nó
        // fora dele não entraria nesta conta, e é aí que os offsets desalinham.
        expect(altura(comTopo)).toContain("height: 1510px");
    });
});