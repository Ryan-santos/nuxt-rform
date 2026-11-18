<template>
    <RArray
        v-slot="{ index }"
        name="prioridades"
        label="demo.array.prioridades"
        sortable
        :default="['Nuxt', '', 'Vite']"
    >
        <RText
            :name="index"
            placeholder="demo.array.prioridade"
            rule="required"
        />
    </RArray>
</template>