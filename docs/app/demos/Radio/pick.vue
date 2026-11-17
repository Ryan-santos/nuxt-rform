<template>
    <RRadio
        name="plano"
        label="demo.radio.plano"
        :options="planos"
        :pick="{ value: 'id', label: 'nome' }"
        :default="2"
    />
</template>

<script setup lang="ts">
    const planos = [
        { id: 1, nome: "Básico", preco: 29 },
        { id: 2, nome: "Equipe", preco: 79 },
        { id: 3, nome: "Empresa", preco: 199 }
    ];
</script>