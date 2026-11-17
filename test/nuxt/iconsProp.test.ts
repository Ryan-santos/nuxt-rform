import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";

import { RNumber, RSelect, RText } from "#components";
// Por caminho: a fixture substitui o `Switch` embutido.
import RSwitch from "#rform/builtin/fields/Switch.vue";

type Wrapper = { findAll: (s: string) => { classes: () => string[] }[] };

// O `@nuxt/icon` renderiza `<span class="iconify i-<nome>">`, com o alias já resolvido.
const names = (wrapper: Wrapper) =>
    wrapper.findAll(".iconify").map((icon) =>
        icon
            .classes()
            .find((name) => name.startsWith("i-"))
            ?.slice(2)
    );

/** A prop `icons`: o padrão vem do `defaults.icons`, e a tag troca por papel. */
describe("prop icons", () => {
    it("sem prop, cada papel usa o alias do módulo", async () => {
        const wrapper = await mountSuspended(RNumber);

        expect(names(wrapper)).toEqual(["fa6-solid:minus", "fa6-solid:plus"]);
    });

    it("a tag troca só o papel que escreveu", async () => {
        const wrapper = await mountSuspended(RNumber, {
            props: { icons: { increment: "lucide:plus" } }
        });

        expect(names(wrapper)).toEqual(["fa6-solid:minus", "lucide:plus"]);
    });

    it("o util lê o galho Utils.<Nome> do icons do campo, como o ui", async () => {
        const wrapper = await mountSuspended(RText, {
            props: {
                error: "~~Erro",
                icons: { Utils: { Error: { alert: "lucide:circle-alert" } } }
            }
        });

        expect(names(wrapper)).toContain("lucide:circle-alert");
    });

    it("alert vazio esconde o ícone do erro", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { error: "~~Erro", icons: { Utils: { Error: { alert: "" } } } }
        });

        expect(wrapper.find(".RUtilsError").exists()).toBe(true);
        expect(names(wrapper)).toEqual([]);
    });

    it("um papel do campo não desce ao util de mesmo nome", async () => {
        // `loading` é papel do `RSelect` e do `RUtilsLoading`; só o galho `Utils`
        // chega ao util.
        const own = await mountSuspended(RSelect, {
            props: { options: ["a"], loading: true, icons: { loading: "lucide:loader" } } as never
        });

        expect(own.get(".RUtilsLoading").classes()).toContain("i-eos-icons:loading");

        const util = await mountSuspended(RSelect, {
            props: {
                options: ["a"],
                loading: true,
                icons: { Utils: { Loading: { loading: "lucide:loader" } } }
            } as never
        });

        expect(util.get(".RUtilsLoading").classes()).toContain("i-lucide:loader");
    });

    it("um papel de util escrito plano no campo não chega ao util", async () => {
        const wrapper = await mountSuspended(RText, {
            props: { error: "~~Erro", icons: { alert: "lucide:circle-alert" } } as never
        });

        expect(names(wrapper)).not.toContain("lucide:circle-alert");
    });
});

describe("icons do RSwitch", () => {
    it("troca o ícone de cada estado", async () => {
        const off = await mountSuspended(RSwitch, {
            props: { modelValue: false, icons: { off: "lucide:x" } } as never
        });

        expect(names(off)).toEqual(["lucide:x"]);

        const on = await mountSuspended(RSwitch, {
            props: { modelValue: true, icons: { on: "lucide:check" } } as never
        });

        expect(names(on)).toEqual(["lucide:check"]);
    });

    it('"" nos três estados desliga o indicador', async () => {
        const wrapper = await mountSuspended(RSwitch, {
            props: { modelValue: true, icons: { on: "", off: "", loading: "" } } as never
        });

        expect(names(wrapper)).toEqual([]);
    });

    it("a prop icon deixou de existir", () => {
        // A porta é uma só: `icons`.
        expect(Object.keys(RSwitch.props ?? {})).not.toContain("icon");
    });
});