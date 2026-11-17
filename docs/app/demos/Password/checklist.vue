<template>
    <RPassword
        name="novaSenha"
        label="demo.password.novaSenha"
        autocomplete="new-password"
        required
        rule="required"
        strength
        generate
        :checklist="[
            { label: 'demo.password.oitoCaracteres', rule: { name: 'min', min: 8 } },
            { label: 'demo.password.minuscula', rule: { name: 'regex', pattern: '[a-z]' } },
            { label: 'demo.password.maiuscula', rule: { name: 'regex', pattern: '[A-Z]' } },
            { label: 'demo.password.numero', rule: { name: 'regex', pattern: '[0-9]' } },
            { label: 'demo.password.simbolo', rule: { name: 'regex', pattern: '[^A-Za-z0-9]' } }
        ]"
    />
</template>