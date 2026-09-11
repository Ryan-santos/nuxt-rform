import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { beforeAll, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";

import { RDynamic, RForm, RText } from "#components";
import type { Schema } from "#rform/types/schema";

import useRForm from "../../src/runtime/composables/useRForm";

// `scrollIntoView` não existe no happy-dom, e o `focusFirstError` chama um por
// submissão inválida.
beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

type Obj = Record<string, unknown>;

type Scope = {
    validate: () => Promise<boolean>;
    submit: () => Promise<Record<string, string> | undefined>;
};

const flush = async () => {
    await nextTick();
    await new Promise((r) => setTimeout(r));
    await nextTick();
};

/** O modo em que as condições valem: quem monta os campos é o `RDynamic`. */
const schema = async (source: Schema) => {
    const form = useRForm(source);
    const model = form.data as Ref<Obj>;
    let scope: Scope | undefined;

    const Host = defineComponent({
        setup: () => () =>
            h(
                RForm,
                {
                    schema: form.schema,
                    rules: form.rules,
                    modelValue: model.value,
                    "onUpdate:modelValue": (v: Obj) => {
                        model.value = v;
                    }
                } as never,
                {
                    default: (received: Obj) => {
                        scope = received as unknown as Scope;
                        return undefined;
                    }
                }
            )
    });

    const wrapper = await mountSuspended(Host, { attachTo: document.body });
    await flush();

    return { wrapper, model, scope: scope! };
};

/** Modo template: o Form escreve os filhos que o cenário desenhar. */
const template = async (initial: Obj, children: () => unknown) => {
    const model = ref<Obj>(initial);

    const Host = defineComponent({
        setup: () => () =>
            h(
                RForm,
                {
                    modelValue: model.value,
                    "onUpdate:modelValue": (v: Obj) => {
                        model.value = v;
                    }
                } as never,
                { default: () => children() }
            )
    });

    const wrapper = await mountSuspended(Host, { attachTo: document.body });
    await flush();

    return { wrapper, model };
};

const VISIBLE_WHEN = { field: "tipo", op: "in", value: ["json", "form"] } as const;

const source = {
    tipo: { type: "text", default: "json" },
    body: { type: "textarea", default: "", rule: "required", visibleWhen: VISIBLE_WHEN }
} as unknown as Schema;

describe("visibleWhen", () => {
    it("some quando a condição deixa de casar, e volta quando volta a casar", async () => {
        const { wrapper, model } = await schema(source);

        expect(wrapper.find("textarea").exists()).toBe(true);

        model.value.tipo = "none";
        await flush();

        expect(wrapper.find("textarea").exists()).toBe(false);

        model.value.tipo = "form";
        await flush();

        expect(wrapper.find("textarea").exists()).toBe(true);
    });

    it("mantém o valor no model enquanto escondido, e o devolve na tela", async () => {
        const { wrapper, model } = await schema(source);

        await wrapper.find("textarea").setValue("corpo digitado");
        await flush();
        expect(model.value.body).toBe("corpo digitado");

        model.value.tipo = "none";
        await flush();

        expect(wrapper.find("textarea").exists()).toBe(false);
        expect(model.value.body).toBe("corpo digitado");

        model.value.tipo = "json";
        await flush();

        expect(wrapper.find("textarea").element.value).toBe("corpo digitado");
    });

    it("sai das duas fontes: a rule do campo e o `:rules` agregado", async () => {
        const { model, scope } = await schema(source);

        expect(await scope.validate()).toBe(false);

        model.value.tipo = "none";
        await flush();

        expect(await scope.validate()).toBe(true);
        expect(await scope.submit()).toBeUndefined();
    });

    // O caso em que o casamento por prefixo é o que trabalha: o campo desmontou e
    // levou a própria rule junto, mas o `:rules` agregado continua validando o model
    // inteiro e produz um issue em `endereco.cep`.
    it("um objeto escondido derruba o issue agregado do filho, pelo prefixo", async () => {
        const { model, scope } = await schema({
            tipo: { type: "text", default: "json" },
            endereco: {
                type: "object",
                visibleWhen: { field: "tipo", op: "===", value: "json" },
                children: { cep: { type: "text", default: "", rule: "required" } }
            }
        } as unknown as Schema);

        expect(await scope.validate()).toBe(false);

        model.value.tipo = "none";
        await flush();

        expect(await scope.validate()).toBe(true);
    });

    it("array é AND, `or` basta um, e a função recebe o form", async () => {
        const { wrapper, model } = await schema({
            tipo: { type: "text", default: "json" },
            idade: { type: "number", default: 20 },
            ambos: {
                type: "text",
                visibleWhen: [
                    { field: "tipo", op: "===", value: "json" },
                    { field: "idade", op: ">=", value: 18 }
                ]
            },
            qualquer: {
                type: "text",
                visibleWhen: { or: [{ field: "tipo", op: "===", value: "none" }] }
            },
            fn: {
                type: "text",
                visibleWhen: ({ form }: { form: unknown }) => (form as Obj).tipo === "json"
            }
        } as unknown as Schema);

        const names = () =>
            wrapper
                .findAll("input")
                .map((el) => el.attributes("name"))
                .filter((name) => name !== "idade");

        expect(names()).toEqual(["tipo", "ambos", "fn"]);

        model.value.tipo = "none";
        await flush();

        expect(names()).toEqual(["tipo", "qualquer"]);
    });

    it("vale num campo de dois genéricos como o RSelect", async () => {
        const { wrapper, model } = await schema({
            tipo: { type: "text", default: "json" },
            uf: {
                type: "select",
                options: ["SP", "BA"],
                visibleWhen: { field: "tipo", op: "===", value: "json" }
            }
        } as unknown as Schema);

        expect(wrapper.find(".RSelect").exists()).toBe(true);

        model.value.tipo = "none";
        await flush();

        expect(wrapper.find(".RSelect").exists()).toBe(false);
    });
});

describe("disabledWhen", () => {
    const alvo = (tipo: string, extra: Obj = {}) =>
        schema({
            tipo: { type: "text", default: tipo },
            alvo: {
                type: "text",
                default: "",
                disabledWhen: { field: "tipo", op: "===", value: "json" },
                ...extra
            }
        } as unknown as Schema);

    it("desabilita o controle nativo e pinta o container", async () => {
        const { wrapper, model } = await alvo("json");

        const input = () => wrapper.findAll("input")[1]!;

        expect(input().attributes("disabled")).toBeDefined();
        expect(input().element.closest(".RText")?.className).toContain("pointer-events-none");

        model.value.tipo = "none";
        await flush();

        expect(input().attributes("disabled")).toBeUndefined();
    });

    it("o `disabled` escrito no schema vence a condição, nos dois sentidos", async () => {
        const off = await alvo("json", { disabled: false });
        expect(off.wrapper.findAll("input")[1]!.attributes("disabled")).toBeUndefined();

        const on = await alvo("none", { disabled: true });
        expect(on.wrapper.findAll("input")[1]!.attributes("disabled")).toBeDefined();
    });

    it("campo desabilitado continua sendo validado — o valor está no model", async () => {
        const { scope } = await alvo("json", { rule: "required" });

        expect(await scope.validate()).toBe(false);
    });

    it("`disabled` continua sendo prop de campo numa tag escrita à mão", async () => {
        const { wrapper } = await template({}, () => [
            h(RText, { name: "alvo", disabled: true } as never)
        ]);

        expect(wrapper.find("input").attributes("disabled")).toBeDefined();
    });
});

describe("schema sem RForm em volta", () => {
    it("renderiza, ignora a condição e avisa nomeando a prop", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const wrapper = await mountSuspended(RDynamic, {
            props: {
                name: "solto",
                schema: { type: "text", visibleWhen: { field: "x", op: "===", value: 1 } }
            } as never
        });

        expect(wrapper.find("input").exists()).toBe(true);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("visibleWhen"));

        warn.mockRestore();
    });
});

describe("snake_case no schema", () => {
    it("`visible_when` esconde igual ao `visibleWhen`", async () => {
        const { wrapper, model } = await schema({
            tipo: { type: "text", default: "json" },
            body: { type: "textarea", default: "", visible_when: VISIBLE_WHEN }
        } as unknown as Schema);

        expect(wrapper.find("textarea").exists()).toBe(true);

        model.value.tipo = "none";
        await flush();

        expect(wrapper.find("textarea").exists()).toBe(false);
    });

    it("`disabled_when` desabilita igual ao `disabledWhen`", async () => {
        const { wrapper } = await schema({
            tipo: { type: "text", default: "json" },
            alvo: {
                type: "text",
                default: "",
                disabled_when: { field: "tipo", op: "===", value: "json" }
            }
        } as unknown as Schema);

        expect(wrapper.findAll("input")[1]!.attributes("disabled")).toBeDefined();
    });

    it("escrever as duas no mesmo campo faz a camelCase vencer", async () => {
        const { wrapper } = await schema({
            tipo: { type: "text", default: "json" },
            body: {
                type: "textarea",
                default: "",
                // A camelCase diz "mostra"; a snake_case diria "esconde".
                visibleWhen: { field: "tipo", op: "===", value: "json" },
                visible_when: { field: "tipo", op: "===", value: "none" }
            }
        } as unknown as Schema);

        expect(wrapper.find("textarea").exists()).toBe(true);
    });

    it("nenhuma das quatro grafias sobra no HTML — a prova do `delete`", async () => {
        const { wrapper } = await schema({
            tipo: { type: "text", default: "json" },
            body: { type: "textarea", default: "", visible_when: VISIBLE_WHEN },
            alvo: {
                type: "text",
                default: "",
                disabledWhen: { field: "tipo", op: "===", value: "json" }
            }
        } as unknown as Schema);

        const html = wrapper.html();

        for (const key of ["visible_when", "visiblewhen", "disabled_when", "disabledwhen"]) {
            expect(html).not.toContain(key);
        }
    });

    it("`model_full` num RSelect funciona de graça", async () => {
        const { wrapper } = await schema({
            uf: {
                type: "select",
                default: { id: 2, name: "Bahia" },
                options: [
                    { id: 1, name: "Acre" },
                    { id: 2, name: "Bahia" }
                ],
                model_full: true
            }
        } as unknown as Schema);

        expect(wrapper.text()).toContain("Bahia");
        expect(wrapper.html()).not.toContain("model_full");
    });

    it("uma chave inventada segue intacta como atributo de fallthrough", async () => {
        const { wrapper } = await schema({
            body: { type: "textarea", default: "", foo_bar: "cru" }
        } as unknown as Schema);

        // `fooBar` não é prop do campo, então nada é renomeado calado.
        expect(wrapper.html()).toContain(`foo_bar="cru"`);
    });
});

describe("modo template não conhece as condições", () => {
    it("as duas viram atributo solto: quem escreve markup usa `v-if`", async () => {
        const { wrapper } = await template({ tipo: "json" }, () => [
            h(RText, { name: "tipo" } as never),
            h(RText, {
                name: "alvo",
                visibleWhen: { field: "tipo", op: "===", value: "none" },
                disabledWhen: { field: "tipo", op: "===", value: "json" }
            } as never)
        ]);

        // Renderiza apesar do `visibleWhen`, e não desabilita apesar do `disabledWhen`.
        expect(wrapper.findAll("input")).toHaveLength(2);
        expect(wrapper.findAll("input")[1]!.attributes("disabled")).toBeUndefined();
    });
});