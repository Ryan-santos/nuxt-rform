<template>
    <RSelect
        name="cidade"
        label="demo.select.cidade"
        placeholder="demo.common.selecione"
        :options
        :loading
        :pick="{ value: 'id', label: 'name' }"
        @search="buscar"
    />
</template>

<script setup lang="ts">
    type Cidade = {
        id: number;
        name: string;
        uf: string;
    };

    // Faz as vezes do servidor. Ele casa o termo com o nome **e** com a UF, que é
    // o que justifica o `@search`: digitando "BA" o filtro local não devolveria
    // nada, porque "BA" não está no rótulo de nenhuma delas.
    const acervo: Cidade[] = [
        { id: 1, name: "São Paulo", uf: "SP" },
        { id: 2, name: "Campinas", uf: "SP" },
        { id: 3, name: "Santos", uf: "SP" },
        { id: 4, name: "Rio de Janeiro", uf: "RJ" },
        { id: 5, name: "Niterói", uf: "RJ" },
        { id: 6, name: "Belo Horizonte", uf: "MG" },
        { id: 7, name: "Uberlândia", uf: "MG" },
        { id: 8, name: "Salvador", uf: "BA" },
        { id: 9, name: "Feira de Santana", uf: "BA" },
        { id: 10, name: "Recife", uf: "PE" }
    ];

    const consultar = (term: string) => {
        const query = term.trim().toLowerCase();

        if (!query) {
            return acervo.slice(0, 5);
        }

        return acervo.filter(({ name, uf }) => {
            return `${name} ${uf}`.toLowerCase().includes(query);
        });
    };

    const options = ref(consultar(""));
    const loading = ref(false);

    let timer: ReturnType<typeof setTimeout> | undefined;

    // O debounce mora aqui, e não no campo: quanto esperar depende da rota que
    // responde, não do componente que digita.
    const buscar = (term: string) => {
        clearTimeout(timer);
        loading.value = true;

        timer = setTimeout(() => {
            options.value = consultar(term);
            loading.value = false;
        }, 400);
    };

    onUnmounted(() => clearTimeout(timer));
</script>