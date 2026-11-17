<template>
    <RPassword
        name="icones"
        label='~~:icons="{ generate, show, hide, idle, pending, met }"'
        autocomplete="new-password"
        generate
        :checklist="[
            { label: 'demo.password.oitoCaracteres', rule: { name: 'min', min: 8 } },
            { label: 'demo.password.numero', rule: { name: 'regex', pattern: '[0-9]' } }
        ]"
        :icons="{
            generate: 'twemoji:old-key',
            show: 'twemoji:eyes',
            hide: 'twemoji:see-no-evil-monkey',
            idle: 'twemoji:hourglass-not-done',
            pending: 'twemoji:hourglass-not-done',
            met: 'twemoji:check-mark-button'
        }"
    />
</template>