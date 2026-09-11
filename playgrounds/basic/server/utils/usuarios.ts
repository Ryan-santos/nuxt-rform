export type Usuario = {
    id: number;
    name: string;
    email: string;
};

const PRIMEIROS = [
    "Ana",
    "Bruno",
    "Carla",
    "Diego",
    "Elisa",
    "Felipe",
    "Gabriela",
    "Heitor",
    "Isabela",
    "João"
];

const MEIOS = ["Castro", "Duarte", "Lima", "Moraes", "Teixeira"];

const ULTIMOS = [
    "Almeida",
    "Barbosa",
    "Cardoso",
    "Esteves",
    "Ferreira",
    "Gomes",
    "Nogueira",
    "Pacheco",
    "Ramires",
    "Siqueira"
];

/**
 * O "banco" do playground: 500 nomes gerados uma vez, na memória do processo.
 *
 * O e-mail é a matrícula, e não o nome — é o que faz uma busca por "0317" casar um
 * item cujo rótulo não tem o termo, que é o motivo de o filtro local desistir.
 */
export const usuarios: Usuario[] = Array.from({ length: 500 }, (_, index) => {
    const primeiro = PRIMEIROS[index % PRIMEIROS.length];
    const meio = MEIOS[Math.floor(index / PRIMEIROS.length) % MEIOS.length];
    const ultimo = ULTIMOS[Math.floor(index / (PRIMEIROS.length * MEIOS.length)) % ULTIMOS.length];
    const id = index + 1;

    return {
        id,
        name: `${primeiro} ${meio} ${ultimo}`,
        email: `u${String(id).padStart(4, "0")}@empresa.com`
    };
});