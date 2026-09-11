import { createError, defineEventHandler, getRouterParam } from "h3";

import { usuarios } from "../../utils/usuarios";

/** O que a prop `resolve` chama: traduz o id que já está no model no item inteiro. */
export default defineEventHandler((event) => {
    const id = Number(getRouterParam(event, "id"));
    const usuario = usuarios.find((item) => item.id === id);

    if (!usuario) {
        throw createError({ statusCode: 404, statusMessage: "not found" });
    }

    return usuario;
});