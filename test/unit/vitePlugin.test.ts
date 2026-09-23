import { describe, expect, it } from "vitest";

import injector from "../../src/vite.plugin";

/**
 * O plugin escreve o argumento que o componente não repete — o `injected`, com o
 * nome do próprio arquivo e o `defaults` que ele exporta. É o que mantém `useField`
 * e `useUtil` síncronas — ver "O `RForm` não pode ser async" no `.claude/CLAUDE.md`.
 */

const ROOT = "C:/repo/src/runtime/components";

const plugin = injector([ROOT, "C:/app/rform"]);

const transform = (code: string, id: string) => {
    const hook = plugin.transform as unknown as (
        code: string,
        id: string
    ) => { code: string } | undefined;

    return hook(code, id)?.code;
};

/** O bloco que todo campo e todo util tem, e de onde o plugin lê o identificador. */
const withDefaults = (body: string) =>
    ["export const defaults = defineDefaults({ ui: {} });", body].join("\n");

describe("o plugin injeta defaults e nome", () => {
    it("põe os dois no useField de um argumento", () => {
        const out = transform(
            withDefaults("const { model } = useField(_props);"),
            `${ROOT}/fields/Text.vue`
        );

        expect(out).toContain(`useField(_props, undefined, { name: "Text", defaults })`);
    });

    it("preserva o `opts` e entra depois dele", () => {
        const out = transform(
            withDefaults("const { model } = useField(_props, { get });"),
            `${ROOT}/fields/Number.vue`
        );

        expect(out).toContain(`useField(_props, { get }, { name: "Number", defaults })`);
    });

    it("preserva a lista de tipos do useUtil, que roda antes do plugin do Vue", () => {
        const out = transform(
            withDefaults("const { props } = useUtil<Props>();"),
            `${ROOT}/utils/Label.vue`
        );

        expect(out).toContain(`useUtil<Props>({ name: "Label", defaults })`);
    });

    // A forma antiga, em que o `defaults` era o primeiro argumento: continua rodando,
    // e só o type-check se perde. Ver "Ele injeta o `defaults`" no `.claude/CLAUDE.md`.
    it("leva um defaults escrito à mão para dentro do objeto", () => {
        const out = transform(
            withDefaults("const { props } = useUtil<Props>(meus);"),
            `${ROOT}/utils/Label.vue`
        );

        expect(out).toContain(`useUtil<Props>({ name: "Label", defaults: meus })`);
    });

    // Falhar aqui seria inventar um requisito que o registry nunca impôs: sem o
    // export, a chave não sai e a composable cai no `{}` de sempre.
    it("omite a chave quando o arquivo não declara defaults", () => {
        const out = transform(
            "const { model } = useField(_props);",
            "C:/app/rform/fields/Rating.vue"
        );

        expect(out).toContain(`useField(_props, undefined, { name: "Rating" })`);
        expect(out).not.toContain("defaults");
    });

    it("não toca num `.vue` fora das raízes", () => {
        const out = transform(
            withDefaults("const { model } = useField(_props);"),
            "C:/repo/app/components/Outro.vue"
        );

        expect(out).toBeUndefined();
    });

    // A vírgula de dentro do `//` já estourou a contagem uma vez, e aí o nome não
    // era injetado e o campo morria no `throw` do `useField`.
    it("não conta a vírgula que mora num comentário do `opts`", () => {
        const out = transform(
            withDefaults(
                [
                    "const { model } = useField(_props, {",
                    "    // normaliza para lista, sempre",
                    "    get(value) {",
                    "        return value;",
                    "    }",
                    "});"
                ].join("\n")
            ),
            `${ROOT}/fields/File.vue`
        );

        expect(out).toContain(`}, { name: "File", defaults })`);
    });

    it("reescreve as duas chamadas quando o arquivo tem mais de uma", () => {
        const out = transform(
            withDefaults(["useField(_props);", "useField(_other);"].join("\n")),
            `${ROOT}/fields/Text.vue`
        );

        expect(out).toContain(`useField(_props, undefined, { name: "Text", defaults })`);
        expect(out).toContain(`useField(_other, undefined, { name: "Text", defaults })`);
    });
});