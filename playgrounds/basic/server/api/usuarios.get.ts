import { defineEventHandler, getQuery } from "h3";

import { usuarios } from "../utils/usuarios";

const PAGE = 20;

/**
 * O outro lado de `options` como função: `?search=` e `?page=` (1-based), 20 por
 * página, no envelope `{ items, total }` — o `total` vai ao rodapé do campo e
 * encerra a paginação quando a lista o alcança. Sem ele, seria o array vazio do
 * fim que encerraria.
 */
export default defineEventHandler(async (event) => {
    const query = getQuery(event);

    // `getQuery` devolve string, array ou nada — só o caso string interessa aqui.
    const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
    const page = Number(query.page) || 1;

    // Casa o termo com o nome **e** com o e-mail: é o que justifica o filtro local
    // desistir quando `options` é função — refiltrar pelo rótulo esconderia quem o
    // servidor achou pela matrícula.
    const casados = search
        ? usuarios.filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(search))
        : usuarios;

    // Devagar de propósito: sem atraso não dá para ver o estado de carregando, nem o
    // debounce segurando a tecla seguinte.
    await new Promise((resolve) => setTimeout(resolve, 300));

    return { items: casados.slice((page - 1) * PAGE, page * PAGE), total: casados.length };
});