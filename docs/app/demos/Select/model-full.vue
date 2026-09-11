<template>
    <RSelect
        name="usuarioValor"
        label="demo.select.semModelFull"
        placeholder="demo.common.selecione"
        :options="users"
        :pick="{ value: 'id', label: 'name' }"
    />
    <RSelect
        v-slot="{ selected }"
        name="usuarioFull"
        label="demo.select.comModelFull"
        placeholder="demo.common.selecione"
        :options="users"
        :pick="{ value: 'id', label: 'name' }"
        model-full
    >
        <img
            :src="selected.original.picture"
            class="block size-5 rounded-full bg-primary"
        />
        <p>{{ selected.label }}</p>
    </RSelect>
</template>

<script setup lang="ts">
    const users = [
        {
            id: 1,
            name: "João Silva",
            role: "Suporte",
            picture: "https://randomuser.me/api/portraits/men/1.jpg"
        },
        {
            id: 2,
            name: "Maria Souza",
            role: "Financeiro",
            picture: "https://randomuser.me/api/portraits/women/2.jpg"
        },
        {
            id: 3,
            name: "Pedro Santos",
            role: "Comercial",
            picture: "https://randomuser.me/api/portraits/men/3.jpg"
        },
        {
            id: 4,
            name: "Ana Oliveira",
            role: "Diretoria",
            picture: "https://randomuser.me/api/portraits/women/4.jpg"
        }
    ];
</script>