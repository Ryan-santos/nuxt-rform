<template>
    <RSwitch
        name="iconPadrao"
        placeholder="demo.switch.iconPadrao"
    />
    <RSwitch
        name="iconCustom"
        placeholder='~~:icons="{ on, off }"'
        :icons="{
            on: 'twemoji:check-mark-button',
            off: 'twemoji:cross-mark'
        }"
    />
    <RSwitch
        name="semIcon"
        placeholder='~~{ on: "", off: "", loading: "" }'
        :icons="{ on: '', off: '', loading: '' }"
    />
</template>