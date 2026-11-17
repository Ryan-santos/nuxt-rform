<template>
    <RCheckbox
        v-slot="{ option, checked }"
        name="interesses"
        label="demo.checkbox.interesses"
        :options="interesses"
        :pick="{ value: 'id', label: 'nome' }"
        :default="[]"
    >
        <span class="flex flex-col">
            <span :class="checked && 'font-semibold'">{{ option.label }}</span>
            <span class="text-xs text-contrast/50">{{ option.original.descricao }}</span>
        </span>
    </RCheckbox>
</template>

<script setup lang="ts">
    const interesses = [
        { id: "front", nome: "Front-end", descricao: "Vue, Nuxt, CSS" },
        { id: "back", nome: "Back-end", descricao: "Nitro, bancos, filas" },
        { id: "infra", nome: "Infra", descricao: "Deploy, observabilidade" }
    ];
</script>