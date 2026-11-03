import { defineConfig } from "oxfmt";

export default defineConfig({
    // O tema do shiki é copiado do `.vsix`, não escrito aqui — reformatá-lo só
    // produziria diff a cada atualização. Isto já morou num `.prettierignore`, que
    // o oxfmt lia por default — o arquivo saiu, a regra ficou. O `CHANGELOG.md` é
    // do `changelogen`, pelo mesmo motivo.
    ignorePatterns: ["docs/app/assets/shiki/*.json", "CHANGELOG.md"],

    tabWidth: 4,
    singleQuote: false,
    semi: true,
    trailingComma: "none",
    insertFinalNewline: false,
    singleAttributePerLine: true,
    vueIndentScriptAndStyle: true,
    sortImports: true,

    // O default reordena as chaves de topo e os `keywords` do `package.json`.
    sortPackageJson: false,

    overrides: [
        {
            // Bloco de código em markdown é recorte, não arquivo: formatado como
            // arquivo, um `container: "…"` ganha `;` e fica inválido. Fica aqui, e
            // não na raiz, porque na raiz desligaria também o `<script>` dos `.vue`.
            files: ["**/*.md"],
            options: { embeddedLanguageFormatting: "off" }
        }
    ]
});