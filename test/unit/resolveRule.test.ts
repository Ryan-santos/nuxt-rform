import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import resolveRule from "../../src/runtime/utils/resolveRule";

const rules = {
    required: {
        validation: ({ value }: { value: unknown }) => (value ? undefined : "obrigatório")
    },
    min: {
        validation: ({ value, min }: { value: unknown; min: number }) =>
            String(value).length >= min ? undefined : `mínimo ${min}`
    },
    onlyText: {
        available: ["text"],
        validation: () => undefined
    },
    slow: {
        validation: async ({ value }: { value: unknown }) => {
            await Promise.resolve();
            return value === "ok" ? undefined : "assíncrono falhou";
        }
    }
};

describe("resolveRule", () => {
    it("devolve undefined quando nenhuma rule é passada", () => {
        expect(resolveRule(undefined, rules)).toBeUndefined();
        expect(resolveRule(null, rules)).toBeUndefined();
    });

    it("resolve um preset pelo nome, repassando value e form num contexto só", async () => {
        const seen: unknown[] = [];
        const spy = {
            spy: {
                validation: (context: unknown) => {
                    seen.push(context);
                    return undefined;
                }
            }
        };

        const form = { nome: "ana" };
        await resolveRule("spy", spy)!("ana", form);

        expect(seen).toEqual([{ value: "ana", form }]);
    });

    it("devolve a mensagem de um preset que falha", async () => {
        expect(await resolveRule("required", rules)!("", {})).toBe("obrigatório");
        expect(await resolveRule("required", rules)!("ana", {})).toBeUndefined();
    });

    it("repassa os args nomeados da forma de objeto", async () => {
        const rule = resolveRule({ name: "min", min: 3 }, rules)!;

        expect(await rule("ab", {})).toBe("mínimo 3");
        expect(await rule("abc", {})).toBeUndefined();
    });

    it("nunca deixa um arg sombrear value nem form", async () => {
        const seen: unknown[] = [];
        const spy = {
            spy: {
                validation: (context: unknown) => {
                    seen.push(context);
                    return undefined;
                }
            }
        };

        await resolveRule({ name: "spy", value: "roubado", form: "roubado" }, spy)!("real", {
            id: 1
        });

        expect(seen).toEqual([{ value: "real", form: { id: 1 } }]);
    });

    it("aguarda um preset async", async () => {
        expect(await resolveRule("slow", rules)!("nope", {})).toBe("assíncrono falhou");
    });

    it("aceita uma função simples, chamada com o mesmo contexto", async () => {
        const rule = resolveRule(
            ({ value }: { value: unknown }) => (value === 1 ? undefined : "não é 1"),
            rules
        )!;

        expect(await rule(2, {})).toBe("não é 1");
        expect(await rule(1, {})).toBeUndefined();
    });

    it("entrega o form a uma função simples também", async () => {
        const rule = resolveRule(
            ({ value, form }: { value: unknown; form: { pais?: string } }) =>
                form?.pais === "BR" || value === "livre" ? undefined : "só no BR",
            rules
        )!;

        expect(await rule("x", { pais: "PT" })).toBe("só no BR");
        expect(await rule("x", { pais: "BR" })).toBeUndefined();
    });

    it("aceita um schema zod e devolve a mensagem do primeiro issue", async () => {
        const rule = resolveRule(z.string().min(3, "curto demais"), rules)!;

        expect(await rule("ab", {})).toBe("curto demais");
        expect(await rule("abc", {})).toBeUndefined();
    });

    it("roda um array em ordem e para na primeira falha", async () => {
        const rule = resolveRule(["required", { name: "min", min: 3 }], rules)!;

        expect(await rule("", {})).toBe("obrigatório");
        expect(await rule("ab", {})).toBe("mínimo 3");
        expect(await rule("abc", {})).toBeUndefined();
    });

    it("não põe tradutor nenhum no contexto", async () => {
        let seen: Record<string, unknown> | undefined;

        const rules = {
            spy: {
                validation: (context: Record<string, unknown>) => {
                    seen = context;
                }
            }
        };

        const resolved = resolveRule("spy", rules as never, "text")!;

        await resolved("ana", {});

        expect(seen).toEqual({ value: "ana", form: {} });
    });

    describe("message", () => {
        it("troca a mensagem do preset quando ele falha", async () => {
            const rule = resolveRule({ name: "required", message: "Escreva o motivo." }, rules)!;

            expect(await rule("", {})).toBe("Escreva o motivo.");
            expect(await rule("ana", {})).toBeUndefined();
        });

        it("passa pelo tr, como label e error", async () => {
            const rule = resolveRule(
                { name: "required", message: "rform.presets.rules.required" },
                rules
            )!;

            expect(await rule("", {})).toBe("Campo obrigatório.");
        });

        it("aceita a forma { key, params }", async () => {
            const rule = resolveRule(
                {
                    name: "min",
                    min: 3,
                    message: { key: "rform.presets.rules.min.length", params: { min: 3 } }
                },
                rules
            )!;

            expect(await rule("ab", {})).toBe("Mínimo de 3 caracteres.");
        });

        it("é reservado: não chega à validation", async () => {
            const seen: unknown[] = [];
            const spy = {
                spy: {
                    validation: (context: unknown) => {
                        seen.push(context);
                        return undefined;
                    }
                }
            };

            await resolveRule({ name: "spy", message: "x", extra: 1 }, spy)!("ana", {});

            expect(seen).toEqual([{ extra: 1, value: "ana", form: {} }]);
        });

        it("vale só para o item do array onde foi escrito", async () => {
            const rule = resolveRule(
                ["required", { name: "min", min: 3, message: "Curto." }],
                rules
            )!;

            expect(await rule("", {})).toBe("obrigatório");
            expect(await rule("ab", {})).toBe("Curto.");
        });
    });

    it("lança nomeando o preset desconhecido", () => {
        expect(() => resolveRule("naoExiste", rules)).toThrowError(/naoExiste/);
    });

    it("avisa quando o preset não está disponível para o campo", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        resolveRule("onlyText", rules, "color");

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("onlyText"));

        warn.mockRestore();
    });

    it("não avisa quando o campo está listado como disponível", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        resolveRule("onlyText", rules, "text");

        expect(warn).not.toHaveBeenCalled();

        warn.mockRestore();
    });
});