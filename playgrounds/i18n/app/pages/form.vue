<template>
    <div class="flex flex-col gap-6">
        <Scenario
            title="todos os campos"
            :value="data"
        >
            <RForm
                v-model="data"
                class="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
                <RText
                    name="nome"
                    label="form.nome"
                    placeholder="form.nomeCompleto"
                    required
                    rule="required"
                />
                <RText
                    name="cpf"
                    label="form.cpf"
                    mask="brCpf"
                    rule="brCpf"
                />
                <RTextarea
                    name="descricao"
                    label="form.descricao"
                    length="140"
                    :rows="2"
                />
                <RNumber
                    name="numero"
                    label="form.numero"
                    :min="0"
                    :max="100"
                    :step="10"
                />
                <RSelect
                    name="uf"
                    label="form.uf"
                    placeholder="form.selecione"
                    :options="['SP', 'RJ', 'MG']"
                    search
                />
                <RDate
                    name="nascimento"
                    label="form.nascimento"
                />
                <RHour
                    name="hora"
                    label="~~Hora"
                />
                <RPin
                    name="codigo"
                    label="~~Código"
                    :separator="3"
                />
                <RColor
                    name="cor"
                    label="~~Cor"
                />
                <RFile
                    name="anexo"
                    label="~~Anexo"
                    accept="image/*, .pdf"
                    multiple
                    :max-files="3"
                />
                <RCalendar
                    name="agenda"
                    label="~~Agenda"
                    mode="range"
                />
                <RSwitch
                    name="aceite"
                    placeholder="form.aceiteTermos"
                />

                <RObject
                    name="endereco"
                    label="form.endereco"
                    class="md:col-span-2"
                >
                    <RText
                        name="cep"
                        label="form.cep"
                        mask="brCep"
                        rule="brCep"
                    />
                    <RText
                        name="rua"
                        label="form.rua"
                    />
                </RObject>

                <RArray
                    v-slot="{ index }"
                    name="emails"
                    label="form.email"
                    class="md:col-span-2"
                    :min="1"
                >
                    <RText
                        :name="index"
                        placeholder="form.emailExemplo"
                        rule="email"
                    />
                </RArray>

                <button
                    type="submit"
                    class="w-fit cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm text-white md:col-span-2"
                >
                    {{ $t("form.enviar") }}
                </button>
            </RForm>
        </Scenario>

        <Scenario
            title="select: os quatro formatos de options"
            :value="select"
        >
            <RForm
                v-model="select"
                class="flex flex-col gap-4"
            >
                <RSelect
                    name="primitivo"
                    label="~~array primitivo"
                    placeholder="form.selecione"
                    :options="['pequeno', 'médio', 'grande']"
                />

                <RSelect
                    v-slot="{ selected }"
                    name="cor"
                    label="~~objeto { chave: label }"
                    placeholder="form.selecione"
                    :options="{ blue: 'azul', red: 'vermelho', green: 'verde' }"
                >
                    <span
                        class="block size-3 rounded-full"
                        :style="`background-color: ${selected.value}`"
                    />
                    <p>{{ selected.label }}</p>
                </RSelect>

                <RSelect
                    v-slot="{ selected, list }"
                    name="responsavel"
                    label="~~single + modelFull, com slot"
                    placeholder="form.selecione"
                    :options="users"
                    :pick="{ value: 'id', label: 'name' }"
                    model-full
                >
                    <img
                        :src="selected.original.picture"
                        class="block size-5 rounded-full bg-primary"
                    />
                    <p>{{ selected.label }}</p>
                    <p
                        v-if="list"
                        class="ml-auto text-xs text-contrast/40"
                    >
                        {{ selected.original.role }}
                    </p>
                </RSelect>

                <RSelect
                    v-slot="{ selected, list }"
                    name="equipe"
                    label="~~multiple + modelFull"
                    placeholder="form.selecione"
                    :options="users"
                    :pick="{ value: 'id', label: 'name' }"
                    multiple
                    model-full
                >
                    <template
                        v-for="item in selected"
                        :key="String(item.value)"
                    >
                        <img
                            :src="item.original?.picture"
                            class="block size-5 rounded-full bg-primary"
                        />
                        <p v-if="list">
                            {{ item.label }}
                        </p>
                    </template>
                </RSelect>
            </RForm>
        </Scenario>

        <Scenario
            title="radio"
            :value="radio"
        >
            <RForm
                v-model="radio"
                class="flex flex-col gap-4"
            >
                <RRadio
                    name="tamanho"
                    label="form.tamanho"
                    :options="['P', 'M', 'G']"
                />
                <RRadio
                    name="plano"
                    label="form.plano"
                    :options="planos"
                    :pick="{ value: 'id', label: 'nome' }"
                />
                <RRadio
                    name="cor"
                    label="form.corFavorita"
                    :options="{ blue: 'azul', red: 'vermelho', green: 'verde' }"
                />
            </RForm>
        </Scenario>

        <Scenario
            title="checkbox"
            :value="checkbox"
        >
            <RForm
                v-model="checkbox"
                class="flex flex-col gap-4"
            >
                <RCheckbox
                    name="novidades"
                    placeholder="form.novidades"
                />
                <RCheckbox
                    name="dias"
                    label="form.dias"
                    :options="['seg', 'ter', 'qua', 'qui', 'sex']"
                />
            </RForm>
        </Scenario>

        <Scenario
            title="password"
            :value="password"
        >
            <RForm
                v-model="password"
                class="flex flex-col gap-4"
            >
                <RPassword
                    name="senha"
                    label="form.senha"
                    placeholder="form.senhaPlaceholder"
                    autocomplete="new-password"
                    strength
                    :generate="{ symbols: '@$!%*?&' }"
                    :checklist="requisitos"
                />

                <button
                    type="submit"
                    class="w-fit cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm text-white"
                >
                    {{ $t("form.enviar") }}
                </button>
            </RForm>
        </Scenario>
    </div>
</template>

<script setup lang="ts">
    import { ref } from "vue";

    import type { ChecklistItem } from "#rform/builtin/fields/Password.vue";

    const users = [
        {
            id: 1,
            name: "João Silva",
            role: "Suporte",
            picture: "https://randomuser.me/api/portraits/men/1.jpg"
        },
        {
            id: 2,
            name: "Maria Souza",
            role: "Financeiro",
            picture: "https://randomuser.me/api/portraits/women/2.jpg"
        },
        {
            id: 3,
            name: "Pedro Santos",
            role: "Comercial",
            picture: "https://randomuser.me/api/portraits/men/3.jpg"
        }
    ];

    const data = ref<Record<string, unknown>>({});

    const select = ref<Record<string, unknown>>({});

    const planos = [
        { id: 1, nome: "Básico" },
        { id: 2, nome: "Pro" },
        { id: 3, nome: "Empresa" }
    ];

    // Tipado pelo `ChecklistItem` do embutido: sem isso o `label` alarga para `string`,
    // e `TrInput` recusa.
    const requisitos: ChecklistItem[] = [
        { label: "form.requisitos.min", rule: { name: "min", min: 8 } },
        { label: "form.requisitos.minuscula", rule: { name: "regex", pattern: "[a-z]" } },
        { label: "form.requisitos.maiuscula", rule: { name: "regex", pattern: "[A-Z]" } },
        { label: "form.requisitos.numero", rule: { name: "regex", pattern: "[0-9]" } },
        { label: "form.requisitos.simbolo", rule: { name: "regex", pattern: "[@$!%*?&]" } },
        {
            label: "form.requisitos.permitidos",
            rule: { name: "regex", pattern: "^[A-Za-z0-9@$!%*?&]*$" }
        }
    ];

    const radio = ref<Record<string, unknown>>({});

    const checkbox = ref<Record<string, unknown>>({});

    const password = ref<Record<string, unknown>>({});
</script>