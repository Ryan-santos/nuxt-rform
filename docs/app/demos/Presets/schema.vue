<template>
    <RText
        name="pedido"
        label="~~pedido"
        :rule="pedido"
    />
    <RNumber
        name="quantidade"
        label="~~quantidade"
        :rule="quantidade"
    />
</template>

<script setup lang="ts">
    // Como viria da API: JSON puro, sem preset novo no front.
    const pedido = {
        name: "schema",
        schema: { type: "string", pattern: "^PED-[0-9]{6}$" },
        message: "~~PED-000000"
    } as const;

    const quantidade = {
        name: "schema",
        schema: { type: "integer", minimum: 1, maximum: 999 }
    } as const;
</script>