/**
 * Nomes que o módulo possui. `Form` provê a raiz da injeção e `Dynamic` renderiza
 * um schema — nenhum dos dois é campo, e nenhum é substituível.
 */
export const RESERVED = ["Form", "Dynamic"];

/**
 * O nome é usado de três formas: chave de objeto no registry gerado, chave de
 * `Components` que o app escreve no `defineFieldDefaults`, e — em minúsculas —
 * membro do `FieldType`. Traço ou dígito inicial não sobrevive a nenhuma delas.
 */
const VALID_NAME = /^[A-Z][A-Za-z0-9]*$/;

export type ComponentSource = {
    /** Diretório absoluto de onde os arquivos foram lidos. */
    root: string;
    /** As entradas do diretório, como o `readdir` devolveu. */
    files: string[];
    /** `app/rform/*`, e não o runtime do próprio módulo. */
    user: boolean;
};

export type ComponentFile = {
    name: string;
    /** Caminho relativo a `root`: quem junta caminho é o chamador. */
    file: string;
    root: string;
    user: boolean;
};

const isComponent = (file: string) => file.endsWith(".vue");

/**
 * Pareia todo componente sob as raízes dadas com o nome, e fonte posterior
 * sobrescreve anterior pelo nome. A ordem carrega a regra inteira de override: as
 * raízes embutidas vêm primeiro, então arquivo do usuário de mesmo nome substitui
 * em vez de duplicar — a mesma forma que `collectPresets` dá a rules e masks.
 */
export const collectComponents = (sources: ComponentSource[]): ComponentFile[] => {
    const merged = new Map<string, ComponentFile>();

    for (const { root, files, user } of sources) {
        for (const file of files.filter(isComponent)) {
            const name = file.slice(0, -".vue".length);

            if (!VALID_NAME.test(name)) {
                throw new Error(
                    `[rform] invalid component name "${name}" in "${root}". A component file must be PascalCase and alphanumeric, so that "${name}" can be a key in the generated registry and a member of FieldType.`
                );
            }

            if (user && RESERVED.includes(name)) {
                throw new Error(
                    `[rform] "${name}" is reserved by rform and cannot be replaced: "${root}/${file}". Rename the file, or restyle the built-in through app/rform/defaults.ts.`
                );
            }

            merged.set(name, { name, file, root, user });
        }
    }

    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/** Módulo de fonte ou do `dist`. A declaração de tipo ao lado dele fica fora. */
const MODULE = /\.[cm]?[tj]s$/;
const DECLARATION = /\.d\.[cm]?ts$/;

export type ModuleFile = {
    name: string;
    /** Caminho relativo ao diretório lido: quem junta caminho é o chamador. */
    file: string;
};

/**
 * Pareia todo módulo de um diretório com o nome sem extensão, para os barrels
 * `#rform/utils` e `#rform/composables`. No `dist` publicado cada helper aparece
 * duas vezes — `merger.js` e `merger.d.ts` —, e o nome tem de sair igual nos dois
 * layouts: um `basename(file, ".ts")` devolvia `"merger.js"` e `"merger.d"`, dois
 * identificadores que não parseiam no `import` gerado.
 *
 * @example collectModules(["merger.js", "merger.d.ts"]) // → [{ name: "merger", file: "merger.js" }]
 */
export const collectModules = (files: string[]): ModuleFile[] => {
    const merged = new Map<string, ModuleFile>();

    for (const file of files) {
        if (!MODULE.test(file) || DECLARATION.test(file)) {
            continue;
        }

        const name = file.replace(MODULE, "");

        if (!merged.has(name)) {
            merged.set(name, { name, file });
        }
    }

    return [...merged.values()];
};

/**
 * O arquivo de onde os templates de tipo leem o `Props` de um componente: o
 * `.d.vue.ts` quando existe ao lado (o `dist` publicado), senão o próprio `.vue`.
 * O compiler-sfc lê o que o import nomeia, e só o `.d.vue.ts` casa o `include` do
 * consumidor. Ver "O consumidor precisa incluir os `.d.vue.ts`" no CLAUDE.md.
 *
 * @example typeSource("/dist/fields/Text.vue", existsSync) // → "/dist/fields/Text.d.vue.ts"
 */
export const typeSource = (file: string, exists: (path: string) => boolean) => {
    const declaration = file.replace(/\.vue$/, ".d.vue.ts");

    return declaration !== file && exists(declaration) ? declaration : file;
};