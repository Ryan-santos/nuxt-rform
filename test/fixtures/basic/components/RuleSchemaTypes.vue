<template>
    <div>
        <RText
            name="pedido"
            :rule="{ name: 'schema', schema: { type: 'string', pattern: '^PED-' } }"
        />

        <RText
            name="pedido"
            :rule="{ name: 'schema', schema: true, message: 'Formato inválido.' }"
        />

        <!-- @vue-expect-error -->
        <RText
            name="pedido"
            :rule="{ name: 'schema' }"
        />

        <!-- @vue-expect-error -->
        <RText
            name="pedido"
            :rule="{ name: 'schema', schema: { type: 'string' }, message: 1 }"
        />
    </div>
</template>

<script setup lang="ts">
    /**
     * Guarda de tipo do preset `schema`: o `schema` é obrigatório e o `message` é
     * texto. Executada pelo `vue-tsc` da fixture.
     */
</script>