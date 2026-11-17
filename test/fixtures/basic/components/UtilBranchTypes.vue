<template>
    <div>
        <!-- todo util que o campo renderiza tem o galho dele no `ui` do campo -->
        <RText :ui="{ Utils: { Label: { container: 'x' } } }" />
        <RNumber :ui="{ Utils: { Label: { container: 'x' } } }" />
        <RDate :ui="{ Utils: { Label: { container: 'x' }, Calendar: { grid: 'x' } } }" />
        <RFile :ui="{ Utils: { FileItem: { container: 'x' } } }" />

        <!-- e o `icons` e o `text` que o util herda do campo -->
        <RDate :icons="{ Utils: { Calendar: { prev: 'lucide:chevron-left' } } }" />
        <RDate :text="{ start: 'rform.utils.calendar.start' }" />

        <!-- @vue-expect-error util que o campo não renderiza -->
        <RText :ui="{ Utils: { Calendar: { grid: 'x' } } }" />
    </div>
</template>