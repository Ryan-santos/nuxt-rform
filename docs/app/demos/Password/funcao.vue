<template>
    <RText
        name="usuario"
        label="demo.password.usuario"
        autocomplete="username"
    />
    <RPassword
        name="senha"
        label="demo.password.senha"
        autocomplete="new-password"
        :checklist="[
            { label: 'demo.password.oitoCaracteres', rule: { name: 'min', min: 8 } },
            {
                label: 'demo.password.semUsuario',
                rule: ({ value, form }) =>
                    form.usuario && String(value).includes(form.usuario)
                        ? $t('demo.password.semUsuario')
                        : undefined
            }
        ]"
    />
</template>