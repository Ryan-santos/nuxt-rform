import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import {
    defineNuxtModule,
    addComponent,
    addComponentsDir,
    createResolver,
    hasNuxtModule,
    addTypeTemplate,
    addTemplate,
    addImports,
    addVitePlugin
} from "@nuxt/kit";

import { name as pkg, version } from "../package.json";
import { resolveAppMessages, trTemplate, type I18nConfig } from "./appMessages";
import { langFile } from "./langFile";
import { collectPresets } from "./presets";
import { collectComponents, collectModules, type ComponentFile } from "./scan";
import vitePlugin from "./vite.plugin";

// Ligado, não desestruturado: o kit tipa `resolve` como método, e arrancá-lo do
// objeto dispara `unbound-method`.
const resolver = createResolver(import.meta.url);
const resolve = resolver.resolve.bind(resolver);

/**
 * Um module specifier para template gerado. Barra invertida seria escape no fonte
 * emitido, e sufixo `.ts` exigiria `allowImportingTsExtensions`, que um app
 * consumidor não tem por que ligar. O `.vue` fica — ali é obrigatório.
 */
const specifier = (path: string) =>
    JSON.stringify(
        path
            .split("\\")
            .join("/")
            .replace(/\.[cm]?[tj]s$/, "")
    );

/**
 * Verdadeiro quando o fonte importa um *valor* de `#rform/...`. Import só de tipo é
 * apagado e nunca roda código, então fica de fora de propósito. Serve para separar
 * o helper que pode reentrar no barrel; ver "O `import` vem pareado com o próprio
 * `export *`" no `.claude/CLAUDE.md`.
 */
const importsRformValue = (source: string) =>
    source.split("\n").some((line) => {
        const match = /^\s*import\s+([^;]*?)\s+from\s+["']#rform\//.exec(line);

        return !!match && !/^type\s/.test((match[1] ?? "").trim());
    });

/**
 * Verdadeiro quando o fonte tem `export default`. O barrel só nomeia o default de
 * quem tem um: um helper sem default renderizaria `import x from …` para nada — e,
 * pior, um `export { x }` explícito sombrearia o `export *` do mesmo arquivo. É o
 * caso do `tr.ts`, cujo export nomeado `tr` tem o nome do próprio arquivo.
 */
const hasDefaultExport = (source: string) => /^export default\b/m.test(source);

/**
 * Com barra normal: este caminho é escrito em fonte gerado, onde barra invertida é
 * escape, e entregue ao `addComponent`, que — ao contrário do `addComponentsDir` —
 * não normaliza antes de virar import.
 */
const filePath = ({ root, file }: ComponentFile) => join(root, file).split("\\").join("/");

/**
 * O nome curto do módulo. É ele que dá o `configKey`, o alias `#rform` e as raízes
 * em `app/rform/` — e é **desacoplado** do nome no npm (`nuxt-rform`) de propósito:
 * o pacote precisa do prefixo `nuxt-` para descoberta, e o alias público não pode
 * mudar junto.
 */
const name = "rform";

const prefixIcons = (obj: Record<string, string>) =>
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [`${name}:${key}`, value]));

export interface ModuleOptions {
    /**
     * Idioma usado quando o app **não** tem `@nuxtjs/i18n`. Com ele instalado,
     * quem manda é o locale dele — este valor não é lido.
     */
    locale: string;
}

export default defineNuxtModule<ModuleOptions>({
    meta: {
        name: pkg,
        version,
        configKey: name,
        compatibility: {
            nuxt: ">=4.0.0"
        }
    },

    moduleDependencies: {
        "@nuxt/icon": {
            defaults: {
                size: "1em",
                aliases: prefixIcons({
                    minus: "fa6-solid:minus",
                    plus: "fa6-solid:plus",
                    remove: "fa6-solid:xmark",
                    select: "mi:select",
                    loading: "eos-icons:loading",
                    alert: "ooui:alert",
                    search: "mi:search",
                    check: "fa6-solid:check",
                    calendar: "fa6-regular:calendar",
                    file: "fa6-regular:file-lines",
                    image: "fa6-regular:image",
                    upload: "fa6-solid:cloud-arrow-up",
                    retry: "fa6-solid:rotate-right",
                    cancel: "fa6-solid:ban",
                    "chevron-left": "fa6-solid:chevron-left",
                    "chevron-right": "fa6-solid:chevron-right"
                })
            }
        }
    },

    defaults: {
        locale: "pt-BR"
    },

    async setup(options, nuxt) {
        const componentsPath = resolve("runtime/components");

        // Qual dos dois motores do `tr` entra no bundle. `hasNuxtModule` lê a lista
        // *declarada* de módulos, então não depende da ordem do `modules:`. Ver "O
        // corte do bundle é estrutural" no `.claude/CLAUDE.md`.
        const hasI18n = hasNuxtModule("@nuxtjs/i18n", nuxt);

        const roots = {
            /** Form e Dynamic — nenhum dos dois é campo, nenhum é substituível. */
            containers: componentsPath,
            fields: resolve("runtime/components/fields"),
            utils: resolve("runtime/components/utils"),
            userFields: join(nuxt.options.srcDir, name, "fields"),
            userUtils: join(nuxt.options.srcDir, name, "utils")
        };

        /** `null` quando o diretório não existe; as duas raízes do usuário são opcionais. */
        const listing = Object.fromEntries(
            await Promise.all(
                Object.entries(roots).map(
                    async ([key, path]) => [key, await readdir(path).catch(() => null)] as const
                )
            )
        ) as Record<keyof typeof roots, string[] | null>;

        // Raiz embutida primeiro, para componente do usuário de mesmo nome substituir
        // — a mesma precedência dos presets.
        const scan = (...keys: Array<keyof typeof roots>) =>
            collectComponents(
                keys.map((key) => ({
                    root: roots[key],
                    files: listing[key] ?? [],
                    user: key.startsWith("user")
                }))
            );

        const containers = scan("containers");
        const fields = scan("fields", "userFields");
        const utils = scan("utils", "userUtils");

        /** Tudo que tem um tipo `Props` — é por isso que o `defineFieldDefaults` é chaveado. */
        const components = [...containers, ...fields];

        /**
         * Relativo, não absoluto — e só aqui, onde o `Props` de um `.vue` é lido de
         * volta como tipo. O compiler-sfc resolve import relativo com `fs` puro, e
         * manda qualquer outra coisa para a resolução de módulos do TypeScript, que
         * sozinha não resolve um specifier `.vue`.
         */
        const relativeSpecifier = (template: string, target: string) => {
            const from = dirname(join(nuxt.options.buildDir, template));
            const path = relative(from, target).split("\\").join("/");

            return JSON.stringify(path.startsWith(".") ? path : `./${path}`);
        };

        const importer = (template: string) => (component: ComponentFile) =>
            `import(${relativeSpecifier(template, filePath(component))}).Props`;

        const componentsTypes = `${name}/types/components/index.ts`;

        addTemplate({
            filename: componentsTypes,
            write: true,
            getContents: () =>
                [
                    components
                        .map(
                            (component) =>
                                `export type ${component.name} = ${importer(componentsTypes)(component)}`
                        )
                        .join("\n   "),
                    "export type Utils = import('./utils').default",
                    "",
                    "export default interface All {",
                    `   ${components.map(({ name }) => `${name}: ${name}`).join("\n       ")}`,
                    "   Utils: Utils",
                    "}"
                ].join("\n")
        });

        const utilsTypes = `${name}/types/components/utils/index.ts`;

        addTemplate({
            filename: utilsTypes,
            write: true,
            getContents: () =>
                [
                    utils
                        .map(
                            (component) =>
                                `export type ${component.name} = ${importer(utilsTypes)(component)}`
                        )
                        .join("\n"),
                    "",
                    "export default interface All {",
                    `   ${utils.map(({ name }) => `${name}: ${name}`).join("\n    ")}`,
                    "}"
                ].join("\n")
        });

        addTemplate({
            filename: `${name}/types/components/utils/props.ts`,
            write: true,
            getContents: () =>
                [
                    "type Utils = import('./').default",
                    "",
                    utils
                        .map(
                            ({ name }) =>
                                `export type ${name} = Omit<Utils["${name}"], "ui"> & { ui?: { Utils?: { ${name}?: Utils["${name}"]["ui"] } } }`
                        )
                        .join("\n   "),
                    "",
                    "export default interface All {",
                    `   ${utils.map(({ name }) => `${name}: ${name}`).join("\n    ")}`,
                    "}"
                ].join("\n")
        });

        addTemplate({
            filename: `${name}/types/index.d.ts`,
            write: true,
            getContents: () => `export * from "${resolve("runtime/type")}"`
        });

        /**
         * Nome → módulo, resolvido nas duas raízes: é por aqui que `useField` lê o
         * `defaults` de um componente. As entradas são thunks, então o ciclo
         * `Text.vue → useField → registry → Text.vue` não fecha em tempo de carga.
         * Ver "useField" no `.claude/CLAUDE.md`.
         */
        addTemplate({
            filename: `${name}/registry.ts`,
            write: true,
            getContents: () => {
                const record = (list: ComponentFile[]) =>
                    list
                        .map(
                            (component) =>
                                `    ${component.name}: () => import(${specifier(filePath(component))})`
                        )
                        .join(",\n");

                /**
                 * A classe-gancho que cada campo e util carrega. Gerada aqui, e não
                 * derivada na composable, porque este é o último lugar em que as três
                 * listas ainda se distinguem — container não recebe gancho. Ver "As
                 * classes-gancho entram pelo `ui`" no `.claude/CLAUDE.md`.
                 */
                const hooks = (list: ComponentFile[], generic: string, prefix: string) =>
                    list
                        .map(
                            ({ name }) =>
                                `        ${name}: ${JSON.stringify(`${generic} ${prefix}${name}`)}`
                        )
                        .join(",\n");

                return [
                    "// gerado — nome do componente → módulo, para buscar os defaults em runtime",
                    "export const components = {",
                    record(components),
                    "};",
                    "",
                    "export const utils = {",
                    record(utils),
                    "};",
                    "",
                    "// a classe que cada um carrega, para os resets do style.css",
                    "export const hooks = {",
                    "    fields: {",
                    hooks(fields, "RField", "R"),
                    "    },",
                    "    utils: {",
                    hooks(utils, "RUtil", "RUtils"),
                    "    }",
                    "};",
                    "",
                    "export default { components, utils, hooks };"
                ].join("\n");
            }
        });

        const containerChildren: Record<string, string> = {
            Object: "Schema",
            Array: "FieldConfig | SlotField"
        };

        addTemplate({
            filename: `${name}/components-map.ts`,
            write: true,
            getContents: () =>
                [
                    "// gerado — field type → módulo do componente",
                    ...fields.map(
                        (component) =>
                            `import ${component.name} from ${specifier(filePath(component))};`
                    ),
                    "",
                    "export default {",
                    ...fields.map(
                        ({ name }) => `    ${JSON.stringify(name.toLowerCase())}: ${name},`
                    ),
                    "} as const;"
                ].join("\n")
        });

        // Sem import nenhum de propósito: `available` é tipado contra este union, e
        // os presets são lidos de volta pelo `types/presets.d.ts` — derivá-lo do
        // `Props` dos componentes fecharia esse ciclo.
        addTypeTemplate({
            filename: `${name}/types/fields.d.ts`,
            write: true,
            getContents: () =>
                [
                    "// gerado — o field type de cada componente",
                    "export type FieldType =",
                    ...fields.map(
                        ({ name }, index) =>
                            `    | ${JSON.stringify(name.toLowerCase())}${
                                index === fields.length - 1 ? ";" : ""
                            }`
                    )
                ].join("\n")
        });

        addTypeTemplate({
            filename: `${name}/types/schema.d.ts`,
            write: true,
            getContents: () => {
                const fieldNames = fields.map((field) => field.name);
                return [
                    `import type Components from "./components";`,
                    `import type { Condition } from "./index";`,
                    `import type { Rule } from "./presets";`,
                    `import type { FieldType } from "./fields";`,
                    `import type { ZodType, infer as zInfer } from "zod";`,
                    ``,
                    `// No schema o objeto vem de uma API, e snake_case é a convenção da casa.`,
                    `// Derivado do próprio \`P\`, então não há import novo a fechar ciclo — e o`,
                    `// apelido vale para toda prop composta, não para uma lista de duas.`,
                    `type Snake<S extends string> = S extends \`\${infer H}\${infer T}\``,
                    `    ? \`\${H extends Lowercase<H> ? H : \`_\${Lowercase<H>}\`}\${Snake<T>}\``,
                    `    : S;`,
                    ``,
                    `// \`Snake<K> extends K ? never\` derruba toda prop de uma palavra só: sem isso`,
                    `// \`label\` e \`name\` voltariam como si mesmas e colidiriam com as explícitas.`,
                    `type SnakeAliases<P> = {`,
                    `    [K in keyof P & string as Snake<K> extends K ? never : Snake<K>]?: P[K];`,
                    `};`,
                    ``,
                    `type Own<P> = Omit<P, "modelValue" | "onUpdate:modelValue" | "ui" | "name" | "error" | "loading" | "default" | "rule">;`,
                    ``,
                    `// Não vêm do \`P\`: são do schema, não props do campo. Quem as lê é o`,
                    `// \`RDynamic\`, que decide o \`v-if\` e preenche o \`disabled\`.`,
                    `type Conditions = {`,
                    `    visibleWhen?: Condition;`,
                    `    disabledWhen?: Condition;`,
                    `};`,
                    ``,
                    `type Base<P, C> = Own<P> & SnakeAliases<Own<P>> & Conditions & SnakeAliases<Conditions> & {`,
                    `    rule?: Rule<C>;`,
                    `    default?: unknown;`,
                    `    label?: string;`,
                    `};`,
                    ``,
                    `export type SlotField = { slot: string; rule?: Rule };`,
                    ``,
                    `export type Schema = Record<string, FieldConfig | SlotField>;`,
                    ``,
                    ...fieldNames.map((n) => {
                        const t = n.toLowerCase();
                        const extra = containerChildren[n]
                            ? `; children: ${containerChildren[n]}`
                            : "";
                        return `export type Field${n} = Base<Components["${n}"], "${t}"> & { type: "${t}"${extra} };`;
                    }),
                    ``,
                    `export type FieldConfig =`,
                    ...fieldNames.map(
                        (n, i) => `    | Field${n}${i === fieldNames.length - 1 ? ";" : ""}`
                    ),
                    ``,
                    `export type InferData<S extends Schema> = {`,
                    `    [K in keyof S]:`,
                    `        S[K] extends { rule: infer R extends ZodType } ? zInfer<R> :`,
                    `        S[K] extends { type: "object"; children: infer C extends Schema } ? InferData<C> :`,
                    `        S[K] extends { type: "array"; children: infer C } ?`,
                    `            (C extends FieldConfig ? Array<InferDataItem<C>> : unknown[]) :`,
                    `        unknown;`,
                    `};`,
                    `type InferDataItem<C> =`,
                    `    C extends { type: "object"; children: infer S extends Schema } ? InferData<S> :`,
                    `    C extends { rule: infer R extends ZodType } ? zInfer<R> : unknown;`,
                    ``,
                    `export type { FieldType };`
                ].join("\n");
            }
        });

        const presetRoots = [
            resolve("runtime/presets"),
            join(nuxt.options.srcDir, name, "presets")
        ];

        // `app/rform/defaults.ts` — os overrides do app. O template existe nos dois
        // casos, então as composables importam sem guarda.
        const userDefaultsFile = async () => {
            const dir = join(nuxt.options.srcDir, name);
            const files = await readdir(dir).catch(() => [] as string[]);
            const file = files.find((entry) => /^defaults\.[tj]s$/.test(entry));

            return file ? join(dir, file) : null;
        };

        addTemplate({
            filename: `${name}/defaults.ts`,
            write: true,
            getContents: async () => {
                const file = await userDefaultsFile();

                return [
                    "// gerado — os overrides do app sobre o defaults de cada componente",
                    `import type Components from "#${name}/types/components";`,
                    `import type { DeepPartial } from ${specifier(resolve("runtime/type"))};`,
                    "",
                    file ? `import defaults from ${specifier(file)};` : "const defaults = {};",
                    "",
                    "export default defaults as DeepPartial<Components>;"
                ].join("\n");
            }
        });

        const scanPresets = async (root: string, kind: "rules" | "masks") => {
            const dir = join(root, kind);
            const files = await readdir(dir, { recursive: true }).catch(() => [] as string[]);

            try {
                return collectPresets(files).map((preset) => ({
                    name: preset.name,
                    path: join(dir, preset.file)
                }));
            } catch (error) {
                // O Nuxt reporta falha de template sem a causa, então o detalhe da
                // colisão nunca chegaria ao terminal.
                console.error((error as Error).message, `\n  in ${dir}`);
                throw error;
            }
        };

        // Embutidos primeiro, para um preset do usuário de mesmo nome ganhar.
        const presetsOf = async (kind: "rules" | "masks") => {
            const merged = new Map<string, string>();

            for (const root of presetRoots) {
                for (const preset of await scanPresets(root, kind)) {
                    merged.set(preset.name, preset.path);
                }
            }

            return [...merged];
        };

        addTemplate({
            filename: `${name}/presets.ts`,
            write: true,
            getContents: async () => {
                const kinds = {
                    rules: await presetsOf("rules"),
                    masks: await presetsOf("masks")
                };

                const lines = (kind: "rules" | "masks") => {
                    const prefix = kind === "rules" ? "_rule" : "_mask";

                    return {
                        imports: kinds[kind].map(
                            ([, path], index) => `import ${prefix}${index} from ${specifier(path)};`
                        ),
                        record: kinds[kind]
                            .map(
                                ([preset], index) =>
                                    `    ${JSON.stringify(preset)}: ${prefix}${index}`
                            )
                            .join(",\n")
                    };
                };

                const rules = lines("rules");
                const masks = lines("masks");

                return [
                    "// auto-generated — preset modules discovered on disk",
                    ...rules.imports,
                    ...masks.imports,
                    "",
                    "export const rules = {",
                    rules.record,
                    "};",
                    "",
                    "export const masks = {",
                    masks.record,
                    "};",
                    "",
                    "export default { rules, masks };"
                ].join("\n");
            }
        });

        addTypeTemplate({
            filename: `${name}/types/presets.d.ts`,
            write: true,
            getContents: async () => {
                const entries = (list: Array<[string, string]>) =>
                    list.map(
                        ([preset, path]) =>
                            `    ${JSON.stringify(preset)}: typeof import(${specifier(path)}).default;`
                    );

                return [
                    `import type { ZodType } from "zod";`,
                    `import type { MaskInputOptions } from "maska";`,
                    ``,
                    `type Rules = {`,
                    ...entries(await presetsOf("rules")),
                    `};`,
                    ``,
                    `type Masks = {`,
                    ...entries(await presetsOf("masks")),
                    `};`,
                    ``,
                    `export type RuleName = keyof Rules;`,
                    `export type MaskName = keyof Masks;`,
                    ``,
                    `export type Mask = MaskName | (string & {}) | MaskInputOptions;`,
                    ``,
                    `type BaseContext = { value: any; form: any; t: (key: string, params?: Record<string, unknown>) => string };`,
                    ``,
                    `export type RuleFn = (context: BaseContext) => string | void | Promise<string | void>;`,
                    ``,
                    `/** Presets without \`available\` serve every field. */`,
                    `type NamesFor<C> = {`,
                    `    [K in keyof Rules]: Rules[K] extends { available: readonly (infer A)[] }`,
                    `        ? (C extends A ? K : never)`,
                    `        : K;`,
                    `}[keyof Rules];`,
                    ``,
                    `/** What a preset's validation takes on top of \`value\` and \`form\`. */`,
                    `type Args<K extends keyof Rules> = Rules[K]["validation"] extends (context: infer P) => any`,
                    `    ? Omit<P, keyof BaseContext>`,
                    `    : {};`,
                    ``,
                    `/** A preset taking arguments can only be referenced as \`{ name, ...args }\`. */`,
                    `export type RuleRef<C = any> = {`,
                    `    [K in NamesFor<C>]: {} extends Args<K>`,
                    `        ? (K | ({ name: K } & Args<K>))`,
                    `        : ({ name: K } & Args<K>);`,
                    `}[NamesFor<C>];`,
                    ``,
                    `type Single<C> = RuleRef<C> | RuleFn | ZodType;`,
                    ``,
                    `export type Rule<C = any> = Single<C> | Array<Single<C>>;`
                ].join("\n");
            }
        });

        // O nome do arquivo é o code (`pt-BR.ts` → `pt-BR`). Mesmo code **mescla**,
        // não substitui, e a lista é varrida a cada `getContents` para editar um pack
        // regenerar o template.
        const localeRoots = [
            resolve("runtime/locales"),
            join(nuxt.options.srcDir, name, "locales")
        ];

        const referenceLocale = resolve("runtime/locales/pt-BR");

        const localeFiles = async (): Promise<Array<[string, string[]]>> => {
            const merged = new Map<string, string[]>();

            for (const root of localeRoots) {
                const files = await readdir(root).catch(() => [] as string[]);

                for (const { name: code, file } of collectModules(files)) {
                    merged.set(code, [...(merged.get(code) ?? []), join(root, file)]);
                }
            }

            return [...merged];
        };

        addTemplate({
            filename: `${name}/locales.ts`,
            write: true,
            getContents: async () => {
                const entries = await localeFiles();
                const imports: string[] = [];

                const record = entries.map(([code, files], index) => {
                    const aliases = files.map((file, position) => {
                        const alias = `_locale${index}_${position}`;
                        imports.push(`import ${alias} from ${specifier(file)};`);

                        return alias;
                    });

                    const value = aliases.length > 1 ? `merger(${aliases.join(", ")})` : aliases[0];

                    return `    ${JSON.stringify(code)}: ${value}`;
                });

                const needsMerger = entries.some(([, files]) => files.length > 1);

                return [
                    "// gerado — os packs de mensagem encontrados no disco",
                    ...(needsMerger
                        ? [`import merger from ${specifier(resolve("runtime/utils/merger"))};`]
                        : []),
                    ...imports,
                    "",
                    `export const defaultLocale = ${JSON.stringify(options.locale)};`,
                    "",
                    "export const locales = {",
                    record.join(",\n"),
                    "};",
                    "",
                    "export const available = Object.keys(locales);",
                    "",
                    "export default { locales, defaultLocale, available };"
                ].join("\n");
            }
        });

        addTypeTemplate({
            filename: `${name}/types/locales.d.ts`,
            write: true,
            getContents: async () => {
                const entries = await localeFiles();

                return [
                    "// gerado — a forma de um pack de mensagem",
                    "",
                    `export type Messages = typeof import(${specifier(referenceLocale)}).default;`,
                    ``,
                    `/** Todo caminho pontilhado que termina em string: \`"rules.min.length"\`. */`,
                    `type Leaves<T> = {`,
                    `    [K in keyof T & string]: T[K] extends string ? K : \`\${K}.\${Leaves<T[K]>}\`;`,
                    `}[keyof T & string];`,
                    ``,
                    `export type MessageKey = Leaves<Messages>;`,
                    ``,
                    `export type LocaleCode =`,
                    ...entries.map(
                        ([code], index) =>
                            `    | ${JSON.stringify(code)}${index === entries.length - 1 ? ";" : ""}`
                    )
                ].join("\n");
            }
        });

        // O mapa de chaves do app. A config é lida dentro do `getContents`, e não no
        // `setup`, porque só ali o `langDir` já está resolvido. Ver "O mapa de chaves
        // do app" no `.claude/CLAUDE.md`.
        addTypeTemplate({
            filename: `${name}/types/tr.d.ts`,
            write: true,
            getContents: async () =>
                trTemplate(
                    await resolveAppMessages({
                        hasI18n,
                        config: (nuxt.options as { i18n?: I18nConfig }).i18n,
                        rootDir: nuxt.options.rootDir,
                        read: (path) => readFile(path, "utf8"),
                        warn: (message) => console.warn(message)
                    })
                )
        });

        // A ponte: um arquivo por locale no `buildDir`, entregando o pack sob a
        // chave `rform`. `.ts` e não `.json` porque os packs são módulos, e quem os
        // avalia é o Vite. A forma do arquivo é do `langFile`, e não é negociável —
        // ver o JSDoc dele. Ver "A ponte é hook" no `.claude/CLAUDE.md`.
        const localeEntries = await localeFiles();

        // Os codes que o **app** declarou. Registrar um que ele não declarou não é
        // neutro: o code entraria na lista de locales dele, e de lá no seletor de
        // idioma e no prerender.
        const declaredLocales = (): string[] => {
            const inline = (nuxt.options.modules ?? []).find(
                (entry) => Array.isArray(entry) && entry[0] === "@nuxtjs/i18n"
            ) as [string, { locales?: unknown }] | undefined;

            const config = (nuxt.options as { i18n?: { locales?: unknown } }).i18n;

            const codes = [config?.locales, inline?.[1]?.locales]
                .flatMap((list) => (Array.isArray(list) ? list : []))
                .map((locale) =>
                    typeof locale === "string" ? locale : (locale as { code?: string })?.code
                )
                .filter((code): code is string => !!code);

            return [...new Set(codes)];
        };

        // Gêmeo em build time do `matchLocale`, e não um import dele: aquele arquivo
        // só resolve pelo alias `#rform/types/locales`, que não existe aqui.
        const packFor = (code: string): string | undefined => {
            const wanted = code.toLowerCase();
            const primary = wanted.split("-")[0] ?? wanted;
            const codes = localeEntries.map(([entry]) => entry);

            return (
                codes.find((entry) => entry.toLowerCase() === wanted) ??
                codes.find((entry) => entry.toLowerCase().split("-")[0] === primary)
            );
        };

        const langDir = join(nuxt.options.buildDir, name, "i18n");

        for (const [code] of localeEntries) {
            addTemplate({
                filename: `${name}/i18n/${code}.ts`,
                write: true,
                getContents: () => langFile(name, code)
            });
        }

        // E também **agora**, na mão: o i18n lê cada arquivo do `langDir` com
        // `readFileSync` durante o setup dele, e template do Nuxt só chega ao disco
        // muito depois. O `addTemplate` acima fica para sobreviver a uma regeneração.
        await mkdir(langDir, { recursive: true });

        await Promise.all(
            localeEntries.map(([code]) =>
                writeFile(join(langDir, `${code}.ts`), langFile(name, code))
            )
        );

        // Cast: o hook não está no `NuxtHooks`, e augmentar a interface exigiria
        // depender dos tipos do i18n — que é justamente o que a ponte evita.
        type RegisterI18n = (
            register: (config: {
                langDir: string;
                locales: Array<{ code: string; file: string }>;
            }) => void
        ) => void;

        const hookI18n = nuxt.hook as unknown as (
            event: "i18n:registerModule",
            callback: RegisterI18n
        ) => void;

        hookI18n("i18n:registerModule", (register) => {
            const declared = declaredLocales();

            // Code declarado que nenhum pack atende fica de fora, e o vue-i18n resolve
            // pelo `fallbackLocale` do app. Sem nenhum code legível, cada pack entra
            // sob o próprio code.
            const locales =
                declared.length === 0
                    ? localeEntries.map(([code]) => ({ code, file: `${code}.ts` }))
                    : declared.flatMap((code) => {
                          const pack = packFor(code);

                          return pack ? [{ code, file: `${pack}.ts` }] : [];
                      });

            register({ langDir, locales });
        });

        nuxt.hook("builder:watch", (event, path) => {
            // O arquivo de mensagens do app mora fora do `srcDir`, e uma **edição** já
            // muda as chaves que o `types/tr.d.ts` oferece.
            if (/(^|[\\/])i18n[\\/].*\.json$/.test(path)) {
                return nuxt.callHook("builder:generateApp");
            }

            if (event !== "add" && event !== "unlink") {
                return;
            }

            const absolute = join(nuxt.options.srcDir, path);

            const watched = [
                ...presetRoots,
                roots.userFields,
                roots.userUtils,
                join(nuxt.options.srcDir, name, "locales"),
                // `defaults` sem extensão, para pegar tanto `.ts` quanto `.js`.
                join(nuxt.options.srcDir, name, "defaults")
            ];

            if (watched.some((root) => absolute.startsWith(root))) {
                return nuxt.callHook("builder:generateApp");
            }
        });

        const composablesPath = resolve("runtime/composables");

        const composables = collectModules(await readdir(composablesPath)).map(
            ({ name, file }) => ({
                name,
                path: resolve(composablesPath, file)
            })
        );

        addTemplate({
            filename: `${name}/composables.ts`,
            write: true,
            getContents: () =>
                [
                    composables.map(({ name, path }) => `import ${name} from "${path}"`).join("\n"),
                    "",
                    "export {",
                    `   ${composables.map(({ name }) => name).join(",\n   ")}`,
                    "}",
                    "",
                    "export default {",
                    `   ${composables.map(({ name }) => name).join(",\n   ")}`,
                    "}"
                ].join("\n")
        });

        const utilsPath = resolve("runtime/utils");

        const helpers = await Promise.all(
            collectModules(await readdir(utilsPath)).map(async ({ name, file }) => {
                const path = resolve(utilsPath, file);
                const source = await readFile(path, "utf8");

                return {
                    name,
                    path,
                    // O que a intercalação do template abaixo usa, e não sorte
                    // alfabética.
                    reentrant: importsRformValue(source),
                    default: hasDefaultExport(source)
                };
            })
        );

        addTemplate({
            filename: `${name}/utils.ts`,
            write: true,
            getContents: () => {
                // Os reentrantes vão para o fim: é isso que garante que o `export *`
                // de todo helper comum já rodou quando um deles volta pelo ciclo. Ver
                // "O `import` vem pareado com o próprio `export *`" no
                // `.claude/CLAUDE.md`.
                const ordered = [...helpers].sort(
                    (a, b) => Number(a.reentrant) - Number(b.reentrant)
                );

                const defaults = helpers.filter((helper) => helper.default).map(({ name }) => name);

                return [
                    // O `export *` é o que faz `import { defineRule } from
                    // "#rform/utils"` funcionar, e ele passa pelo `specifier()` para
                    // sair sem extensão; a linha de `import` mantém o `.ts` porque é
                    // caminho absoluto de disco, não specifier. Cada `import` vem
                    // colado ao `export *` do mesmo arquivo, e não em dois blocos —
                    // ver `ordered`, acima.
                    ordered
                        .map(({ name, path, default: own }) =>
                            [
                                own ? `import ${name} from "${path}"` : undefined,
                                `export * from ${specifier(path)}`
                            ]
                                .filter(Boolean)
                                .join("\n")
                        )
                        .join("\n"),
                    "",
                    "export {",
                    `   ${defaults.join(",\n   ")}`,
                    "}",
                    "",
                    "export default {",
                    `   ${defaults.join(",\n   ")}`,
                    "}"
                ].join("\n");
            }
        });

        // A única linha que o app escreve no CSS dele, e ela traz o `@source` dos
        // componentes mais os tokens. Template, e não um `.css` do `dist`, porque o
        // caminho sai absoluto e resolvido. Ver "A linha que o app escreve" no
        // `.claude/CLAUDE.md`.
        addTemplate({
            filename: `${name}/tailwind.css`,
            write: true,
            // `specifier` já devolve entre aspas, e com `/` — em CSS a barra
            // invertida do Windows seria escape.
            getContents: () =>
                [
                    "/* Sobrescreva `--rf-*` em `@layer rform` (ou o tema do app), nunca em `@theme`. */",
                    `@source ${specifier(roots.containers)};`,
                    `@import ${specifier(resolve("runtime/style.css"))};`
                ].join("\n")
        });

        nuxt.options.alias ||= {};

        // Registrado antes de `#rform`: o Vite casa aliases na ordem de inserção, e
        // o prefixo mais curto engoliria este. É o que deixa uma substituição
        // embrulhar o original em vez de reescrevê-lo.
        nuxt.options.alias[`#${name}/builtin`] = componentsPath;
        nuxt.options.alias[`#${name}/builtin/*`] = `${componentsPath}/*`;

        // O compiler-sfc só usa os `paths` do tsconfig que **inclui** o `.d.vue.ts`
        // em `node_modules`. Absoluto (o kit relativiza) e do mesmo `componentsPath`
        // do alias. Ver "O consumidor precisa incluir os `.d.vue.ts`" no CLAUDE.md.
        nuxt.hook("prepare:types", ({ tsConfig }) => {
            tsConfig.include ||= [];
            tsConfig.include.push(`${componentsPath}/**/*.d.vue.ts`);
        });

        const alias = `${nuxt.options.buildDir}/${name}`;

        // Alias **exato**, antes de `#rform/*`: sem extensão o resolver de CSS do Vite
        // não acha o arquivo, e o prefixo mais curto engoliria o caminho.
        nuxt.options.alias[`#${name}/tailwindcss`] = `${alias}/tailwind.css`;

        /**
         * Alias **exato**, e antes de `#rform/*`: o Vite casa aliases na ordem
         * de inserção, e o prefixo mais curto engoliria este.
         */
        nuxt.options.alias[`#${name}/translate`] = resolve(
            hasI18n ? "runtime/translate/bridge" : "runtime/translate/standalone"
        );

        nuxt.options.alias[`#${name}`] = alias;
        nuxt.options.alias[`#${name}/*`] = `${alias}/*`;

        // Um a um, não como diretório: o scanner do Nuxt pula todo arquivo sob um
        // caminho já varrido, então registrar `components/` deixaria `fields` e
        // `utils` vazios, sem erro nenhum.
        for (const component of containers) {
            addComponent({
                name: `R${component.name}`,
                filePath: filePath(component),
                preload: true,
                prefetch: true
            });
        }

        addComponentsDir({
            prefix: "R",
            pathPrefix: false,
            preload: true,
            prefetch: true,
            path: roots.fields
        });

        addComponentsDir({
            prefix: "RUtils",
            pathPrefix: false,
            preload: true,
            prefetch: true,
            path: roots.utils
        });

        // Prioridade maior que a dos embutidos, para um componente do usuário de
        // mesmo nome vencer todo `<RText>` do app — inclusive os que estão dentro dos
        // templates do próprio módulo.
        for (const [key, prefix] of [
            ["userFields", "R"],
            ["userUtils", "RUtils"]
        ] as const) {
            // As duas são opcionais, e registrar diretório ausente só rende um aviso.
            if (!listing[key]) {
                continue;
            }

            addComponentsDir({
                prefix,
                pathPrefix: false,
                preload: true,
                prefetch: true,
                priority: 10,
                path: roots[key]
            });
        }

        addImports({
            name: "default",
            as: "useRForm",
            from: resolve("runtime/composables/useRForm")
        });

        addVitePlugin(vitePlugin([roots.containers, roots.userFields, roots.userUtils]));
    }
});