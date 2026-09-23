<template>
    <div :class="props.ui?.container">
        <RUtilsLabel v-if="props.label" />

        <label
            :class="[
                props.ui?.group?.dropzone,
                {
                    [props.ui?.group?.hasFile ?? '']: rows.length > 0,
                    [props.ui?.group?.dragging ?? '']: dragging,
                    [props.ui?.group?.disabled ?? '']: props.disabled
                }
            ]"
            @drop.prevent="onDrop"
            @dragenter.prevent="onDragEnter"
            @dragleave.prevent="onDragLeave"
            @dragover.prevent
        >
            <input
                type="file"
                :accept="accept.attr"
                :multiple="props.multiple"
                :disabled="props.disabled"
                :class="props.ui?.group?.input"
                @change="onChange"
            />

            <slot
                name="empty"
                :accept="accept.list"
            >
                <Icon
                    :name="icon('upload')"
                    size="2.5rem"
                    :class="props.ui?.group?.icon"
                />

                <div :class="props.ui?.group?.info?.container">
                    <p :class="props.ui?.group?.info?.text">
                        {{ tr(props.placeholder) }}
                    </p>
                    <ul
                        v-if="accept.list.length > 0"
                        :class="props.ui?.group?.info?.list"
                    >
                        <li
                            v-for="item in accept.list"
                            :key="item"
                            :class="props.ui?.group?.info?.badge"
                        >
                            {{ item }}
                        </li>
                    </ul>
                </div>
            </slot>

            <Transition>
                <div
                    v-show="props.loading || busy"
                    :class="props.ui?.group?.loading?.container"
                >
                    <Icon
                        :name="icon('loading')"
                        size="2.5rem"
                    />
                    {{ tr(props.text?.loading) }}
                </div>
            </Transition>
        </label>

        <ul
            v-if="rows.length > 0"
            :class="props.ui?.list"
        >
            <li
                v-for="(row, index) in rows"
                :key="row.key"
            >
                <slot
                    name="item"
                    :entry="row"
                    :retry="() => retry(row)"
                    :cancel="() => discard(row, index)"
                    :remove="() => discard(row, index)"
                >
                    <RUtilsFileItem
                        :entry="row"
                        @retry="retry(row)"
                        @cancel="discard(row, index)"
                        @remove="discard(row, index)"
                    />
                </slot>
            </li>
        </ul>

        <RUtilsDescription v-if="props.description" />
        <RUtilsError v-if="props.error" />
    </div>
</template>

<script lang="ts">
    /**
     * Campo de arquivo: dropzone, uma linha por arquivo e upload opcional por API.
     * Sem a prop `upload` o model guarda o `File`; com ela, guarda o que a função
     * devolveu — e o `RForm` espera o que está em voo antes de submeter.
     *
     * @example <RFile name="anexo" accept="image/*" multiple :upload="enviar" />
     */
    import { computed, onUnmounted, ref, toRaw } from "vue";

    import { useField } from "#rform/composables";
    import type { Element, FileEntry, TextProp, TrInput, Uploaded, UploadFn } from "#rform/types";
    import type Utils from "#rform/types/components/utils/props";
    import {
        acceptMatch,
        defineDefaults,
        fnProp,
        formatBytes,
        icon,
        withParams
    } from "#rform/utils";

    import { injectPendingList } from "../../composables/pendingList";
    import useUploadQueue from "../../composables/useUploadQueue";

    export const defaults = defineDefaults({
        ui: {
            container: "flex grow flex-col gap-2",
            group: {
                dropzone: `
                    relative flex cursor-pointer flex-row items-center justify-center gap-3
                    rounded-(--rf-radius-xl) border-2 border-dashed border-(--rf-color-border) bg-(--rf-color-background-100) p-4 text-center
                    transition-all duration-500
                    hover:border-(--rf-color-primary) hover:text-(--rf-color-primary)
                `,
                hasFile: "border-(--rf-color-success)",
                dragging: "border-(--rf-color-primary) text-(--rf-color-primary)",
                // `pointer-events-none` é o que apaga o hover e o drag de uma vez: sem
                // ele a dropzone continuaria acendendo ao passar o mouse.
                disabled: "pointer-events-none opacity-60",
                input: "pointer-events-none absolute top-0 size-0 opacity-0",
                icon: "shrink-0 text-(--rf-color-contrast)/30",
                info: {
                    container: "flex flex-col gap-1",
                    text: "text-sm text-(--rf-color-contrast)/50",
                    list: "flex flex-row flex-wrap gap-1",
                    badge: `
                        m-1 inline-flex rounded-(--rf-radius-md) bg-current/10 px-2 py-1 text-xs
                        leading-none font-bold
                    `
                },
                loading: {
                    container: `
                        absolute inset-0 flex size-full flex-col items-center justify-center
                        rounded-(--rf-radius-xl) bg-(--rf-color-success)/50 p-6 backdrop-blur-sm
                    `
                }
            },
            list: "flex flex-col gap-2"
        },
        default: null,
        placeholder: "placeholder",
        text: {
            loading: "loading",
            uploading: "uploading",
            failed: "failed",
            rejected: "rejected",
            tooBig: "tooBig",
            tooMany: "tooMany",
            retry: "retry",
            cancel: "cancel",
            remove: "remove",
            zero: "zero",
            bytes: {
                b: "b",
                kb: "kb",
                mb: "mb",
                gb: "gb",
                tb: "tb"
            }
        }
    });

    export type Props<Multiple extends boolean = false, U extends Uploaded = Uploaded> = Element<
        typeof defaults,
        "file",
        (Multiple extends true ? Array<File | U> : File | U) | null
    > &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        TextProp<typeof defaults.text> & {
            /** Extensões e/ou MIME (`"png, jpg"`, `"image/*"`, `".pdf"`). Ausente = tudo. */
            accept?: string;
            /** O `& boolean` é o que faz a forma curta `<RFile multiple>` ligar. */
            multiple?: Multiple & boolean;
            /**
             * Presente ⇒ o model guarda o `Uploaded`; ausente ⇒ guarda o `File`.
             * `false` recusa o que veio do `defaults.ts` — o `merger` não deixa um
             * valor falsy apagar um default, então a saída tem de ser explícita.
             */
            upload?: UploadFn<U> | false;
            /** O DELETE do lado do app, ao remover um item já enviado. `false` recusa o default. */
            remove?: ((value: U) => unknown | Promise<unknown>) | false;
            /** Em bytes; rejeita **antes** de subir. */
            maxSize?: number;
            /** Só em `multiple`. */
            maxFiles?: number;
            /** No topo por contrato, como `label` — nunca dentro de `text`. */
            placeholder?: TrInput;
        };

    // Espelho de `Props` sem generic, para o `useField`, como no Select: o tipo
    // condicional do model cascateia numa união que o checker não representa.
    type InternalProps = Omit<
        Element<typeof defaults, "file">,
        "modelValue" | "onUpdate:modelValue" | "default"
    > &
        Utils["Label"] &
        Utils["Description"] &
        Utils["Error"] &
        TextProp<typeof defaults.text> & {
            accept?: string;
            multiple?: boolean;
            upload?: UploadFn | false;
            remove?: ((value: Uploaded) => unknown) | false;
            maxSize?: number;
            maxFiles?: number;
            placeholder?: TrInput;
            default?: unknown;
            modelValue?: unknown;
        };
</script>

<script setup lang="ts" generic="Multiple extends boolean = false, U extends Uploaded = Uploaded">
    // `disabled` entra na lista pelo mesmo motivo de `required` e `loading`: com o
    // boolean casting do Vue a prop **ausente** chegaria `false`, e aí um
    // `defineFieldDefaults({ File: { disabled: true } })` seria impossível de ligar.
    const _props = withDefaults(defineProps<Props<Multiple, U>>(), {
        required: undefined,
        loading: undefined,
        disabled: undefined,
        upload: undefined,
        remove: undefined
    });

    // Opcionais, e não só por serem: um slot obrigatório no tipo faz `h(RFile, props)`
    // com dois argumentos deixar de casar a sobrecarga.
    defineSlots<{
        /** Uma linha da lista. Substitui o `RUtilsFileItem`, não a interface inteira. */
        item?(props: {
            entry: FileEntry;
            retry: () => void;
            cancel: () => void;
            remove: () => void;
        }): void;
        /** O miolo da dropzone. */
        empty?(props: { accept: string[] }): void;
    }>();

    const { id, model, props, tr } = useField(_props as unknown as InternalProps, {
        // `defaults.default` é estático (`null`), então a normalização para lista mora
        // aqui — o seam que já existe. Sem ela o seed entrega `null` onde o modo
        // múltiplo espera array. `_props.multiple` é a prop crua, antes do merger.
        //
        // Em forma de método, e sem parênteses aninhados: o `src/vite.plugin.ts` casa
        // os argumentos por regex e tolera um nível só — passando disso o nome do
        // componente não é injetado e o `useField` lança.
        get(value) {
            if (!_props.multiple) {
                return value;
            }

            return Array.isArray(value) ? value : [];
        }
    });

    const isFile = (value: unknown): value is File =>
        typeof File !== "undefined" && value instanceof File;

    const isUploaded = (value: unknown): value is Uploaded =>
        !isFile(value) && typeof value === "object" && value !== null && "url" in value;

    const sizeLabel = (bytes: number) => {
        const { value, unit } = formatBytes(bytes);

        return `${value} ${tr(props.value.text?.bytes?.[unit])}`;
    };

    // Computed, e não uma vez no setup: um `accept` vindo de schema dinâmico muda, e
    // o de hoje é calculado uma vez só.
    const accept = computed(() => acceptMatch(props.value.accept));

    const items = computed<Array<File | Uploaded>>(() => {
        const value = model.value;

        if (props.value.multiple) {
            return Array.isArray(value) ? (value.filter(Boolean) as Array<File | Uploaded>) : [];
        }

        return value ? [value as File | Uploaded] : [];
    });

    // A mensagem de um DELETE que falhou, chaveada pelo próprio item: índice muda
    // quando a lista encolhe, e a linha ficaria com o recado do vizinho.
    const failures = ref(new Map<unknown, string>());

    const busy = ref(false);

    const upload = computed(() => fnProp<UploadFn>(_props.upload, props.value.upload));
    const remove = computed(() =>
        fnProp<(value: Uploaded) => unknown>(_props.remove, props.value.remove)
    );

    // O `File` de quem subiu nesta sessão, chaveado pelo `Uploaded` que a função
    // devolveu: sem ele a miniatura sumiria no instante em que a entry sai da fila e o
    // item entra no model — a `url` de uma API raramente tem extensão de imagem.
    // Fraco de propósito: a chave morre com o item, sem nada a limpar no `discard`.
    const previews = new WeakMap<object, File>();

    const queue = useUploadQueue({
        upload: () => upload.value,
        onDone: (value, file) => {
            previews.set(value, file);

            model.value = props.value.multiple ? [...items.value, value] : value;
        },
        fallback: () => tr(props.value.text?.failed)
    });

    const rows = computed<FileEntry[]>(() => [
        ...items.value.map((item, index): FileEntry => {
            const file = isFile(item) ? item : undefined;
            const uploaded = isUploaded(item) ? item : undefined;
            const local = uploaded ? previews.get(toRaw(item)) : undefined;

            return {
                key: `item-${index}`,
                name: file?.name ?? uploaded?.name ?? "",
                // O `size` do `Uploaded` na frente do `File` local: quem declarou o
                // tamanho é a API, e é ela a dona do que está no model.
                size: file?.size ?? uploaded?.size ?? local?.size,
                type: uploaded?.type,
                file: file ?? local,
                url: uploaded?.url,
                status: "done",
                progress: 1,
                message: failures.value.get(toRaw(item))
            };
        }),
        ...queue.entries.value.map((entry): FileEntry => ({
            key: entry.uid,
            uid: entry.uid,
            name: entry.file.name,
            size: entry.file.size,
            file: entry.file,
            status: entry.status,
            progress: entry.progress,
            message: entry.message
        }))
    ]);

    /** Quantos slots já estão ocupados — o que o `maxFiles` conta. */
    const taken = () =>
        items.value.length +
        queue.entries.value.filter((entry) => entry.status !== "rejected").length;

    const intake = (list: FileList | null | undefined) => {
        const incoming = list ? [...list] : [];

        // O `pointer-events-none` já barra o clique e o drop; a guarda cobre o schema
        // que liga o `disabled` com o diálogo do SO aberto.
        if (incoming.length === 0 || props.value.disabled) {
            return;
        }

        const multiple = props.value.multiple === true;

        // Single: o arquivo novo substitui o anterior, e o que estava em voo é abortado.
        if (!multiple) {
            queue.stop();
            incoming.splice(1);
        }

        const maxSize = props.value.maxSize;
        const maxFiles = multiple ? props.value.maxFiles : undefined;

        const fresh: File[] = [];

        for (const file of incoming) {
            // A mensagem da recusa aparece **na linha**, e não no `error` do campo,
            // que é do `errorsBag` e tem um escritor só.
            if (!accept.value.matches(file)) {
                queue.reject(file, tr(props.value.text?.rejected));
                continue;
            }

            if (maxSize !== undefined && file.size > maxSize) {
                queue.reject(
                    file,
                    tr(withParams(props.value.text?.tooBig, { max: sizeLabel(maxSize) }))
                );
                continue;
            }

            if (maxFiles !== undefined && taken() + fresh.length >= maxFiles) {
                queue.reject(file, tr(withParams(props.value.text?.tooMany, { max: maxFiles })));
                continue;
            }

            fresh.push(file);
        }

        if (fresh.length === 0) {
            return;
        }

        if (upload.value) {
            for (const file of fresh) {
                queue.add(file);
            }

            return;
        }

        model.value = multiple ? [...items.value, ...fresh] : fresh[0];
    };

    const onChange = (event: Event) => {
        const target = event.target as HTMLInputElement | null;

        intake(target?.files);

        // Zera o input: sem isso, escolher o mesmo arquivo de novo não dispara `change`.
        if (target) {
            target.value = "";
        }
    };

    // Contador, e escopado ao elemento: `dragenter`/`dragleave` disparam também nos
    // filhos, e os listeners de `window` de antes faziam dois RFile na mesma página
    // pulsarem juntos.
    const dragging = ref(false);
    let depth = 0;

    const onDragEnter = () => {
        depth += 1;
        dragging.value = true;
    };

    const onDragLeave = () => {
        depth = Math.max(0, depth - 1);
        dragging.value = depth > 0;
    };

    const onDrop = (event: DragEvent) => {
        depth = 0;
        dragging.value = false;

        intake(event.dataTransfer?.files);
    };

    const retry = (row: FileEntry) => {
        if (row.uid && !props.value.disabled) {
            queue.retry(row.uid);
        }
    };

    const discard = async (row: FileEntry, index: number) => {
        // Também aqui, e não só no botão: o slot `#item` expõe estas três funções.
        if (props.value.disabled) {
            return;
        }

        // Cancelar aborta o `signal` **e** descarta a entry: a resolução só escreve no
        // model se a entry ainda existir.
        if (row.uid) {
            queue.cancel(row.uid);
            return;
        }

        const item = items.value[index];

        if (!item) {
            return;
        }

        const raw = toRaw(item);
        failures.value.delete(raw);

        const handler = remove.value;

        if (handler && isUploaded(item)) {
            busy.value = true;

            try {
                await handler(item);
            } catch (error) {
                const message = error instanceof Error ? error.message : "";

                failures.value.set(raw, message || tr(props.value.text?.failed));
                return;
            } finally {
                busy.value = false;
            }
        }

        model.value = props.value.multiple
            ? items.value.filter((_, position) => position !== index)
            : null;
    };

    // O gancho irmão do `rulesList`: o Form espera a liquidação antes de validar, e a
    // entrada devolve a mensagem em vez de lançar.
    const pendingList = injectPendingList();

    if (id) {
        pendingList?.value.set(id, async () => {
            await queue.settled();

            return queue.failed.value ? tr(props.value.text?.failed) : undefined;
        });
    }

    onUnmounted(() => {
        queue.stop();

        if (id) {
            pendingList?.value.delete(id);
        }
    });
</script>