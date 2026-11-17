<template>
    <div>
        <!-- `null` numa folha de classe zera a camada, sem cast -->
        <RText
            name="a"
            :ui="{ container: null, group: { wrapper: { container: null } } }"
        />

        <!-- `[null, "…"]`: zera e põe classe nova no mesmo valor -->
        <RText
            name="d"
            :ui="{ container: [null, 'grid gap-2'] }"
        />

        <!-- e alcança o util pelo `ui.Utils` do campo -->
        <RText
            name="b"
            :ui="{ Utils: { Placeholder: { notFilled: null } } }"
        />

        <!-- grupo não aceita `null`: o template lê através dele -->
        <!-- @vue-expect-error -->
        <RText
            name="c"
            :ui="{ group: null }"
        />
    </div>
</template>

<script setup lang="ts">
    import { defineFieldDefaults } from "#rform/utils";

    // o mesmo vale no arquivo de defaults do app
    defineFieldDefaults({
        Text: { ui: { container: [null, "grid"], group: { field: { input: null } } } },
        Utils: { Placeholder: { ui: { default: null } } }
    });

    defineFieldDefaults({
        // @ts-expect-error grupo não aceita `null`
        Text: { ui: { group: null } }
    });
</script>