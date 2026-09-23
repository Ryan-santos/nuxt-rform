import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { beforeAll, describe, expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import { z } from "zod";

import { RForm, RObject, RText } from "#components";

// `scrollIntoView` não existe no happy-dom, e o `focusFirstError` chama um por
// submissão inválida.
beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

type Scope = {
    validate: () => Promise<boolean>;
    submit: () => Promise<Record<string, string> | undefined>;
    setErrors: (input?: Record<string, unknown>) => Promise<void>;
};

/** Monta um Form com o slot que o cenário desenhar, e devolve o escopo dele. */
const mount = async (props: Record<string, unknown>, children: () => unknown) => {
    let scope: Scope | undefined;

    const wrapper = await mountSuspended(RForm, {
        // Anexado ao documento: `focus()` é no-op numa árvore destacada, e é o foco
        // que o último bloco daqui asserta.
        attachTo: document.body,
        props: props as never,
        slots: {
            default: (received: Record<string, unknown>) => {
                scope = received as unknown as Scope;
                return children();
            }
        }
    });

    // Duas voltas: o watcher do bag é síncrono, mas o `<p class="RUtilsError">` só
    // existe depois do render seguinte.
    const settle = async () => {
        await nextTick();
        await nextTick();
    };

    return { wrapper, scope: scope!, settle };
};

describe("erros vindos de fora", () => {
    it("pousa setErrors no campo de mesmo name", async () => {
        const { wrapper, scope, settle } = await mount({ modelValue: { nome: "" } }, () =>
            h(RText, { name: "nome" } as never)
        );

        await scope.setErrors({ nome: "Já existe" });
        await settle();

        expect(wrapper.text()).toContain("Já existe");
    });

    it("chega num campo dentro de RObject, aninhado ou pontilhado", async () => {
        const children = () =>
            h(RObject, { name: "endereco" } as never, {
                default: () => h(RText, { name: "cep" } as never)
            });

        const nested = await mount({ modelValue: { endereco: {} } }, children);

        await nested.scope.setErrors({ endereco: { cep: "CEP inválido" } });
        await nested.settle();

        expect(nested.wrapper.text()).toContain("CEP inválido");

        const dotted = await mount({ modelValue: { endereco: {} } }, children);

        await dotted.scope.setErrors({ "endereco.cep": "CEP inválido" });
        await dotted.settle();

        expect(dotted.wrapper.text()).toContain("CEP inválido");
    });

    it("volta a mostrar a mesma mensagem depois de o campo ser corrigido", async () => {
        const { wrapper, scope, settle } = await mount({ modelValue: { nome: "" } }, () =>
            h(RText, { name: "nome" } as never)
        );

        await scope.setErrors({ nome: "Já existe" });
        await settle();
        expect(wrapper.text()).toContain("Já existe");

        // Digitar consome a entrada do bag — é isso que o `delete` no setter compra.
        await wrapper.find("input").setValue("outro");
        await settle();
        expect(wrapper.text()).not.toContain("Já existe");

        await scope.setErrors({ nome: "Já existe" });
        await settle();
        expect(wrapper.text()).toContain("Já existe");
    });

    it("não passa a mensagem do bag pelo tradutor", async () => {
        const { wrapper, scope, settle } = await mount({ modelValue: { nome: "" } }, () =>
            h(RText, { name: "nome" } as never)
        );

        // O que o Form empurra já vem resolvido; só o `error` do call site é `TrInput`.
        await scope.setErrors({ nome: "rform.presets.rules.required" });
        await settle();

        expect(wrapper.text()).toContain("rform.presets.rules.required");
        expect(wrapper.text()).not.toContain("Campo obrigatório.");
    });

    it("faz o retorno do onSubmit virar erro de campo", async () => {
        const { wrapper, scope, settle } = await mount(
            {
                modelValue: { nome: "Ana" },
                onSubmit: () => ({ nome: "Nome já registrado" })
            },
            () => h(RText, { name: "nome" } as never)
        );

        const returned = await scope.submit();
        await settle();

        expect(returned).toEqual({ nome: "Nome já registrado" });
        expect(wrapper.text()).toContain("Nome já registrado");
    });
});

describe("rules agregado no RForm", () => {
    const rules = z.object({
        nome: z.string().min(2, "muito curto"),
        endereco: z.object({ cep: z.string().min(9, "CEP incompleto") })
    });

    it("mapeia o issue do zod no campo que o possui", async () => {
        const { wrapper, scope, settle } = await mount(
            { modelValue: { nome: "a", endereco: { cep: "" } }, rules },
            () => [
                h(RText, { name: "nome" } as never),
                h(RObject, { name: "endereco" } as never, {
                    default: () => h(RText, { name: "cep" } as never)
                })
            ]
        );

        expect(await scope.validate()).toBe(false);
        await settle();

        expect(wrapper.text()).toContain("muito curto");
        expect(wrapper.text()).toContain("CEP incompleto");
    });

    it("deixa a rule do campo vencer o issue agregado", async () => {
        const { wrapper, scope, settle } = await mount(
            {
                modelValue: { nome: "a", endereco: { cep: "12345-678" } },
                rules
            },
            () => [
                h(RText, {
                    name: "nome",
                    rule: () => "a rule do campo"
                } as never),
                h(RObject, { name: "endereco" } as never, {
                    default: () => h(RText, { name: "cep" } as never)
                })
            ]
        );

        await scope.validate();
        await settle();

        expect(wrapper.text()).toContain("a rule do campo");
        expect(wrapper.text()).not.toContain("muito curto");
    });
});

describe("o contrato de validate e submit", () => {
    it("devolve boolean e não rejeita", async () => {
        const invalid = await mount({ modelValue: { nome: "" } }, () =>
            h(RText, { name: "nome", rule: "required" } as never)
        );

        await expect(invalid.scope.validate()).resolves.toBe(false);

        const valid = await mount({ modelValue: { nome: "Ana" } }, () =>
            h(RText, { name: "nome", rule: "required" } as never)
        );

        await expect(valid.scope.validate()).resolves.toBe(true);
    });

    it("devolve o mapa de erros quando inválido, e nada quando passou", async () => {
        const invalid = await mount({ modelValue: { nome: "" } }, () =>
            h(RText, { name: "nome", rule: "required" } as never)
        );

        expect(await invalid.scope.submit()).toEqual({ nome: "Campo obrigatório." });

        const valid = await mount({ modelValue: { nome: "Ana" } }, () =>
            h(RText, { name: "nome", rule: "required" } as never)
        );

        expect(await valid.scope.submit()).toBeUndefined();
    });

    it("recalcula tudo: um erro que não se repete é limpo", async () => {
        const { wrapper, scope, settle } = await mount({ modelValue: { nome: "" } }, () =>
            h(RText, { name: "nome", rule: "required" } as never)
        );

        await scope.validate();
        await settle();
        expect(wrapper.text()).toContain("Campo obrigatório.");

        // Pelo model, sem passar pelo setter do campo — é o caso que o recálculo cobre.
        await wrapper.setProps({ modelValue: { nome: "Ana" } } as never);
        await settle();

        expect(await scope.validate()).toBe(true);
        await settle();

        expect(wrapper.text()).not.toContain("Campo obrigatório.");
    });

    // Erro de autoria, e por isso alto nos dois pontos. Antes ele só aparecia no
    // mount, e o `validate()` **passava** — a rule nem chegava a ser registrada,
    // então um typo desligava a validação daquele campo calado.
    it("não deixa um preset inexistente aprovar a validação calado", async () => {
        const erro = vi.spyOn(console, "error").mockImplementation(() => {});

        const { scope } = await mount({ modelValue: {} }, () =>
            h(RText, { name: "nome", rule: "naoExiste" } as never)
        );

        await expect(scope.validate()).rejects.toThrow(/naoExiste/);

        // E sem deixar rejeição solta: o mount tem um dono para ela, que é o que faz
        // o typo aparecer mesmo em quem nunca chega a submeter.
        expect(erro).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining("naoExiste") })
        );

        erro.mockRestore();
    });
});

describe("foco no primeiro erro", () => {
    const two = () => [
        h(RText, { name: "nome" } as never),
        h(RText, { name: "cpf", rule: "required" } as never)
    ];

    it("foca o segundo campo quando é ele que falha", async () => {
        const { wrapper, scope, settle } = await mount(
            { modelValue: { nome: "Ana", cpf: "" } },
            two
        );

        await scope.validate();
        await settle();

        const inputs = wrapper.findAll("input");
        expect(document.activeElement).toBe(inputs[1]!.element);
    });

    it("não foca nada quando focusError é false", async () => {
        const { wrapper, scope, settle } = await mount(
            { modelValue: { nome: "Ana", cpf: "" }, focusError: false },
            two
        );

        await scope.validate();
        await settle();

        const inputs = wrapper.findAll("input");
        expect(document.activeElement).not.toBe(inputs[1]!.element);
    });
});