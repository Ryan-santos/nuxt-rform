<template>
    <RSelect
        name="equipe"
        label="demo.select.equipe"
        placeholder="demo.common.selecione"
        :options="buscar"
        :pick="{ value: 'id', label: 'name' }"
        :default="[2, 5]"
        multiple
        search
    />
</template>

<script setup lang="ts">
    type Usuario = {
        id: number;
        name: string;
    };

    const acervo: Usuario[] = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        name: `Pessoa ${i + 1}`
    }));

    const PAGE = 20;

    // Marque mais alguns, busque por outro nome e role: o que está no model fica
    // no topo, e uma linha nunca muda de lugar enquanto o painel está aberto.
    const buscar = ({ search, page }: { search: string; page: number }) => {
        const query = search.trim().toLowerCase();

        const casados = query
            ? acervo.filter(({ name }) => name.toLowerCase().includes(query))
            : acervo;

        return casados.slice((page - 1) * PAGE, page * PAGE);
    };
</script>