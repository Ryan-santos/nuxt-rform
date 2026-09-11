<template>
    <RSelect
        name="usuario"
        label="demo.select.funcionario"
        placeholder="demo.common.selecione"
        :options="buscar"
        :pick="{ value: 'id', label: 'name' }"
        search
    />
</template>

<script setup lang="ts">
    type Usuario = {
        id: number;
        name: string;
        email: string;
    };

    // O site é pré-renderizado, então o "servidor" mora aqui: 500 nomes gerados e
    // fatiados em páginas de 20. O `setTimeout` faz as vezes da latência.
    const acervo: Usuario[] = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        name: `Pessoa ${i + 1}`,
        email: `pessoa${i + 1}@exemplo.com`
    }));

    const PAGE = 20;

    // Casa o termo com o nome **e** com o e-mail: é o que justifica o filtro local
    // desistir quando `options` é função — filtrar de novo pelo rótulo esconderia
    // quem o servidor achou pelo e-mail.
    const consultar = (search: string, page: number) => {
        const query = search.trim().toLowerCase();

        const casados = query
            ? acervo.filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(query))
            : acervo;

        return casados.slice((page - 1) * PAGE, page * PAGE);
    };

    const buscar = ({ search, page }: { search: string; page: number }) =>
        new Promise<Usuario[]>((resolve) => {
            setTimeout(() => resolve(consultar(search, page)), 300);
        });
</script>