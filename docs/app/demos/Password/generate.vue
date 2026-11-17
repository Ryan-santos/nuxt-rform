<template>
    <RPassword
        name="gerada"
        label="demo.password.escutando"
        autocomplete="new-password"
        @generate="onGenerate"
    />
    <p
        v-if="generated"
        class="text-sm text-success"
    >
        {{ $t("demo.password.recebeu", { value: generated }) }}
    </p>
    <RPassword
        name="longa"
        label='~~:generate="{ length: 24 }"'
        autocomplete="new-password"
        :generate="{ length: 24 }"
    />
</template>

<script setup lang="ts">
    import { ref } from "vue";

    const generated = ref("");

    const onGenerate = (password: string) => {
        generated.value = password;
    };
</script>