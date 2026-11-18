/**
 * Renumera as chaves pontilhadas de um mapa sob `prefix.<índice>`. É o que faz o
 * erro de uma linha do `RArray` seguir o item quando outra linha sai ou troca de
 * lugar — as instâncias ficam presas ao índice, e o `id` delas também.
 *
 * `map` devolve o índice novo, ou `null` para descartar a chave (a linha removida).
 * Chave fora do prefixo, ou cujo segmento seguinte não é índice, passa intacta.
 *
 * @example remapIndexKeys({ "itens.1.nome": "x", "itens.2.nome": "y" }, "itens", (i) => (i === 1 ? null : i > 1 ? i - 1 : i))
 * // → { "itens.1.nome": "y" }
 */
export default <T>(
    record: Record<string, T>,
    prefix: string,
    map: (index: number) => number | null
): Record<string, T> => {
    const head = `${prefix}.`;
    const out: Record<string, T> = {};

    for (const [key, value] of Object.entries(record)) {
        const rest = key.startsWith(head) ? key.slice(head.length) : undefined;
        const dot = rest?.indexOf(".") ?? -1;
        const segment = rest === undefined || dot === -1 ? rest : rest.slice(0, dot);

        if (rest === undefined || !/^\d+$/.test(segment ?? "")) {
            out[key] = value;
            continue;
        }

        const next = map(Number(segment));

        if (next !== null) {
            out[`${head}${next}${dot === -1 ? "" : rest.slice(dot)}`] = value;
        }
    }

    return out;
};