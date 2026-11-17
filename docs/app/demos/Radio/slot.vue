<template>
    <RRadio
        v-slot="{ option, checked }"
        name="planoDetalhado"
        label="demo.radio.plano"
        :options="planos"
        :pick="{ value: 'id', label: 'nome' }"
    >
        <span class="flex flex-row items-baseline gap-2">
            <span :class="checked && 'font-semibold'">{{ option.label }}</span>
            <span class="text-xs text-contrast/50">{{
                $t("demo.radio.porMes", { preco: option.original.preco })
            }}</span>
        </span>
    </RRadio>
</template>

<script setup lang="ts">
    const planos = [
        { id: 1, nome: "Básico", preco: 29 },
        { id: 2, nome: "Equipe", preco: 79 },
        { id: 3, nome: "Empresa", preco: 199 }
    ];
</script>