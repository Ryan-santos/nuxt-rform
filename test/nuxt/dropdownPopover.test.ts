import { mountSuspended } from "@nuxt/test-utils/runtime";
// @vitest-environment nuxt
import { describe, expect, it } from "vitest";

import { RColor, RDate, RSelect } from "#components";

/**
 * Toda aparência de painel mora em `ui.Utils.Dropdown.popover`, e o endereço único é
 * o ponto: um `class` cravado no template do campo não passaria pelo `twMerge`, e o
 * painel abriria com a largura errada, calado. Ver "O painel é do Dropdown" no
 * `.claude/CLAUDE.md`.
 */
const popover = (wrapper: { find: (s: string) => { classes: () => string[] } }) =>
    wrapper.find(".RUtilsDropdown").classes();

/** O `min()` entre o que o `dropdownFit` mediu e o teto que o `ui` declara. */
const FIT = "max-h-[min(var(--available-height),var(--max-height,100vh))]";

describe("painel do dropdown", () => {
    it("põe z-999 em todo painel, pelos defaults do próprio Dropdown", async () => {
        for (const [component, props] of [
            [RSelect, { options: ["a"] }],
            [RDate, {}],
            [RColor, {}]
        ] as const) {
            const wrapper = await mountSuspended(component, { props: props as never });

            expect(popover(wrapper)).toContain("z-999");
        }
    });

    it("lê a largura medida onde o campo mede uma", async () => {
        const wrapper = await mountSuspended(RSelect, { props: { options: ["a"] } as never });

        expect(popover(wrapper)).toContain("w-(--width)");
    });

    it("troca w-(--width) pela largura fixa de um campo que não mede nada", async () => {
        for (const [component, width] of [
            [RDate, "w-72"],
            [RColor, "w-64"]
        ] as const) {
            const wrapper = await mountSuspended(component, { props: {} as never });
            const classes = popover(wrapper);

            expect(classes).toContain(width);
            expect(classes).not.toContain("w-(--width)");
        }
    });

    it("troca w-(--width) quando o ui escreve outra largura", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: {
                options: ["a"],
                ui: { Utils: { Dropdown: { popover: "w-80" } } }
            } as never
        });

        const classes = popover(wrapper);

        expect(classes).toContain("w-80");
        expect(classes).not.toContain("w-(--width)");
        // O resto da aparência do painel sobrevive ao override de largura.
        expect(classes).toContain("overflow-hidden");
        expect(classes).toContain("z-999");
    });

    it("compõe a altura livre com o teto em todo painel, pelos defaults do Dropdown", async () => {
        for (const [component, props] of [
            [RSelect, { options: ["a"] }],
            [RDate, {}],
            [RColor, {}]
        ] as const) {
            const wrapper = await mountSuspended(component, { props: props as never });

            expect(popover(wrapper)).toContain(FIT);
        }
    });

    it("declara o teto de 25rem só no Select, que é quem tem lista para crescer", async () => {
        const select = await mountSuspended(RSelect, { props: { options: ["a"] } as never });

        expect(popover(select)).toContain("[--max-height:25rem]");

        for (const component of [RDate, RColor]) {
            const wrapper = await mountSuspended(component, { props: {} as never });

            expect(popover(wrapper).some((c) => c.startsWith("[--max-height:"))).toBe(false);
        }
    });

    it("troca o teto quando o ui escreve outro, sem tocar no min()", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: {
                options: ["a"],
                ui: { Utils: { Dropdown: { popover: "[--max-height:30rem]" } } }
            } as never
        });

        const classes = popover(wrapper);

        expect(classes).toContain("[--max-height:30rem]");
        // A mesma arbitrary property substitui, não acumula.
        expect(classes).not.toContain("[--max-height:25rem]");
        expect(classes).toContain(FIT);
        expect(classes).toContain("overflow-hidden");
    });

    // O painel continua dono da **aparência** (endereço único
    // `ui.Utils.Dropdown.popover`); o que ele deixou de ser é dono do **scroll** —
    // quem rola é o `[role=listbox]` do Select, que é o que o observer de
    // paginação precisa poder usar de `root`.
    it("o painel do Select não rola: quem rola é a lista", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a", "b"] } as never
        });

        await wrapper.get('[aria-haspopup="listbox"]').trigger("click");

        const classes = popover(wrapper);

        expect(classes).toContain("overflow-hidden");
        expect(classes).toContain("flex");
        expect(classes).toContain("flex-col");

        const scroller = wrapper.get('[role="listbox"]');

        expect(scroller.classes()).toContain("overflow-auto");
        expect(scroller.classes()).toContain("overscroll-contain");
    });
});
describe("onde o painel mora", () => {
    // O stub de Teleport da suíte (test/nuxt/setup.ts) é desligado aqui de propósito:
    // este é o único caso que precisa ver o painel no lugar em que ele de fato pousa.
    it("teleporta o painel para #teleports, fora do .RField", async () => {
        const wrapper = await mountSuspended(RSelect, {
            props: { options: ["a"] } as never,
            global: { stubs: { teleport: false } }
        });

        const panels = document.querySelectorAll("#teleports .RUtilsDropdown");

        expect(panels).toHaveLength(1);
        expect(panels[0]!.closest(".RField")).toBeNull();
        expect(wrapper.find(".RUtilsDropdown").exists()).toBe(false);

        wrapper.unmount();
    });
});