import { onBeforeUnmount, shallowRef, type ShallowRef } from "vue";

export type DragSortOptions = {
    /** As linhas, em ordem de documento — é delas que sai o ponto de inserção. */
    rows: () => HTMLElement[];
    /** Chamado no soltar, com o índice final já descontado da saída da origem. */
    onMove: (from: number, to: number) => void;
    disabled?: () => boolean;
};

export type DragSort = {
    /** Índice da linha sendo arrastada, ou `null`. */
    dragging: Readonly<ShallowRef<number | null>>;
    /** Ponto de inserção (0…n) que mudaria a ordem, ou `null` quando soltar ali não muda nada. */
    dropAt: Readonly<ShallowRef<number | null>>;
    /** Ligado no `pointerdown` da alça. */
    start: (event: PointerEvent, index: number) => void;
};

const THRESHOLD = 4;

// Copia o valor dos controles: o `:value` vira propriedade, não atributo, e um
// `cloneNode` sairia com todo input vazio.
const cloneRow = (row: HTMLElement): HTMLElement => {
    const ghost = row.cloneNode(true) as HTMLElement;
    const from = row.querySelectorAll<HTMLInputElement>("input, textarea, select");
    const to = ghost.querySelectorAll<HTMLInputElement>("input, textarea, select");

    from.forEach((control, index) => {
        const copy = to[index];
        if (copy) {
            copy.value = control.value;
            copy.checked = control.checked;
        }
    });
    ghost.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    ghost.inert = true;
    ghost.setAttribute("data-drag-ghost", "");

    return ghost;
};

/**
 * Reordena uma lista arrastando uma alça, por Pointer Events — mouse e toque (o
 * DnD nativo do HTML5 não dispara em tela de toque). O destino sai da geometria
 * das próprias linhas, então o arraste nunca vaza para outra lista.
 *
 * @example
 * const drag = useDragSort({ rows: () => [...list.value.children], onMove: reorder });
 * // <span @pointerdown="drag.start($event, index)" />
 */
export default function useDragSort(options: DragSortOptions): DragSort {
    const dragging = shallowRef<number | null>(null);
    const dropAt = shallowRef<number | null>(null);
    let stop: (() => void) | undefined;

    // Quantas linhas têm o meio acima do ponteiro.
    const insertion = (y: number) =>
        options.rows().filter((row) => {
            const rect = row.getBoundingClientRect();
            return rect.top + rect.height / 2 < y;
        }).length;

    const start = (event: PointerEvent, index: number) => {
        if (stop || options.disabled?.() || (event.pointerType === "mouse" && event.button !== 0)) {
            return;
        }

        const row = options.rows()[index];
        const handle = event.currentTarget as HTMLElement | null;
        if (!row || !handle) {
            return;
        }

        // Sem isso o arraste seleciona texto e tira o foco do campo.
        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);

        const pointer = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        let ghost: HTMLElement | undefined;
        let offsetX = 0;
        let offsetY = 0;

        const place = (x: number, y: number) =>
            ghost?.style.setProperty("transform", `translate(${x - offsetX}px, ${y - offsetY}px)`);

        const begin = (x: number, y: number) => {
            const rect = row.getBoundingClientRect();
            offsetX = startX - rect.left;
            offsetY = startY - rect.top;

            ghost = cloneRow(row);
            Object.assign(ghost.style, {
                position: "fixed",
                left: "0",
                top: "0",
                // Padding de vidro em volta, e a margem negativa devolve o conteúdo
                // para baixo do ponteiro, onde a linha estava.
                margin: "-6px 0 0 -10px",
                padding: "6px 10px",
                boxSizing: "content-box",
                zIndex: "9999",
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                pointerEvents: "none",
                willChange: "transform",
                viewTransitionName: "none",
                background: "color-mix(in oklab, var(--rf-color-background) 5%, transparent)",
                backdropFilter: "blur(5px) saturate(1.4)",
                webkitBackdropFilter: "blur(10px) saturate(1.4)",
                border: "1px solid var(--rf-color-border)",
                borderRadius: "var(--rf-radius-lg)",
                boxShadow: "0 12px 32px rgb(0 0 0 / 0.2)",
                // `rotate` à parte do `transform`: a inclinação anima, o arraste não.
                rotate: "0deg",
                transition: "rotate 150ms ease-out"
            });
            place(x, y);
            document.body.appendChild(ghost);
            const tilted = ghost;
            requestAnimationFrame(() => tilted.style.setProperty("rotate", "-2deg"));
            document.documentElement.style.cursor = "grabbing";
            dragging.value = index;
        };

        const onMove = (move: PointerEvent) => {
            if (move.pointerId !== pointer) {
                return;
            }

            if (!ghost) {
                if (Math.hypot(move.clientX - startX, move.clientY - startY) <= THRESHOLD) {
                    return;
                }
                begin(move.clientX, move.clientY);
            }

            place(move.clientX, move.clientY);
            const at = insertion(move.clientY);
            // Antes ou logo depois da própria linha é soltar no mesmo lugar.
            dropAt.value = at === index || at === index + 1 ? null : at;
        };

        const onUp = (up: PointerEvent) => {
            if (up.pointerId !== pointer) {
                return;
            }

            const at = dropAt.value;
            const moved = Boolean(ghost);
            cleanup();

            if (!moved) {
                return;
            }

            // O `click` que segue o `pointerup` cairia na alça ou num botão por baixo.
            const swallow = (click: MouseEvent) => {
                click.stopPropagation();
                click.preventDefault();
            };
            document.addEventListener("click", swallow, { capture: true, once: true });
            setTimeout(() => document.removeEventListener("click", swallow, true), 0);

            if (at !== null) {
                options.onMove(index, at > index ? at - 1 : at);
            }
        };

        const onKey = (key: KeyboardEvent) => {
            if (key.key === "Escape") {
                cleanup();
            }
        };

        const cleanup = () => {
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            handle.removeEventListener("pointercancel", cleanup);
            document.removeEventListener("keydown", onKey);
            if (handle.hasPointerCapture?.(pointer)) {
                handle.releasePointerCapture(pointer);
            }
            ghost?.remove();
            ghost = undefined;
            document.documentElement.style.cursor = "";
            dragging.value = null;
            dropAt.value = null;
            stop = undefined;
        };

        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", cleanup);
        document.addEventListener("keydown", onKey);
        stop = cleanup;
    };

    onBeforeUnmount(() => stop?.());

    return { dragging, dropAt, start };
}