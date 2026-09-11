<template>
    <RSelect
        name="comResolve"
        label="demo.select.jaVemEscolhido"
        placeholder="demo.common.selecione"
        :options="buscar"
        :resolve="traduzir"
        :default="317"
        :pick="{ value: 'id', label: 'name' }"
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

    const buscar = ({ search, page }: { search: string; page: number }) => {
        const query = search.trim().toLowerCase();

        const casados = query
            ? acervo.filter(({ name }) => name.toLowerCase().includes(query))
            : acervo;

        return casados.slice((page - 1) * PAGE, page * PAGE);
    };

    // O 317 não está na primeira página, então sem `resolve` o campo abriria
    // mostrando o id cru até alguém rolar até ele.
    const traduzir = ({ value }: { value: unknown }) =>
        acervo.filter((usuario) => usuario.id === Number(value));
</script>