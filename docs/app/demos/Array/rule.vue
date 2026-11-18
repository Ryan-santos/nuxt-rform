<template>
    <RArray
        v-slot="{ index }"
        name="convidados"
        label="demo.array.deDoisAQuatroConvidados"
        :rule="[
            { name: 'min', min: 2 },
            { name: 'max', max: 4 }
        ]"
    >
        <RText
            :name="index"
            placeholder="demo.array.convidado"
        />
    </RArray>

    <DemoActions />
</template>