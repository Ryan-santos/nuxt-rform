<template>
    <div>
        <!-- array de objetos: o model é `item[pick.value]` -->
        <RRadio
            v-slot="{ option }"
            name="plano"
            :options="planos"
            :pick="{ value: 'id', label: 'nome' }"
            :default="1"
            @update:model-value="takesNumber"
        >
            {{ takesString(option.label) }}
            {{ takesPlano(option.original) }}
        </RRadio>

        <!-- objeto: o valor é a chave -->
        <RRadio
            name="cor"
            :options="{ blue: 'azul', red: 'vermelho' }"
            @update:model-value="takesColor"
        />

        <!-- @vue-expect-error -->
        <RRadio
            name="tipoErrado"
            :options="planos"
            :pick="{ value: 'id' }"
            @update:model-value="takesString"
        />
    </div>
</template>

<script setup lang="ts">
    /**
     * Guarda de tipo do `RRadio`, do lugar de quem consome — o `vue-tsc` da fixture
     * a executa, como a `SelectTypes.vue`.
     */
    type Plano = { id: number; nome: string };

    const planos: Plano[] = [{ id: 1, nome: "Básico" }];

    const takesNumber = (value: number | null) => value;
    const takesString = (value: string) => value;
    const takesPlano = (value: Plano) => value.nome;
    const takesColor = (value: "blue" | "red") => value;
</script>