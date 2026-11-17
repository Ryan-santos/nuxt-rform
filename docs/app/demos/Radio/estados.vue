<template>
    <RRadio
        name="obrigatorio"
        label="demo.common.obrigatorio"
        :options="['a', 'b', 'c']"
        required
        rule="required"
    />
    <RRadio
        name="desabilitado"
        label="demo.common.desabilitado"
        :options="['a', 'b', 'c']"
        default="b"
        disabled
    />
    <RRadio
        name="comErro"
        label="demo.common.erroManual"
        :options="['a', 'b', 'c']"
        error="demo.radio.erro"
    />
</template>