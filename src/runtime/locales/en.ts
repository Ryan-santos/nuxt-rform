type Messages = typeof import("./pt-BR").default;

/**
 * Tipado *contra* o pack de referência, então uma chave nova sem tradução aqui é
 * erro de compilação em vez de fallback calado em runtime. As rules `br.*` também
 * são traduzidas: um app en-US valida documento brasileiro sem problema.
 */
const en: Messages = {
    fields: {
        array: {
            add: "Add"
        },
        select: {
            search: "Search",
            loading: "Loading…",
            loadingMore: "Loading more…",
            empty: "Nothing found",
            failed: "Could not load the options",
            retry: "Try again"
        },
        file: {
            placeholder: "Drag or click here to add:",
            loading: "Loading...",
            zero: "0 Byte",
            uploading: "Uploading...",
            failed: "A file failed to upload.",
            rejected: "Format not accepted.",
            tooBig: "File larger than {max}.",
            tooMany: "At most {max} file. | At most {max} files.",
            retry: "Try again",
            cancel: "Cancel",
            remove: "Remove",
            bytes: {
                b: "Bytes",
                kb: "KB",
                mb: "MB",
                gb: "GB",
                tb: "TB"
            }
        },
        date: {
            hint: "mm/dd/yyyy",
            hintTime: "mm/dd/yyyy hh:mm",
            separator: "to"
        },
        hour: {
            hint: "hh:mm",
            separator: "to"
        }
    },
    utils: {
        calendar: {
            start: "Start",
            end: "End",
            time: "Time"
        }
    },
    presets: {
        rules: {
            required: "Required field.",
            min: {
                number: "Minimum value: {min}.",
                length: "At least {min} character. | At least {min} characters."
            },
            max: {
                number: "Maximum value: {max}.",
                length: "At most {max} character. | At most {max} characters."
            },
            email: "Invalid e-mail.",
            url: "Invalid URL.",
            br: {
                cpf: "Invalid CPF.",
                cnpj: "Invalid CNPJ.",
                cep: "Invalid CEP.",
                telefone: "Invalid phone number."
            }
        }
    },
    formats: {
        date: "MM/DD/YYYY"
    }
};

export default en;