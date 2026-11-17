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

        <!-- sem `options`, o checkbox é booleano -->
        <RCheckbox
            name="aceite"
            @update:model-value="takesBoolean"
        />

        <!-- com `options`, a lista dos valores marcados -->
        <RCheckbox
            v-slot="{ option }"
            name="dias"
            :options="planos"
            :pick="{ value: 'id', label: 'nome' }"
            :default="[1]"
            @update:model-value="takesNumbers"
        >
            {{ takesString(option.label) }}
        </RCheckbox>

        <!-- @vue-expect-error -->
        <RCheckbox
            name="listaComoBooleano"
            :options="['a', 'b']"
            @update:model-value="takesBoolean"
        />

        <!-- a lista do RPassword aceita qualquer rule -->
        <RPassword
            name="senha"
            :checklist="[
                { label: '~~Oito', rule: { name: 'min', min: 8 } },
                { label: '~~Maiúscula', rule: { name: 'regex', pattern: '[A-Z]' } }
            ]"
            :generate="{ length: 20 }"
            @generate="takesString"
        />

        <!-- @vue-expect-error — `regex` exige `pattern` -->
        <RPassword
            name="semPattern"
            :checklist="[{ label: '~~X', rule: { name: 'regex' } }]"
        />
    </div>
</template>

<script setup lang="ts">
    /**
     * Guarda de tipo do `RRadio`, do `RCheckbox` e da lista do `RPassword`, do lugar
     * de quem consome — o `vue-tsc` da fixture a executa, como a `SelectTypes.vue`.
     */
    type Plano = { id: number; nome: string };

    const planos: Plano[] = [{ id: 1, nome: "Básico" }];

    const takesNumber = (value: number | null) => value;
    const takesNumbers = (value: number[]) => value.length;
    const takesString = (value: string) => value;
    const takesBoolean = (value: boolean) => value;
    const takesPlano = (value: Plano) => value.nome;
    const takesColor = (value: "blue" | "red") => value;
</script>