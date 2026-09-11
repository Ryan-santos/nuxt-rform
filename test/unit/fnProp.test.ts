import { describe, expect, it } from "vitest";

import fnProp from "../../src/runtime/utils/fnProp";

describe("fnProp", () => {
    const fn = () => "chamou";

    it("devolve a função quando a prop crua não é um opt-out", () => {
        expect(fnProp<typeof fn>(fn, fn)).toBe(fn);
    });

    it("`false` cru recusa o default do app, mesmo com função mesclada", () => {
        expect(fnProp<typeof fn>(false, fn)).toBeUndefined();
    });

    it("a prop ausente deixa o default do app passar", () => {
        expect(fnProp<typeof fn>(undefined, fn)).toBe(fn);
    });

    it("valor mesclado que não é função vira `undefined` — é o `<RFile upload>` sem valor", () => {
        expect(fnProp<typeof fn>(true, true)).toBeUndefined();
        expect(fnProp<typeof fn>(undefined, "")).toBeUndefined();
        expect(fnProp<typeof fn>(undefined, undefined)).toBeUndefined();
    });
});