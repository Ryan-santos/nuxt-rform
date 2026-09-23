import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, provide, ref } from "vue";

import { RArray } from "#components";

// O `defaults` de cada um, como o vite plugin o entregaria: estas montagens chamam a
// composable direto, então o plugin nunca passa por elas.
import { defaults as numberDefaults } from "../../src/runtime/components/fields/Number.vue";
import { defaults as textDefaults } from "../../src/runtime/components/fields/Text.vue";
import { defaults as placeholderDefaults } from "../../src/runtime/components/utils/Placeholder.vue";
import useField, { keyProp } from "../../src/runtime/composables/useField";
import useUtil from "../../src/runtime/composables/useUtil";

vi.mock("#rform/defaults", () => ({
    default: {
        Array: {
            text: {
                button: "meu.add"
            }
        },
        Text: {
            default: "from-user-defaults",
            ui: {
                container: "user-container"
            }
        },
        Utils: {
            Placeholder: {
                ui: {
                    default: "user-placeholder"
                }
            }
        }
    }
}));

type Rendered = {
    default?: unknown;
    ui?: { container?: string };
};

const render = (props: Rendered) =>
    h(
        "pre",
        { "data-testid": "field" },
        JSON.stringify({
            default: props.default,
            container: props.ui?.container
        })
    );

const sourceProps = { type: Object, required: true } as const;

const TextField = defineComponent({
    props: { sourceProps },
    setup(props) {
        const ctx = useField(props.sourceProps as never, undefined, {
            name: "Text",
            defaults: textDefaults
        });
        return () => render(ctx.props.value as Rendered);
    }
});

const NumberField = defineComponent({
    props: { sourceProps },
    setup(props) {
        const ctx = useField(props.sourceProps as never, undefined, {
            name: "Number",
            defaults: numberDefaults
        });
        return () => render(ctx.props.value as Rendered);
    }
});

const read = (wrapper: { get: (selector: string) => { text: () => string } }, testId: string) =>
    JSON.parse(wrapper.get(`[data-testid="${testId}"]`).text());

describe("defaults do usuário (app/rform/defaults.ts)", () => {
    it("sobrescrevem o defaults do próprio componente", async () => {
        const wrapper = await mountSuspended(TextField, {
            props: { sourceProps: {} }
        });

        const payload = read(wrapper, "field");

        expect(payload.default).toBe("from-user-defaults");
        expect(payload.container).toContain("user-container");
    });

    it("perdem para as props passadas no call site", async () => {
        const wrapper = await mountSuspended(TextField, {
            props: { sourceProps: { default: "from-call-site" } }
        });

        expect(read(wrapper, "field").default).toBe("from-call-site");
    });

    it("pega um texto dos defaults do usuário cru, sem prefixo", async () => {
        const wrapper = await mountSuspended(RArray, {
            props: { name: "itens", modelValue: [] } as never
        });

        // O prefixo só vale para o que o próprio componente declarou em
        // `defaults.text`; o que o app escreve é chave do app.
        expect(wrapper.text()).toContain("meu.add");
        expect(wrapper.text()).not.toContain("rform.fields.array.add");
    });

    it("só alcançam o componente sob o qual estão chaveados", async () => {
        const wrapper = await mountSuspended(NumberField, {
            props: { sourceProps: {} }
        });

        const payload = read(wrapper, "field");

        expect(payload.default).not.toBe("from-user-defaults");
        expect(payload.container).not.toContain("user-container");
    });
});

const Util = defineComponent({
    setup() {
        const { props } = useUtil({ name: "Placeholder", defaults: placeholderDefaults });

        return () =>
            h(
                "pre",
                { "data-testid": "util" },
                JSON.stringify({
                    placeholder: props.value.placeholder,
                    ui: props.value.ui
                })
            );
    }
});

const UtilParent = defineComponent({
    setup() {
        provide(keyProp, {
            id: null,
            props: computed(() => ({ placeholder: "from-parent" })) as never,
            model: ref("") as never
        });

        return () => h(Util);
    }
});

describe("defaults do usuário para Utils", () => {
    it("sobrescrevem o defaults do próprio util, sob a chave Utils", async () => {
        const wrapper = await mountSuspended(UtilParent);
        const payload = read(wrapper, "util");

        expect(payload.ui.default).toContain("user-placeholder");
        expect(payload.placeholder).toBe("from-parent");
    });
});