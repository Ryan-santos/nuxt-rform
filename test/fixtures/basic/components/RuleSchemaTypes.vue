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

        <RText
            name="pedido"
            :rule="comEnum"
        />

        <RText
            name="pedido"
            :rule="{ name: 'schema', schema: daApi }"
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

    // Readonly por `as const`, com `enum`: é a forma que um demo ensina.
    const comEnum = { name: "schema", schema: { type: "string", enum: ["a", "b"] } } as const;

    // Payload da API, sem os literais do JSON Schema.
    const daApi: Record<string, unknown> = { type: "string" };
</script>