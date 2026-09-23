import { fileURLToPath } from "node:url";

import { defineVitestProject } from "@nuxt/test-utils/config";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const fixtureRoot = fileURLToPath(new URL("./test/fixtures/basic", import.meta.url));
const rformAliasRoot = fileURLToPath(new URL("./test/fixtures/basic/.nuxt/rform", import.meta.url));
const appStub = fileURLToPath(new URL("./test/stubs/app.ts", import.meta.url));

export default defineConfig({
    test: {
        projects: [
            {
                plugins: [vue()],
                resolve: {
                    alias: {
                        // `useTranslate` reaches for `#app`, and this project runs
                        // with no Nuxt around — same reason every `#rform/*` below
                        // points at the fixture’s generated templates.
                        "#app": appStub,
                        "#rform/composables": `${rformAliasRoot}/composables.ts`,
                        "#rform/defaults": `${rformAliasRoot}/defaults.ts`,
                        "#rform/locales": `${rformAliasRoot}/locales.ts`,
                        "#rform/masks": `${rformAliasRoot}/masks.ts`,
                        "#rform/presets": `${rformAliasRoot}/presets.ts`,
                        "#rform/registry": `${rformAliasRoot}/registry.ts`,
                        // The engine the module falls back to. Aliasing it here
                        // is what keeps `preset.validation({ value })` callable
                        // with no build around — the property `defaultT` used
                        // to carry.
                        "#rform/translate": fileURLToPath(
                            new URL("./src/runtime/translate/standalone.ts", import.meta.url)
                        ),
                        "#rform/utils": `${rformAliasRoot}/utils.ts`,
                        "#rform/types/components/utils/props": `${rformAliasRoot}/types/components/utils/props.ts`,
                        "#rform/types/components/utils": `${rformAliasRoot}/types/components/utils/index.ts`,
                        "#rform/types/components": `${rformAliasRoot}/types/components/index.ts`,
                        "#rform/types/tr": `${rformAliasRoot}/types/tr.d.ts`,
                        "#rform/types": `${rformAliasRoot}/types/index.d.ts`
                    }
                },
                test: {
                    name: "unit",
                    include: ["test/unit/**/*.test.ts"],
                    environment: "node"
                }
            },
            await defineVitestProject({
                test: {
                    name: "nuxt",
                    include: ["test/nuxt/**/*.test.ts"],
                    setupFiles: ["./test/nuxt/setup.ts"],
                    environment: "nuxt",
                    environmentOptions: {
                        nuxt: {
                            rootDir: fixtureRoot,
                            domEnvironment: "happy-dom"
                        }
                    }
                }
            }),
            {
                test: {
                    name: "e2e",
                    include: ["test/e2e/**/*.test.ts"],
                    environment: "node",
                    testTimeout: 120_000,
                    hookTimeout: 120_000
                }
            }
        ],
        coverage: {
            provider: "v8",
            include: ["src/runtime/**"],
            exclude: ["**/*.d.ts", "src/runtime/components/utils/**"]
        }
    }
});