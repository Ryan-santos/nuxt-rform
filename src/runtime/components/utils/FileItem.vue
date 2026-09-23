<template>
    <div :class="props.ui.container">
        <img
            v-if="thumb"
            :src="thumb"
            :alt="entry.name"
            :class="props.ui.thumb"
        />
        <Icon
            v-else
            :name="icon(broken ? 'alert' : 'file')"
            :class="[props.ui.icon, broken ? props.ui.failed : '']"
        />

        <div :class="props.ui.body">
            <a
                v-if="entry.url"
                :href="entry.url"
                target="_blank"
                rel="noopener"
                :class="[props.ui.name, props.ui.link]"
            >
                {{ entry.name }}
            </a>
            <span
                v-else
                :class="props.ui.name"
            >
                {{ entry.name }}
            </span>

            <span
                v-if="entry.message"
                :class="props.ui.message"
            >
                {{ entry.message }}
            </span>
            <span
                v-else-if="meta"
                :class="props.ui.meta"
            >
                {{ meta }}
            </span>

            <span
                v-if="entry.status === 'pending'"
                :class="props.ui.progress.track"
            >
                <span
                    :class="props.ui.progress.bar"
                    :style="{ width: percent }"
                />
            </span>
        </div>

        <div :class="props.ui.actions">
            <button
                v-if="entry.status === 'error'"
                type="button"
                :title="tr(props.text?.retry)"
                :disabled="props.disabled"
                :class="props.ui.action"
                @click="emit('retry')"
            >
                <Icon :name="icon('retry')" />
            </button>

            <button
                v-if="entry.status === 'pending'"
                type="button"
                :title="tr(props.text?.cancel)"
                :disabled="props.disabled"
                :class="props.ui.action"
                @click="emit('cancel')"
            >
                <Icon :name="icon('cancel')" />
            </button>
            <button
                v-else
                type="button"
                :title="tr(props.text?.remove)"
                :disabled="props.disabled"
                :class="props.ui.remove"
                @click="emit('remove')"
            >
                <Icon :name="icon('remove')" />
            </button>
        </div>
    </div>
</template>

<script lang="ts">
    /**
     * Uma linha da lista do `RFile`: miniatura, nome, tamanho, barra de progresso e
     * os botões de retry, cancelar e remover. É util, e não um componente inline do
     * campo, porque é a linha que um app mais quer restilizar — como util ela ganha
     * `ui.Utils.FileItem`, a classe-gancho e a árvore de `ui` de graça.
     *
     * O texto é o do campo: `useUtil` mescla as props do pai, então tudo continua
     * morando em `rform.fields.file.*` em vez de se partir em duas subárvores.
     */
    import { computed, onUnmounted, ref, watch } from "vue";

    import { useUtil } from "#rform/composables";
    import type { DeepPartial, FileEntry, TextTree } from "#rform/types";
    import { defineDefaults, formatBytes, icon } from "#rform/utils";

    const ui = {
        container: `
            flex flex-row items-center gap-3 rounded-(--rf-radius-lg) border border-(--rf-color-border)
            bg-(--rf-color-background-100) p-2
        `,
        thumb: "size-10 shrink-0 rounded-(--rf-radius-md) bg-(--rf-color-background) object-cover object-center",
        icon: "size-10 shrink-0 p-2 text-(--rf-color-contrast)/40",
        failed: "text-(--rf-color-danger)",
        body: "flex min-w-0 grow flex-col gap-1 text-start",
        name: "truncate text-sm leading-tight",
        link: "hover:text-(--rf-color-primary) hover:underline",
        meta: "text-xs leading-none text-(--rf-color-contrast)/50",
        message: "text-xs leading-none font-semibold text-(--rf-color-danger)",
        progress: {
            track: "block h-1 w-full overflow-hidden rounded-(--rf-radius-sm) bg-(--rf-color-background-200)",
            bar: "block h-full rounded-(--rf-radius-sm) bg-(--rf-color-primary) transition-[width] duration-300"
        },
        actions: "flex shrink-0 flex-row items-center gap-1",
        action: `
            cursor-pointer rounded-(--rf-radius-sm) p-1 text-(--rf-color-contrast)/40 transition-colors duration-300
            hover:text-(--rf-color-primary)
            disabled:pointer-events-none disabled:opacity-40
        `,
        remove: `
            cursor-pointer rounded-(--rf-radius-sm) p-1 text-(--rf-color-contrast)/40 transition-colors duration-300
            hover:text-(--rf-color-danger)
            disabled:pointer-events-none disabled:opacity-40
        `
    };

    export const defaults = defineDefaults({ ui });

    /**
     * As folhas de texto que a linha lê, declaradas aqui em vez de importadas do
     * `File.vue`: o util não conhece o campo, e importar fecharia um acoplamento que
     * hoje não existe.
     */
    type Text = {
        uploading: string;
        retry: string;
        cancel: string;
        remove: string;
        zero: string;
        bytes: { b: string; kb: string; mb: string; gb: string; tb: string };
    };

    export type Props = {
        ui?: DeepPartial<typeof defaults.ui>;
        text?: TextTree<Text>;
        /** Herdado do campo pelo merge de props do `useUtil`. */
        disabled?: boolean;
    };
</script>

<script setup lang="ts">
    const componentProps = defineProps<{ entry: FileEntry }>();

    const emit = defineEmits<{
        retry: [];
        cancel: [];
        remove: [];
    }>();

    const { props, tr } = useUtil<Props>();

    const IMAGES = /\.(?:jpe?g|png|gif|bmp|tiff?|webp|svg|avif)(?:$|[?#])/i;

    const broken = computed(
        () => componentProps.entry.status === "error" || componentProps.entry.status === "rejected"
    );

    const percent = computed(() => `${Math.round(componentProps.entry.progress * 100)}%`);

    const meta = computed(() => {
        if (componentProps.entry.status === "pending") {
            return tr(props.value.text?.uploading);
        }

        const size = componentProps.entry.size;

        if (size === undefined) {
            return "";
        }

        if (size <= 0) {
            return tr(props.value.text?.zero);
        }

        const { value, unit } = formatBytes(size);

        return `${value} ${tr(props.value.text?.bytes?.[unit])}`;
    });

    const thumb = ref<string>();

    // O objectURL é criado e revogado aqui, e não na fila: um `File` cru no model
    // (modo sem `upload`) não tem entry, e dois donos seriam duas formas de vazar.
    let created: string | undefined;

    const release = () => {
        if (created) {
            URL.revokeObjectURL(created);
            created = undefined;
        }
    };

    /**
     * Em try/catch porque `createObjectURL` não existe em todo lugar — e onde existe
     * pode recusar o `File`, como no happy-dom sobre o `URL` do Node. Sem miniatura o
     * campo continua inteiro; com exceção, o util inteiro deixa de montar.
     */
    const objectUrl = (file: File): string | undefined => {
        try {
            return URL.createObjectURL(file);
        } catch {
            return undefined;
        }
    };

    watch(
        // Pelas folhas, não pelo `entry`: o objeto da linha é remontado a cada tique de
        // progresso, e revogar ali piscaria a miniatura.
        [
            () => componentProps.entry.file,
            () => componentProps.entry.url,
            () => componentProps.entry.type
        ],
        ([file, url, type]) => {
            release();

            if (file?.type?.startsWith("image/")) {
                created = objectUrl(file);

                if (created) {
                    thumb.value = created;
                    return;
                }
            }

            // O `type` primeiro: a `url` de uma API é `/uploads/7`, sem extensão para o
            // regex enxergar.
            const image = type ? type.startsWith("image/") : Boolean(url && IMAGES.test(url));

            thumb.value = url && image ? url : undefined;
        },
        { immediate: true }
    );

    onUnmounted(release);
</script>