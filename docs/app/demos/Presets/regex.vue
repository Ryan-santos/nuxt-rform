<template>
    <RText
        name="pedido"
        label="~~{ name: 'regex', pattern: '^PED-[0-9]+$', flags: 'i' }"
        :rule="{ name: 'regex', pattern: '^PED-[0-9]+$', flags: 'i' }"
    />
    <RText
        name="uf"
        label="~~{ name: 'regex', pattern: '^[A-Z]{2}$', message }"
        :rule="{ name: 'regex', pattern: '^[A-Z]{2}$', message: 'demo.presets.uf' }"
    />
</template>