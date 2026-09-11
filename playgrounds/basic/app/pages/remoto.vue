<template>
    <div class="flex flex-col gap-6">
        <Scenario
            title="carrega rolando"
            :value="lista"
        >
            <RForm
                v-model="lista"
                class="flex flex-col gap-4"
            >
                <RSelect
                    name="responsavel"
                    label="usuarios.responsavel"
                    placeholder="form.selecione"
                    :options="buscar"
                    :pick="{ value: 'id', label: 'name' }"
                    search
                />
            </RForm>
        </Scenario>

        <Scenario
            title="abre preenchida"
            :value="edicao"
        >
            <RForm
                v-model="edicao"
                class="flex flex-col gap-4"
            >
                <RSelect
                    name="autor"
                    label="usuarios.autor"
                    placeholder="form.selecione"
                    :options="buscar"
                    :resolve="traduzir"
                    :pick="{ value: 'id', label: 'name' }"
                    search
                />
            </RForm>
        </Scenario>

        <Scenario
            title="multiple fixado"
            :value="revisao"
        >
            <RForm
                v-model="revisao"
                class="flex flex-col gap-4"
            >
                <RSelect
                    name="revisores"
                    label="usuarios.revisores"
                    placeholder="form.selecione"
                    :options="buscar"
                    :resolve="traduzir"
                    :pick="{ value: 'id', label: 'name' }"
                    multiple
                    search
                />
            </RForm>
        </Scenario>
    </div>
</template>

<script setup lang="ts">
    import { ref } from "vue";

    import type { OptionsContext, ResolveContext } from "#rform/types";

    type Usuario = {
        id: number;
        name: string;
        email: string;
    };

    // `page` é 1-based e a rota devolve array vazio no fim; o ciclo — debounce,
    // página, cancelamento pelo `signal` — é do campo, não daqui.
    const buscar = ({ search, page, signal }: OptionsContext) =>
        $fetch<Usuario[]>("/api/usuarios", { query: { search, page }, signal });

    // A rota devolve um item só, e o `resolve` espera `Options`: daí a lista de um.
    const traduzir = ({ value, signal }: ResolveContext) =>
        $fetch<Usuario>(`/api/usuarios/${value}`, { signal }).then((usuario) => [usuario]);

    const lista = ref<Record<string, unknown>>({});

    // O 317 não está na primeira página: sem `resolve` o campo abriria com o id cru.
    const edicao = ref<Record<string, unknown>>({ autor: 317 });

    const revisao = ref<Record<string, unknown>>({ revisores: [12, 148, 401] });
</script>