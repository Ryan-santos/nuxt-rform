import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { h, nextTick } from "vue";

import { RForm, RText } from "#components";

import useRForm from "../../src/runtime/composables/useRForm";

// Um campo só registra o validador quando um Form provê o registro de rules, então
// todo caso aqui passa pela cadeia de verdade: useField → resolveRule → validation.
const mountField = async (rule: unknown, model: Record<string, unknown>) => {
    let scope: { validate: () => Promise<boolean> } | undefined;

    const wrapper = await mountSuspended(RForm, {
        props: { modelValue: model } as never,
        slots: {
            default: (received: Record<string, unknown>) => {
                scope = received as unknown as { validate: () => Promise<boolean> };
                return h(RText, { name: "campo", rule } as never);
            }
        }
    });

    return {
        wrapper,
        validate: async () => {
            // O `validate` devolve boolean e nunca rejeita; o que se asserta é a
            // mensagem, e quem a escreve no campo é o `errorsBag` do Form.
            await scope!.validate();

            await nextTick();
            await nextTick();

            return wrapper.text();
        }
    };
};

describe("presets de rule num campo vivo", () => {
    it("repassa os args nomeados à validation", async () => {
        const short = await mountField({ name: "min", min: 3 }, { campo: "ab" });
        expect(await short.validate()).toContain("Mínimo de 3 caracteres.");

        const ok = await mountField({ name: "min", min: 3 }, { campo: "abc" });
        expect(await ok.validate()).not.toContain("Mínimo");
    });

    it("usa o valor do arg na mensagem, não um fixo", async () => {
        const field = await mountField({ name: "min", min: 8 }, { campo: "ab" });

        expect(await field.validate()).toContain("Mínimo de 8 caracteres.");
    });

    it("resolve um preset brasileiro sob o prefixo br", async () => {
        const bad = await mountField("brCpf", { campo: "111.111.111-11" });
        expect(await bad.validate()).toContain("CPF inválido.");

        const good = await mountField("brCpf", { campo: "529.982.247-25" });
        expect(await good.validate()).not.toContain("CPF inválido.");
    });

    it("entrega a uma função inline o mesmo objeto de contexto", async () => {
        const field = await mountField(
            ({ value, form }: { value: unknown; form: Record<string, unknown> }) =>
                value === form.esperado ? undefined : "não bate com o form",
            { campo: "a", esperado: "b" }
        );

        expect(await field.validate()).toContain("não bate com o form");
    });

    it("roda um array de refs em ordem", async () => {
        const empty = await mountField(["required", { name: "min", min: 3 }], { campo: "" });
        expect(await empty.validate()).toContain("Campo obrigatório.");

        const short = await mountField(["required", { name: "min", min: 3 }], { campo: "ab" });
        expect(await short.validate()).toContain("Mínimo de 3 caracteres.");
    });
});
describe("preset schema", () => {
    it("valida o campo pelo JSON Schema", async () => {
        const rule = { name: "schema", schema: { type: "string", pattern: "^PED-" } };

        const bad = await mountField(rule, { campo: "x" });
        expect(await bad.validate()).toContain("pattern");

        const good = await mountField(rule, { campo: "PED-1" });
        expect(await good.validate()).not.toContain("pattern");
    });

    it("mostra o message no lugar da mensagem do zod", async () => {
        const field = await mountField(
            {
                name: "schema",
                schema: { type: "string", pattern: "^PED-" },
                message: "Formato inválido."
            },
            { campo: "x" }
        );

        expect(await field.validate()).toContain("Formato inválido.");
    });

    it("entra no rules agregado do useRForm", async () => {
        const { rules } = useRForm({
            pedido: {
                type: "text",
                rule: { name: "schema", schema: { type: "string", minLength: 3 } }
            }
        });

        const bad = await rules.safeParseAsync({ pedido: "ab" });
        expect(bad.success).toBe(false);
        expect(bad.error?.issues[0]?.path).toEqual(["pedido"]);

        expect((await rules.safeParseAsync({ pedido: "abc" })).success).toBe(true);
    });
});