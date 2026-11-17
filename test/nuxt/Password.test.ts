import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { beforeAll, describe, expect, it, vi } from "vitest";
import { h, nextTick, ref } from "vue";

import { RForm, RPassword, RText } from "#components";

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

const CHECKLIST = [
    { label: "~~Oito caracteres", rule: { name: "min", min: 8 } },
    { label: "~~Uma maiúscula", rule: { name: "regex", pattern: "[A-Z]" } },
    { label: "~~Um número", rule: { name: "regex", pattern: "[0-9]" } }
];

// Avaliação é async (o chunk das rules); espera a lista assentar.
const settle = async () => {
    await vi.dynamicImportSettled();
    for (let i = 0; i < 4; i++) {
        await nextTick();
    }
};

const states = (wrapper: { findAll: (s: string) => { attributes: (n: string) => unknown }[] }) =>
    wrapper.findAll("li").map((item) => item.attributes("data-state"));

type Scope = { validate: () => Promise<boolean>; submit: () => Promise<unknown> };

const mountInForm = async (field: Record<string, unknown>, initial: Record<string, unknown>) => {
    let scope: Scope | undefined;
    const data = ref(initial);

    const wrapper = await mountSuspended(RForm, {
        attachTo: document.body,
        props: {
            modelValue: data.value,
            "onUpdate:modelValue": (value: Record<string, unknown>) => {
                data.value = value;
            }
        } as never,
        slots: {
            default: (received: Record<string, unknown>) => {
                scope = received as unknown as Scope;
                return h(RPassword, { name: "senha", ...field } as never);
            }
        }
    });

    return { wrapper, scope: scope!, data };
};

describe("RPassword, visibilidade", () => {
    it("alterna entre password e text", async () => {
        const wrapper = await mountSuspended(RPassword, { props: {} as never });

        expect(wrapper.find("input").attributes("type")).toBe("password");

        await wrapper.get('[data-action="toggle"]').trigger("click");
        expect(wrapper.find("input").attributes("type")).toBe("text");
        expect(wrapper.get('[data-action="toggle"]').attributes("aria-label")).toBe(
            "Ocultar senha"
        );
    });
});

describe("RPassword, checklist", () => {
    it("começa neutra com o campo vazio", async () => {
        const wrapper = await mountSuspended(RPassword, {
            props: { checklist: CHECKLIST } as never
        });
        await settle();

        expect(states(wrapper)).toEqual(["idle", "idle", "idle"]);
        expect(wrapper.text()).toContain("Oito caracteres");
        expect(
            wrapper
                .findAll("li .iconify")
                .map((icon) => icon.classes().includes("i-fa6-regular:clock"))
        ).toEqual([true, true, true]);
    });

    // O mapa de estado já guarda o nome prefixado; prefixar de novo dava
    // `rform:rform:check`, que o `@nuxt/icon` não acha.
    it("dá a cada item um alias do módulo, prefixado uma vez só", async () => {
        const wrapper = await mountSuspended(RPassword, {
            props: { checklist: CHECKLIST, modelValue: "Abcdefgh" } as never
        });
        await settle();

        // O `@nuxt/icon` renderiza `<span class="iconify i-<nome>">`, já com o alias
        // resolvido; um nome que não casa sai cru, como `i-rform:rform:check`.
        const names = wrapper
            .findAll("li .iconify")
            .map((icon) => icon.classes().find((name) => name.startsWith("i-")));

        expect(names).toEqual(["i-fa6-solid:check", "i-fa6-solid:check", "i-fa6-regular:clock"]);
    });

    it("marca e desmarca enquanto se digita", async () => {
        const wrapper = await mountSuspended(RPassword, {
            props: { checklist: CHECKLIST, modelValue: "abc" } as never
        });
        await settle();

        expect(states(wrapper)).toEqual(["pending", "pending", "pending"]);

        await wrapper.setProps({ modelValue: "Abcdefgh1" } as never);
        await settle();
        expect(states(wrapper)).toEqual(["met", "met", "met"]);

        await wrapper.setProps({ modelValue: "Abcdefgh" } as never);
        await settle();
        expect(states(wrapper)).toEqual(["met", "met", "pending"]);
    });

    it("reprova o validate e marca o que falta como erro, sem o RUtilsError", async () => {
        const { wrapper, scope } = await mountInForm({ checklist: CHECKLIST }, { senha: "abc" });
        await settle();

        expect(await scope.validate()).toBe(false);
        await settle();

        expect(states(wrapper)).toEqual(["failed", "failed", "failed"]);
        expect(wrapper.find(".RUtilsError").exists()).toBe(false);
    });

    it("passa no validate com todos os requisitos", async () => {
        const { scope } = await mountInForm({ checklist: CHECKLIST }, { senha: "Abcdefgh1" });
        await settle();

        expect(await scope.validate()).toBe(true);
    });

    it("deixa o vazio para o required, que continua mostrando o próprio erro", async () => {
        const { wrapper, scope } = await mountInForm(
            { checklist: CHECKLIST, rule: "required" },
            { senha: "" }
        );
        await settle();

        expect(await scope.validate()).toBe(false);
        await settle();

        expect(wrapper.find(".RUtilsError").text()).toContain("Campo obrigatório.");
        expect(states(wrapper)).toEqual(["idle", "idle", "idle"]);
    });
});

describe("RPassword, correções da revisão", () => {
    it("o focusError acha a senha reprovada só pela lista", async () => {
        let scope: Scope | undefined;

        const wrapper = await mountSuspended(RForm, {
            attachTo: document.body,
            props: { modelValue: { senha: "abc", depois: "" } } as never,
            slots: {
                default: (received: Record<string, unknown>) => {
                    scope = received as unknown as Scope;
                    return [
                        h(RPassword, { name: "senha", checklist: CHECKLIST } as never),
                        h(RText, { name: "depois", rule: "required" } as never)
                    ];
                }
            }
        });
        await settle();

        await scope!.submit();
        await settle();

        expect(document.activeElement).toBe(wrapper.find("input[type=password]").element);

        wrapper.unmount();
    });

    it("uma validação velha não sobrescreve a lista do valor novo", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        // Segura só a avaliação de "abc": a do valor novo volta antes.
        const slow = async ({ value }: { value: unknown }) => {
            if (value === "abc") {
                await gate;
            }
            return String(value).length >= 8 ? undefined : "curta";
        };

        const { wrapper, scope, data } = await mountInForm(
            { checklist: [{ label: "~~Oito", rule: slow }] },
            { senha: "abc" }
        );

        const validating = scope.validate();
        await settle();

        data.value.senha = "abcdefghij";
        await settle();

        release();
        await validating;
        await settle();

        expect(states(wrapper)).toEqual(["met"]);
    });

    it("a lista roda antes da rule do call site, e o que falta vira erro", async () => {
        const { wrapper, scope } = await mountInForm(
            { checklist: CHECKLIST, rule: { name: "min", min: 12 } },
            { senha: "abc" }
        );
        await settle();

        expect(await scope.validate()).toBe(false);
        await settle();

        expect(states(wrapper)).toEqual(["failed", "failed", "failed"]);
    });
});

describe("RPassword, força", () => {
    it("mede a fração de requisitos atendidos", async () => {
        const wrapper = await mountSuspended(RPassword, {
            props: { checklist: CHECKLIST, strength: true, modelValue: "abc" } as never
        });
        await settle();

        expect(wrapper.find("[data-level]").attributes("data-level")).toBe("weak");

        await wrapper.setProps({ modelValue: "Abc1" } as never);
        await settle();
        expect(wrapper.find("[data-level]").attributes("data-level")).toBe("medium");

        await wrapper.setProps({ modelValue: "Abcdefgh1" } as never);
        await settle();
        expect(wrapper.find("[data-level]").attributes("data-level")).toBe("strong");
        expect(wrapper.text()).toContain("Forte");
    });

    // Sem legenda a caixa teria só os 4px da barra, colada no input, e a lista
    // pularia quando a legenda aparecesse.
    it("reserva a linha da legenda com o campo vazio", async () => {
        const wrapper = await mountSuspended(RPassword, {
            props: { checklist: CHECKLIST, strength: true } as never
        });
        await settle();

        const container = wrapper.get(".h-1").element.parentElement?.parentElement;

        expect(container?.hasAttribute("data-level")).toBe(false);
        expect(container?.classList.contains("min-h-5")).toBe(true);
    });

    it("sem checklist avisa e não renderiza", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const wrapper = await mountSuspended(RPassword, { props: { strength: true } as never });

        expect(wrapper.find("[data-level]").exists()).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("[rform]"));

        warn.mockRestore();
    });
});

describe("RPassword, gerador", () => {
    it("só mostra o botão com generate ou @generate", async () => {
        const without = await mountSuspended(RPassword, { props: {} as never });
        expect(without.find('[data-action="generate"]').exists()).toBe(false);

        const listening = await mountSuspended(RPassword, {
            props: { onGenerate: () => {} } as never
        });
        expect(listening.find('[data-action="generate"]').exists()).toBe(true);
    });

    it("gera uma senha que cumpre a lista, mostra e avisa", async () => {
        const onGenerate = vi.fn();

        const wrapper = await mountSuspended(RPassword, {
            props: { checklist: CHECKLIST, generate: { length: 12 }, onGenerate } as never
        });

        await wrapper.get('[data-action="generate"]').trigger("click");
        await settle();

        const password = onGenerate.mock.calls[0]?.[0] as string;

        expect(password).toHaveLength(12);
        expect(wrapper.emitted("update:modelValue")?.at(-1)?.[0]).toBe(password);
        expect(wrapper.find("input").attributes("type")).toBe("text");
    });

    it("avisa quando nenhuma senha gerada cumpre a lista", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const wrapper = await mountSuspended(RPassword, {
            props: {
                checklist: [
                    { label: "~~Só dígitos", rule: { name: "regex", pattern: "^[0-9]+$" } }
                ],
                generate: true
            } as never
        });

        await wrapper.get('[data-action="generate"]').trigger("click");
        await settle();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("generate.symbols"));

        warn.mockRestore();
    });
});