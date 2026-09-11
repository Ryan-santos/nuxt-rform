import { fileURLToPath } from "node:url";

import { createPage, setup, url } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

const fixture = fileURLToPath(new URL("../fixtures/basic", import.meta.url));

describe("e2e browser: fixture basic", async () => {
    await setup({
        rootDir: fixture,
        browser: true
    });

    it("atualiza o model exibido quando se digita no input", async () => {
        const page = await createPage("/");
        await page.locator('input[name="name"]').fill("Ada");
        await page.waitForFunction(() => {
            const el = document.querySelector('[data-testid="name-value"]');
            return el?.textContent?.includes("Ada");
        });
        const text = await page.getByTestId("name-value").textContent();
        expect(text).toContain("Ada");
    });

    it("hidrata o painel do RSelect no lugar e o abre a partir do campo", async () => {
        const page = await createPage();

        // Guarda o nó que veio do servidor antes de qualquer script da página rodar:
        // se a hidratação recriasse o painel, o nó de depois seria outro.
        await page.addInitScript(() => {
            new MutationObserver((_, observer) => {
                const panel = document.querySelector("#teleports .RUtilsDropdown");
                if (panel) {
                    (window as Window & { __ssrPanel?: Element }).__ssrPanel = panel;
                    observer.disconnect();
                }
            }).observe(document, { childList: true, subtree: true });
        });
        await page.goto(url("/"), { waitUntil: "hydration" });

        const hydrated = await page.evaluate(() => {
            const panels = document.querySelectorAll("#teleports .RUtilsDropdown");
            return {
                count: panels.length,
                same:
                    panels[0] !== undefined &&
                    panels[0] === (window as Window & { __ssrPanel?: Element }).__ssrPanel
            };
        });
        expect(hydrated).toEqual({ count: 1, same: true });

        await page.locator('[data-testid="color-select"] > div').first().click();
        const options = page.locator('#teleports .RUtilsDropdown [role="option"]');
        await options.first().waitFor({ state: "visible" });

        expect(await options.allTextContents()).toEqual(["red", "green"]);
    });
});