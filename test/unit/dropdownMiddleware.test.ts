import { computePosition, type Middleware } from "@floating-ui/vue";
import { beforeEach, describe, expect, it } from "vitest";

import dropdownMiddleware, { dropdownFit } from "../../src/runtime/utils/dropdownMiddleware";

/**
 * O `size()` e o `flip()` disputam o mesmo elemento e o `size()` ganha — ver
 * "`size()` do floating-ui sempre ganha do `flip()`" no `.claude/CLAUDE.md`.
 *
 * O laço inteiro mora no layout do DOM, que nenhum ambiente de teste daqui tem,
 * então estes rodam o `computePosition` de verdade sobre uma plataforma sintética:
 * viewport fixa como clipping rect, e altura do painel limitada pela
 * `--available-height` que o `apply` escreveu.
 */

/** Mutável: um caso precisa dos dois lados do campo apertados. */
const VIEWPORT = { x: 0, y: 0, width: 1000, height: 800 };

/**
 * `--width` e `--available-height` só chegam no CSS por `setProperty`, então a
 * declaração sintética precisa da mesma porta — e as medidas renderizadas saem
 * dela, como no browser, onde quem lê as variáveis é o `popover` do `ui`.
 */
type Style = Record<string, string> & {
    setProperty: (name: string, value: string) => void;
};

type Panel = {
    natural: { width: number; height: number };
    style: Style;
};

const declaration = (): Style => {
    const style = {
        setProperty(name: string, value: string) {
            style[name] = value;
        }
    } as Style;

    return style;
};

const parse = (value: string | undefined) => {
    return value ? Number.parseFloat(value) : Number.POSITIVE_INFINITY;
};

const platform = {
    getElementRects: async ({
        reference,
        floating
    }: {
        reference: unknown;
        floating: unknown;
    }) => ({
        reference: reference as { x: number; y: number; width: number; height: number },
        floating: { x: 0, y: 0, ...(await platform.getDimensions(floating as Panel)) }
    }),
    getDimensions: async (panel: Panel) => ({
        width: Math.min(panel.natural.width, parse(panel.style["--width"])),
        height: Math.min(panel.natural.height, parse(panel.style["--available-height"]))
    }),
    getClippingRect: async () => VIEWPORT,
    getOffsetParent: async () => null,
    getDocumentElement: async () => null,
    convertOffsetParentRelativeRectToViewportRelativeRect: async ({
        rect
    }: {
        rect: { x: number; y: number; width: number; height: number };
    }) => rect,
    isElement: async () => true,
    isRTL: async () => false,
    getScale: async () => ({ x: 1, y: 1 })
};

const field = (top: number) => ({ x: 100, y: top, width: 300, height: 50 });

const panel = (height: number): Panel => ({
    natural: { width: 300, height },
    style: declaration()
});

const place = (reference: ReturnType<typeof field>, floating: Panel, middleware: Middleware[]) => {
    return computePosition(reference as never, floating as never, {
        placement: "bottom-start",
        strategy: "fixed",
        middleware,
        platform: platform as never
    });
};

/** Abrir é a segunda computação: a primeira rodou com o painel escondido. */
const open = async (
    reference: ReturnType<typeof field>,
    content: number,
    fit: Middleware = dropdownFit()
) => {
    const floating = panel(0);
    const middleware = dropdownMiddleware({ middleware: [fit] });

    await place(reference, floating, middleware);
    floating.natural.height = content;

    const { placement, y } = await place(reference, floating, middleware);

    return {
        placement,
        y,
        available: parse(floating.style["--available-height"]),
        style: floating.style
    };
};

describe("dropdownMiddleware", () => {
    beforeEach(() => {
        VIEWPORT.height = 800;
    });

    it("mantém o painel abaixo do campo quando o espaço de baixo cabe", async () => {
        const { placement } = await open(field(100), 600);

        expect(placement).toBe("bottom-start");
    });

    it("vira o painel para cima num campo no fim da viewport", async () => {
        const { placement } = await open(field(700), 600);

        expect(placement).toBe("top-start");
    });

    it("dá ao painel virado o espaço de cima, e não o mínimo", async () => {
        const { available } = await open(field(700), 600);

        // 700 menos 5 de offset menos 10 de folga.
        expect(available).toBe(685);
    });

    it("encolhe para o espaço de baixo quando o campo tem algum, sem virar", async () => {
        const { placement, available } = await open(field(400), 600);

        expect(placement).toBe("bottom-start");
        // 800 menos 450 menos 5 de offset menos 10 de folga.
        expect(available).toBe(335);
    });

    it("vira para o lado mais folgado quando o de baixo não dá o mínimo", async () => {
        // 250 de espaço embaixo e 500 em cima: cabe, mas cabe pouco — e o pouco é
        // a busca e o rodapé comendo a lista.
        const { placement, available } = await open(field(500), 600);

        expect(placement).toBe("top-start");
        expect(available).toBe(485);
    });

    it("fica embaixo quando o de baixo dá o mínimo pedido, mesmo com mais espaço em cima", async () => {
        const { placement, available } = await open(field(500), 600, dropdownFit(200));

        expect(placement).toBe("bottom-start");
        expect(available).toBe(235);
    });

    it("não deixa o piso passar do lado mais folgado, e o painel não sai da viewport", async () => {
        VIEWPORT.height = 400;

        // Nenhum dos dois lados dá os 320: em cima há 220, embaixo 130. O piso
        // desce para o maior dos dois, senão o painel viraria e sairia por cima.
        const { placement, y, available } = await open(field(220), 600);

        expect(placement).toBe("top-start");
        expect(y).toBe(5);
        expect(y + available).toBeLessThanOrEqual(VIEWPORT.height);
    });

    it("entrega a largura da referência como --width, e não como width inline", async () => {
        const { style } = await open(field(100), 600);

        expect(style["--width"]).toBe("300px");
        // Um `width` inline ganharia de qualquer `w-*` do `ui`, calado.
        expect(style.width).toBeUndefined();
    });

    it("entrega a altura livre como --available-height, e não como max-height inline", async () => {
        const { style } = await open(field(100), 600);

        // 800 menos 150 menos 5 de offset menos 10 de folga.
        expect(style["--available-height"]).toBe("635px");
        // Um `max-height` inline ganharia do `[--max-height:…]` do `ui`, calado.
        expect(style.maxHeight).toBeUndefined();
    });
});