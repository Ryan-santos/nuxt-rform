<template>
    <RSelect
        name="multiplo"
        label="demo.select.variosIds"
        placeholder="demo.select.funcionarios"
        :options="users"
        :pick="{ value: 'id', label: 'name' }"
        multiple
    />
    <RSelect
        v-slot="{ selected, list }"
        name="multiploFull"
        label="demo.select.variosObjetos"
        placeholder="demo.select.funcionarios"
        :options="users"
        :pick="{ value: 'id', label: 'name' }"
        multiple
        model-full
    >
        <template
            v-for="item in selected"
            :key="String(item.value)"
        >
            <img
                :src="item.original?.picture"
                class="block size-5 rounded-full bg-primary"
            />
            <p v-if="list">
                {{ item.label }}
            </p>
        </template>
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