<template>
    <RSelect
        :modelValue="locale"
        :options="locales"
        :pick="{ value: 'code', label: 'name' }"
        :ui="{
            container: 'w-24',
            group: {
                field: {
                    selected: 'p-2 min-h-0',
                    text: 'text-xs'
                },
                icon: 'm-2'
            },
            Utils: {
                Dropdown: {
                    popover: 'w-30'
                }
            }
        }"
        aria-label="Idioma"
        @update:modelValue="setLocale"
    />
</template>

<script setup lang="ts">
    /**
     * Seletor de idioma do playground — é ele que exercita a ponte com o i18n do app.
     * O `pick.value` de `code` é o que faz o payload chegar tipado no `setLocale`, sem
     * cast e sem procurar o item de novo na lista (issue #4).
     */
    const { locale, locales, setLocale } = useI18n();
</script>