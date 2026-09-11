<template>
    <div>
        <!-- array de objetos: `value` é `item[pick.value]`, `original` é o item -->
        <RSelect
            v-slot="{ selected }"
            name="porValor"
            :options="users"
            :pick="{ value: 'id', label: 'name' }"
            :default="1"
            @update:model-value="takesNumber"
        >
            {{ takesNumber(selected.value) }}
            {{ takesString(selected.label) }}
            {{ takesUser(selected.original) }}
        </RSelect>

        <!-- `modelFull`: o item inteiro é o que vai ao model -->
        <RSelect
            name="porItem"
            :options="users"
            :pick="{ value: 'id' }"
            model-full
            :default="users[0]"
            @update:model-value="takesUser"
        />

        <!-- `multiple` embrulha em lista, dos dois lados -->
        <RSelect
            name="varios"
            :options="users"
            :pick="{ value: 'id' }"
            multiple
            :default="[1, 2]"
            @update:model-value="takesNumbers"
        />

        <!-- array de primitivos: o item é o próprio valor -->
        <RSelect
            v-slot="{ selected }"
            name="primitivo"
            :options="['pequeno', 'grande']"
            @update:model-value="takesString"
        >
            {{ takesString(selected.value) }}
        </RSelect>

        <!-- objeto: o valor é a chave, o label é o valor -->
        <RSelect
            v-slot="{ selected }"
            name="objeto"
            :options="{ blue: 'azul', red: 'vermelho' }"
            @update:model-value="takesColor"
        >
            {{ takesColor(selected.value) }}
            {{ takesString(selected.label) }}
        </RSelect>

        <!-- caminho pontilhado não é `keyof`: o valor volta a ser `unknown` -->
        <RSelect
            v-slot="{ selected }"
            name="aninhado"
            :options="nested"
            :pick="{ value: 'owner.id', label: 'name' }"
            @update:model-value="takesUnknown"
        >
            {{ takesUnknown(selected.value) }}
        </RSelect>

        <!-- o `pick` inline preserva o literal, como o `key-value` de antes -->
        <RSelect
            v-slot="{ selected }"
            name="pickInline"
            :options="users"
            :pick="{ value: 'role' }"
            @update:model-value="takesString"
        >
            {{ takesString(selected.value) }}
        </RSelect>

        <!-- propriedade de objeto alarga, e aí a falha é alta: sem `as const` o
             `KeyValue` cai no default `"id"` e o objeto não é atribuível -->
        <!-- @vue-expect-error -->
        <RSelect
            name="pickSolto"
            :options="users"
            :pick="pickSolto"
        />

        <!-- com `as const` o literal sobrevive à variável -->
        <RSelect
            v-slot="{ selected }"
            name="pickConst"
            :options="users"
            :pick="pickConst"
            @update:model-value="takesNumber"
        >
            {{ takesNumber(selected.value) }}
        </RSelect>

        <!-- `options` em função: o generic sai da posição de retorno -->
        <RSelect
            v-slot="{ selected }"
            name="remoto"
            :options="buscar"
            :pick="{ value: 'id', label: 'name' }"
            @update:model-value="takesNumber"
        >
            {{ takesNumber(selected.value) }}
            {{ takesUser(selected.original) }}
        </RSelect>

        <!-- …e do `items` do envelope, quando a API manda o total -->
        <RSelect
            v-slot="{ selected }"
            name="remotoComTotal"
            :options="buscarComTotal"
            :pick="{ value: 'id', label: 'name' }"
            @update:model-value="takesNumber"
        >
            {{ takesNumber(selected.value) }}
            {{ takesUser(selected.original) }}
        </RSelect>

        <!-- o valor não é mais `unknown`: uma chave de outro tipo não passa -->
        <!-- @vue-expect-error -->
        <RSelect
            name="tipoErrado"
            :options="users"
            :pick="{ value: 'id' }"
            @update:model-value="takesString"
        />

        <!-- @vue-expect-error -->
        <RSelect
            name="defaultErrado"
            :options="users"
            :pick="{ value: 'id' }"
            :default="'um'"
        />

        <!-- sem `multiple` o model não é lista -->
        <!-- @vue-expect-error -->
        <RSelect
            name="listaSemMultiple"
            :options="users"
            :pick="{ value: 'id' }"
            :default="[1]"
        />
    </div>
</template>

<script setup lang="ts">
    /**
     * Guarda de tipo do `RSelect`, escrita do lugar de quem consome: é o `vue-tsc`
     * da fixture que a executa. Ver a issue #4 — o generic de `options` tem de
     * chegar ao model, ao `default` e ao slot.
     */
    type User = { id: number; name: string; role: string };

    const users: User[] = [{ id: 1, name: "Ana", role: "Suporte" }];

    const nested = [{ name: "Ana", owner: { id: 1 } }];

    // Propriedade de objeto alarga para `string`, e aí não há candidato de
    // inferência: `KeyValue` cai no default `"id"` e o objeto deixa de ser
    // atribuível. Falha alta, e é o mesmo que o `key-value` de antes já fazia com
    // uma string alargada. O `as const` do vizinho é a saída.
    const pickSolto = { value: "id", label: "name" };
    const pickConst = { value: "id", label: "name" } as const;

    const buscar = async () => users;
    const buscarComTotal = async () => ({ items: users, total: users.length });

    const takesNumber = (value: number) => value;
    const takesNumbers = (value: number[]) => value.length;
    const takesString = (value: string) => value;
    const takesUser = (value: User) => value.name;
    const takesColor = (value: "blue" | "red") => value;
    const takesUnknown = (value: unknown) => String(value);
</script>