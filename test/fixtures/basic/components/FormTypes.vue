<template>
    <div>
        <!-- o `T` sai do `v-model`: o `data` do `@submit` é o tipo do model -->
        <RForm
            v-model="cadastro"
            @submit="(data) => takesString(data.nome)"
        >
            <RText name="nome" />
        </RForm>

        <!-- handler declarado: o parâmetro e o `v-model` concordam -->
        <RForm
            v-model="cadastro"
            @submit="salvar"
        >
            <RText name="nome" />
        </RForm>

        <!-- o `default` também é o tipo do model -->
        <RForm
            v-model="cadastro"
            :default="{ nome: 'Ana' }"
        >
            <RText name="nome" />
        </RForm>

        <!-- handler que espera outro model não passa -->
        <!-- @vue-expect-error -->
        <RForm
            v-model="cadastro"
            @submit="salvarOutro"
        >
            <RText name="nome" />
        </RForm>

        <!-- `default` de outra forma não passa -->
        <!-- @vue-expect-error -->
        <RForm
            v-model="cadastro"
            :default="{ codigo: 1 }"
        >
            <RText name="nome" />
        </RForm>
    </div>
</template>

<script setup lang="ts">
    /**
     * Guarda de tipo do `RForm`, escrita do lugar de quem consome: é o `vue-tsc`
     * da fixture que a executa. O generic do model tem de chegar ao `data` do
     * `@submit` e ao `default`.
     */
    import type Components from "#rform/types/components";

    type Cadastro = { nome: string };
    type Outro = { codigo: number };

    const { data: cadastro } = useRForm<Cadastro>();

    // Corpo em bloco, e não `=> void value`: um handler cujo retorno inferido é
    // exatamente `undefined` escapa da checagem do `@evento` — ver "Callback é
    // `@evento`" no `.claude/CLAUDE.md`.
    const takesString = (value: string) => {
        console.warn(value);
    };
    const takesNumber = (value: number) => {
        console.warn(value);
    };
    const salvar = (data: Cadastro) => takesString(data.nome);
    const salvarOutro = (data: Outro) => takesNumber(data.codigo);

    // O `Props` do Form só tem o que ele usa: nenhuma chave de campo do `Element`.
    // @ts-expect-error `rule` não existe no Form
    type _SemRule = Components["Form"]["rule"];
</script>