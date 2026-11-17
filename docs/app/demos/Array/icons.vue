<template>
    <RArray
        v-slot="{ index }"
        name="icones"
        label='~~:icons="{ add, remove }"'
        :default="['', '']"
        :icons="{
            add: 'twemoji:heavy-plus-sign',
            remove: 'twemoji:wastebasket'
        }"
    >
        <RText
            :name="index"
            placeholder="demo.array.tag"
        />
    </RArray>
</template>