<template>
    <div class="flex flex-col gap-6">
        <Scenario
            title="ui é DeepPartial"
            :value="data"
        >
            <RForm
                v-model="data"
                class="flex flex-col gap-4"
            >
                <RText
                    name="padrao"
                    label="Padrão"
                    placeholder="do jeito que o componente declara"
                />
                <RText
                    name="grande"
                    label="Com ui"
                    placeholder="input maior, resto intacto"
                    :ui="{
                        group: {
                            field: {
                                input: 'p-6 text-lg'
                            }
                        }
                    }"
                />
            </RForm>
        </Scenario>

        <Scenario
            title="null apaga"
            :value="data"
        >
            <RForm
                v-model="data"
                class="flex flex-col gap-4"
            >
                <RText
                    name="zerado"
                    label="Wrapper zerado"
                    placeholder="sem fundo, sem borda, sem anel"
                    :ui="semWrapper"
                />
                <RText
                    name="redesenhado"
                    label="Wrapper redesenhado"
                    placeholder="null primeiro, classe nova depois"
                    :ui="{
                        group: {
                            wrapper: {
                                container:
                                    'flex flex-row items-center rounded-none border-b-2 border-secondary'
                            }
                        }
                    }"
                />
            </RForm>
        </Scenario>

        <Scenario
            title="popover"
            :value="data"
        >
            <RForm
                v-model="data"
                class="flex flex-col gap-4"
            >
                <RSelect
                    name="medido"
                    label="Largura medida"
                    placeholder="w-(--width), do dropdownFit"
                    :options="['SP', 'RJ', 'MG']"
                />
                <RSelect
                    name="fixo"
                    label="Largura fixa"
                    placeholder="w-96 vence o w-(--width) no twMerge"
                    :options="['SP', 'RJ', 'MG']"
                    :ui="{
                        Utils: {
                            Dropdown: {
                                popover: 'w-96'
                            }
                        }
                    }"
                />
                <RSelect
                    name="teto"
                    label="Teto padrão"
                    placeholder="25rem, e encolhe à viewport"
                    :options="muitas"
                />
                <RSelect
                    name="tetoBaixo"
                    label="Teto de 10rem"
                    placeholder="[--max-height:10rem] substitui o de 25rem"
                    :options="muitas"
                    :ui="{
                        Utils: {
                            Dropdown: {
                                popover: '[--max-height:10rem]'
                            }
                        }
                    }"
                />
            </RForm>
        </Scenario>

        <Scenario
            title="lado do painel"
            :value="data"
        >
            <RForm
                v-model="data"
                class="flex flex-col gap-4"
            >
                <div class="h-[60vh]" />
                <RSelect
                    name="pedindo"
                    label="Mínimo padrão"
                    placeholder="320px embaixo, ou vai para o lado mais folgado"
                    search
                    :options="muitas"
                />
                <RSelect
                    name="semMinimo"
                    label="Sem mínimo"
                    placeholder="min-height 0 abre embaixo enquanto couber"
                    search
                    :min-height="0"
                    :options="muitas"
                />
            </RForm>
        </Scenario>
    </div>
</template>

<script setup lang="ts">
    import { ref } from "vue";

    // `null` limpa a camada no `mergerUI`, mas o tipo de `ui` só admite
    // `string | undefined` — daí o cast, que o template não sabe fazer sozinho.
    const semWrapper = {
        group: {
            wrapper: {
                container: null as unknown as string
            }
        }
    };

    const muitas = Array.from({ length: 200 }, (_, i) => `Opção ${i + 1}`);

    const data = ref<Record<string, unknown>>({});
</script>