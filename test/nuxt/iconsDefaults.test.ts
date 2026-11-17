import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it, vi } from "vitest";

import { RNumber, RSelect, RText } from "#components";

// O mock é do arquivo inteiro, então os casos sem defaults do app moram no
// `iconsProp.test.ts`.
vi.mock("#rform/defaults", () => ({
    default: {
        Number: { icons: { increment: "app:plus" } },
        Text: { icons: { Utils: { Error: { alert: "app:text-alert" } } } },
        Utils: {
            Loading: { icons: { loading: "app:spin" } },
            Error: { icons: { alert: "app:alert" } }
        }
    }
}));

type Wrapper = { findAll: (s: string) => { classes: () => string[] }[] };

// O `@nuxt/icon` renderiza `<span class="iconify i-<nome>">`, com o alias já resolvido.
const names = (wrapper: Wrapper) =>
    wrapper.findAll(".iconify").map((icon) =>
        icon
            .classes()
            .find((name) => name.startsWith("i-"))
            ?.slice(2)
    );

/** As três camadas: `defaults.icons` do componente < `defineFieldDefaults` < tag. */
describe("icons pelo defineFieldDefaults", () => {
    it("o app troca o padrão do campo", async () => {
        const wrapper = await mountSuspended(RNumber);

        expect(names(wrapper)).toEqual(["fa6-solid:minus", "app:plus"]);
    });

    it("Utils.<Nome>.icons vale para o util em todo campo", async () => {
        const wrapper = await mountSuspended(RNumber, { props: { error: "~~Erro" } });

        expect(names(wrapper)).toContain("app:alert");
    });

    it("o icons.Utils de um campo vence o Utils.<Nome> do app, e a tag vence os dois", async () => {
        const app = await mountSuspended(RText, { props: { error: "~~Erro" } });

        expect(names(app)).toEqual(["app:text-alert"]);

        const tag = await mountSuspended(RText, {
            props: { error: "~~Erro", icons: { Utils: { Error: { alert: "lucide:x" } } } }
        });

        expect(names(tag)).toEqual(["lucide:x"]);
    });

    it("a tag vence o app", async () => {
        const wrapper = await mountSuspended(RNumber, {
            props: { icons: { increment: "lucide:plus" } }
        });

        expect(names(wrapper)).toEqual(["fa6-solid:minus", "lucide:plus"]);
    });

    it("o padrão de um campo não apaga o Utils.<Nome>.icons do app", async () => {
        // O `RSelect` declara `loading` no próprio `defaults.icons`; o util dentro dele
        // ainda tem de mostrar o que o app escolheu para o `RUtilsLoading`.
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a"], loading: true } as never
        });

        expect(names(wrapper)).toContain("app:spin");
    });
});