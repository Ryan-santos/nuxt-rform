<template>
    <RSelect
        name="icones"
        label='~~:icons="{ clear, toggle, search }"'
        placeholder="demo.common.selecione"
        :options="['SP', 'RJ', 'MG', 'BA', 'RS']"
        default="SP"
        search
        :icons="{
            clear: 'twemoji:cross-mark',
            toggle: 'twemoji:down-arrow',
            search: 'twemoji:magnifying-glass-tilted-left'
        }"
    />
</template>