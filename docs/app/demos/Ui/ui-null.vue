<template>
    <RText
        name="semWrapper"
        label="demo.ui.wrapperZerado"
        placeholder="demo.ui.wrapperZeradoPlaceholder"
        :ui="{ group: { wrapper: { container: null } } }"
    />
    <RText
        name="wrapperNovo"
        label="demo.ui.wrapperNovo"
        placeholder="demo.ui.wrapperNovoPlaceholder"
        :ui="{
            group: {
                wrapper: {
                    container: [null, 'flex flex-row items-center border-b-2 border-secondary']
                }
            }
        }"
    />
</template>