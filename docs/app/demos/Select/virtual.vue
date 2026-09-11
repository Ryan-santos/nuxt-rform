<template>
    <RSelect
        name="virtual"
        label="demo.select.listaLonga"
        placeholder="demo.common.selecione"
        :options="cidades"
        :pick="{ value: 'id', label: 'name' }"
        search
    />
</template>

<script setup lang="ts">
    // 5.000 opções estáticas: acima de 100 linhas a lista vira janela virtual
    // sozinha, e o painel passa a ter ~20 filhos em vez de 5.000. Abra o inspetor.
    const cidades = Array.from({ length: 5000 }, (_, i) => ({
        id: i + 1,
        name: `Cidade ${i + 1}`
    }));
</script>