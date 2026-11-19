<template>
    <div>
        <RText
            name="motivo"
            :rule="{ name: 'required', message: 'Escreva o motivo.' }"
        />

        <RText
            name="motivo"
            :rule="['required', { name: 'min', min: 3, message: 'Curto demais.' }]"
        />

        <RText
            name="motivo"
            :rule="{ name: 'regex', pattern: '^[A-Z]', message: 'Comece em maiúscula.' }"
        />

        <!-- @vue-expect-error -->
        <RText
            name="motivo"
            :rule="{ name: 'required', message: 1 }"
        />

        <!-- @vue-expect-error -->
        <RText
            name="motivo"
            :rule="{ name: 'min', message: 'Sem o min.' }"
        />
    </div>
</template>

<script setup lang="ts">
    /**
     * Guarda de tipo do `message` de um ref de rule: vale em todo preset, é texto
     * (`TrInput`) e não dispensa os args obrigatórios. Executada pelo `vue-tsc` da fixture.
     */
</script>