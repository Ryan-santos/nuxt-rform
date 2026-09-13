import { detectOverflow, flip, offset, shift, size, type Middleware } from "@floating-ui/vue";

/** Folga entre o painel e a borda da viewport. */
const VIEWPORT_GAP = 10;

/**
 * Altura que o painel pede antes de preferir o lado mais folgado do campo. Não é
 * altura mínima: onde nenhum dos dois lados a tem, o painel encolhe. É o piso que
 * torna o flip possível; ver "`size()` do floating-ui sempre ganha do `flip()`" no
 * `.claude/CLAUDE.md`.
 */
export const DROPDOWN_MIN_HEIGHT = 320;

export type DropdownMiddlewareOptions = {
    offset?: number;
    middleware?: Middleware[];
};

/**
 * Dimensiona o painel contra o campo: a largura da referência e a altura livre do
 * lado em que o `flip()` parou.
 *
 * As duas saem como custom property, não como `width`/`max-height`: inline
 * ganharia de qualquer classe, e um `ui.Utils.Dropdown.popover` de `w-80` ou de
 * `[--max-height:30rem]` perderia calado. Quem lê é o `popover` do Dropdown.
 *
 * O piso é o que dá voz ao `flip()` — um painel já encolhido no que cabe embaixo
 * não transborda, e sem transbordo não há virada —, e o teto do piso é o lado mais
 * folgado, que é o que escolhe o maior dos dois sem sair da viewport.
 *
 * @example middleware: [dropdownFit()]
 */
export const dropdownFit = (minHeight: number = DROPDOWN_MIN_HEIGHT): Middleware =>
    size({
        async apply(state) {
            const { availableHeight, elements, rects } = state;

            // O espaço dos dois lados, medido no campo e contra o mesmo limite que
            // o `size()` usa (`altBoundary`) — o painel é fixo e teleportado, então
            // um scroller em volta do campo não é fronteira dele.
            const room = await detectOverflow(state, {
                elementContext: "reference",
                altBoundary: true
            });
            const roomiest = Math.max(-room.top, -room.bottom) - VIEWPORT_GAP;

            elements.floating.style.setProperty(
                "--width",
                `${Math.max(0, rects.reference.width)}px`
            );
            elements.floating.style.setProperty(
                "--available-height",
                `${Math.max(0, Math.min(minHeight, roomiest), availableHeight - VIEWPORT_GAP)}px`
            );
        }
    });

/**
 * A cadeia com que todo `RUtilsDropdown` posiciona. O middleware do campo vem por
 * último, depois do `flip()` — que é onde o `size()` pertence na estratégia default.
 *
 * @example dropdownMiddleware({ middleware: [dropdownFit()] })
 */
export default ({
    offset: distance = 5,
    middleware = []
}: DropdownMiddlewareOptions = {}): Middleware[] => [
    offset(distance),
    flip(),
    shift(),
    ...middleware
];