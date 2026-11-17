<template>
    <div class="overflow-x-auto rounded-xl border border-contrast/10 bg-background-50">
        <table class="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
                <tr>
                    <th
                        v-for="head in heads"
                        :key="head"
                        class="border-b border-contrast/15 px-3 py-2 text-xs font-bold tracking-widest text-contrast/50 uppercase"
                    >
                        {{ head }}
                    </th>
                </tr>
            </thead>

            <tbody>
                <tr
                    v-for="row in rows"
                    :key="row.alias"
                    class="align-middle"
                >
                    <td class="border-b border-contrast/5 px-3 py-2">
                        <Icon
                            :name="row.alias"
                            class="size-5 text-contrast/80"
                        />
                    </td>

                    <td class="border-b border-contrast/5 px-3 py-2">
                        <code class="font-mono text-xs font-medium text-primary">{{
                            row.alias
                        }}</code>
                    </td>

                    <td class="border-b border-contrast/5 px-3 py-2">
                        <code class="font-mono text-xs text-contrast/60">{{ row.target }}</code>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup lang="ts">
    /**
     * Os aliases `rform:*` que o módulo registra no `@nuxt/icon`, lidos da config em
     * runtime: a lista não tem como divergir do `module.ts`.
     *
     * @example ::icons-table
     */
    const { t, locale } = useI18n();

    // Sem chave nova no pack: cada uma alarga o `TrInput` do site, que já está no
    // limite do TS2590 nos `withDefaults` dos campos.
    const heads = computed(() => [
        locale.value === "pt" ? "ícone" : "icon",
        "alias",
        t("ui.propDefault")
    ]);

    const aliases = (useAppConfig().icon as { aliases?: Record<string, string> } | undefined)
        ?.aliases;

    const rows = Object.entries(aliases ?? {})
        .filter(([alias]) => alias.startsWith("rform:"))
        .map(([alias, target]) => ({ alias, target }));
</script>