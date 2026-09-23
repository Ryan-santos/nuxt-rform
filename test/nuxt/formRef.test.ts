import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";

import { RForm, RText } from "#components";

/**
 * O cenário da issue #8: um `ref` de template sobre o `RForm`. O `setRef` do pai
 * roda dentro do `patch()`, logo depois de o `mountComponent` ter retornado cedo
 * para registrar o dep no Suspense — e ali `instance.exposed` ainda é nulo, então
 * o `getComponentPublicInstance` cai no `instance.proxy`, de onde um
 * `<script setup>` nunca entrega binding nenhum. O Vue não refaz o `setRef` quando
 * o dep resolve, então o `ref` fica preso no proxy até o pai rerenderizar.
 */
type FormApi = {
    /** Vem do `publicPropertiesMap`, então os dois proxies possíveis o respondem. */
    $?: { asyncDep: unknown };
    model?: unknown;
    validate?: unknown;
    submit?: unknown;
    setErrors?: unknown;
    errors?: unknown;
};

const mountWithRef = async (props: Record<string, unknown> = {}) => {
    const form = ref<FormApi | null>(null);

    const Parent = defineComponent({
        setup: () => () =>
            h(RForm, { ...props, ref: form } as never, {
                default: () => h(RText, { name: "nome" })
            })
    });

    await mountSuspended(Parent, { attachTo: document.body });

    return { form };
};

describe("RForm, ref de template", () => {
    // A guarda estrutural: um `await` de volta no `Form.vue` traz o bug inteiro, e
    // traz calado — o `ref` fica no `instance.proxy` e só um rerender do pai o
    // conserta, que é o que fazia a issue parecer intermitente.
    it("não abre dependência de Suspense: é o await que quebrava o setRef", async () => {
        const { form } = await mountWithRef();

        expect(form.value?.$?.asyncDep).toBeNull();
    });

    // O campo também: com o `defaults` chegando pelo vite plugin, não há registry a
    // aguardar em lugar nenhum, e a árvore inteira monta de forma síncrona.
    it("nem o campo dentro dele abre", async () => {
        const field = ref<FormApi | null>(null);

        const Parent = defineComponent({
            setup: () => () =>
                h(RForm, null, {
                    default: () => h(RText, { name: "nome", ref: field } as never)
                })
        });

        await mountSuspended(Parent, { attachTo: document.body });

        expect(field.value?.$?.asyncDep).toBeNull();
    });

    it("entrega a API exposta sem o pai precisar rerenderizar", async () => {
        const { form } = await mountWithRef();

        expect(form.value).not.toBeNull();
        expect(typeof form.value?.submit).toBe("function");
        expect(typeof form.value?.validate).toBe("function");
        expect(typeof form.value?.setErrors).toBe("function");
    });

    it("expõe `model` e `errors` como refs legíveis", async () => {
        const { form } = await mountWithRef({ modelValue: { nome: "ana" } });

        // O `exposeProxy` passa por `proxyRefs`, então o ref chega desembrulhado.
        expect(form.value?.model).toEqual({ nome: "ana" });
        expect(form.value?.errors).toEqual({});
    });

    it("valida e escreve erro pelo ref, sem tag de campo no meio", async () => {
        const { form } = await mountWithRef();

        const setErrors = form.value?.setErrors as (input: Record<string, string>) => Promise<void>;

        await setErrors({ nome: "Nome já registrado" });

        expect(form.value?.errors).toEqual({ nome: "Nome já registrado" });
    });
});