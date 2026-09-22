import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, Suspense, type Component } from "vue";

import { RDate, RHour, RNumber, RText, RTextarea } from "#components";
// O fixture substitui o `Switch` embutido; este só chega pelo alias.
import RSwitch from "#rform/builtin/fields/Switch.vue";

/**
 * O cenário da issue #6: o campo monta dentro de um `<Suspense>` que um irmão
 * assíncrono ainda segura, e o model chega **antes** de o Suspense resolver. O
 * `mounted` de uma diretiva é post-render effect, e o Suspense o represa até o
 * resolve — com `v-model` no elemento nativo, ele reaplicava o valor do vnode da
 * montagem por cima do que o `beforeUpdate` já tinha escrito.
 */
const mountPending = async (
    component: Component,
    props: Record<string, unknown>,
    initial: unknown
) => {
    const model = ref<unknown>(initial);

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });

    // O irmão que segura o Suspense até `release()`.
    const Gate = defineComponent({
        async setup() {
            await gate;
            return () => h("span");
        }
    });

    const wrapper = await mountSuspended(
        {
            setup: () => () =>
                h(Suspense, null, {
                    default: () =>
                        h("div", [
                            h(component, {
                                ...props,
                                modelValue: model.value,
                                "onUpdate:modelValue": (value: unknown) => {
                                    model.value = value;
                                }
                            }),
                            h(Gate)
                        ])
                })
        },
        { attachTo: document.body }
    );

    const suspense = () => wrapper.vm.$.subTree.suspense;

    // O ramo pendente mora num container escondido, fora do documento — é por ele
    // que se enxerga o campo antes do resolve.
    const branch = () =>
        (suspense()?.pendingBranch?.el ?? suspense()?.activeBranch?.el) as HTMLElement;

    const field = (selector = "input, textarea") =>
        branch().querySelector<HTMLInputElement>(selector);

    // Espera o setup assíncrono do campo — e não o do Gate — assentar.
    await vi.waitFor(() => expect(branch().querySelector(".RField")).not.toBeNull());

    return {
        model,
        branch,
        field,
        pending: () => suspense()?.pendingBranch !== null,
        write: async (value: unknown) => {
            model.value = value;
            await nextTick();
        },
        resolve: async () => {
            release();
            await vi.waitFor(() => expect(suspense()?.pendingBranch).toBeNull());
            await nextTick();
        }
    };
};

describe("campo dentro de Suspense pendente (issue #6)", () => {
    it("RText mantém o valor escrito antes do resolve", async () => {
        const { field, pending, write, resolve } = await mountPending(RText, { name: "nome" }, "");

        await write("Atendas");
        expect(pending()).toBe(true);
        expect(field()!.value).toBe("Atendas");

        await resolve();
        expect(field()!.value).toBe("Atendas");
    });

    it("RTextarea mantém o valor escrito antes do resolve", async () => {
        const { field, write, resolve } = await mountPending(RTextarea, { name: "bio" }, "");

        await write("Atendas");
        await resolve();

        expect(field("textarea")!.value).toBe("Atendas");
    });

    it("RNumber mantém o valor escrito antes do resolve", async () => {
        const { field, write, resolve } = await mountPending(RNumber, { name: "idade" }, 0);

        await write(42);
        await resolve();

        expect(field()!.value).toBe("42");
    });

    it("RSwitch mantém o checked escrito antes do resolve", async () => {
        const { field, write, resolve } = await mountPending(RSwitch, { name: "ativo" }, false);

        await write(true);
        await resolve();

        expect(field()!.checked).toBe(true);
    });

    it("RDate mantém a data escrita antes do resolve", async () => {
        const { field, write, resolve } = await mountPending(RDate, { name: "nascimento" }, "");

        await write("2026-05-15");
        await resolve();

        expect(field()!.value).toBe("15/05/2026");
    });

    it("RDate em range mantém as duas partes escritas antes do resolve", async () => {
        const { branch, write, resolve } = await mountPending(
            RDate,
            { name: "periodo", mode: "range" },
            [undefined, undefined]
        );

        await write(["2026-05-15", "2026-05-20"]);
        await resolve();

        const inputs = branch().querySelectorAll("input");
        expect(inputs[0]!.value).toBe("15/05/2026");
        expect(inputs[1]!.value).toBe("20/05/2026");
    });

    it("RHour mantém a hora escrita antes do resolve", async () => {
        const { field, write, resolve } = await mountPending(RHour, { name: "inicio" }, "");

        await write("10:30");
        await resolve();

        expect(field()!.value).toBe("10:30");
    });

    it("RHour em range mantém as duas partes escritas antes do resolve", async () => {
        const { branch, write, resolve } = await mountPending(
            RHour,
            { name: "turno", range: true },
            ["", ""]
        );

        await write(["10:30", "11:00"]);
        await resolve();

        const inputs = branch().querySelectorAll("input");
        expect(inputs[0]!.value).toBe("10:30");
        expect(inputs[1]!.value).toBe("11:00");
    });
});