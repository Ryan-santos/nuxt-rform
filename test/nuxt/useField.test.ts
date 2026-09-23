import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";
import { defineComponent, h, provide, ref } from "vue";

import type { Element } from "#rform/types";

// Como o vite plugin o entregaria: estas montagens chamam a composable direto.
import { defaults as textDefaults } from "../../src/runtime/components/fields/Text.vue";
import useField, { key } from "../../src/runtime/composables/useField";

const Harness = defineComponent({
    props: {
        sourceProps: { type: Object, required: true },
        modelValue: { type: null, default: undefined }
    },
    setup(props) {
        const ctx = useField(props.sourceProps as Element, undefined, {
            name: "Text",
            defaults: textDefaults
        });
        return () =>
            h(
                "pre",
                { "data-testid": "merged" },
                JSON.stringify({
                    id: ctx.id,
                    modelValue: ctx.props.value.modelValue,
                    defaultValue: ctx.props.value.default,
                    name: ctx.props.value.name
                })
            );
    }
});

describe("useField", () => {
    it("carrega os defaults do componente e mescla sobre as props de origem", async () => {
        const wrapper = await mountSuspended(Harness, {
            props: { sourceProps: { name: "field-a" } }
        });

        const payload = JSON.parse(wrapper.get('[data-testid="merged"]').text());
        expect(payload.defaultValue).toBe("");
        expect(payload.name).toBe("field-a");
    });

    it("devolve id nulo sem pai e sem name", async () => {
        const wrapper = await mountSuspended(Harness, {
            props: { sourceProps: {} }
        });

        const payload = JSON.parse(wrapper.get('[data-testid="merged"]').text());
        expect(payload.id).toBeNull();
    });

    it("sincroniza o model do filho no do pai quando há name", async () => {
        const parentModel = ref<Record<string, unknown>>({ child: "from-parent" });

        const Child = defineComponent({
            props: {
                modelValue: { type: null, default: undefined }
            },
            setup() {
                const ctx = useField({ name: "child", modelValue: undefined } as never, undefined, {
                    name: "Text",
                    defaults: textDefaults
                });
                return () => h("p", { "data-testid": "current" }, String(ctx.model.value));
            }
        });

        const Wrapper = defineComponent({
            setup() {
                provide(key, { id: "root", model: parentModel as never });
                return () => h(Child);
            }
        });

        const wrapper = await mountSuspended(Wrapper);
        expect(wrapper.get('[data-testid="current"]').text()).toBe("from-parent");
    });
});