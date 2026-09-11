/**
 * O pack de referência: é o `typeof` dele que vira `Messages`, e é ele que responde
 * por uma chave faltando em qualquer outro. As quatro raízes e a sintaxe de
 * mensagem estão em "A forma do pack" no `.claude/CLAUDE.md`.
 *
 * Um `@` literal aqui precisa ser escrito `{'@'}`: `@:chave` é mensagem ligada, e
 * um e-mail cru derruba o parser.
 */
export default {
    fields: {
        array: {
            add: "Adicionar"
        },
        select: {
            search: "Pesquisar",
            loading: "Carregando…",
            loadingMore: "Carregando mais…",
            empty: "Nada encontrado",
            failed: "Não foi possível carregar as opções",
            retry: "Tentar de novo",
            clear: "Limpar",
            count: "{n} item | {n} itens"
        },
        file: {
            placeholder: "Arraste ou clique aqui para adicionar:",
            loading: "Carregando...",
            zero: "0 Byte",
            uploading: "Enviando...",
            failed: "O envio de um arquivo falhou.",
            rejected: "Formato não aceito.",
            tooBig: "Arquivo maior que {max}.",
            tooMany: "Máximo de {max} arquivo. | Máximo de {max} arquivos.",
            retry: "Tentar de novo",
            cancel: "Cancelar",
            remove: "Remover",
            bytes: {
                b: "Bytes",
                kb: "KB",
                mb: "MB",
                gb: "GB",
                tb: "TB"
            }
        },
        date: {
            hint: "dd/mm/aaaa",
            hintTime: "dd/mm/aaaa hh:mm",
            separator: "até"
        },
        hour: {
            hint: "hh:mm",
            separator: "até"
        }
    },
    utils: {
        calendar: {
            start: "Início",
            end: "Fim",
            time: "Hora"
        }
    },
    // Pareia com o layout de `src/runtime/presets/{rules,masks}`, e deixa espaço
    // para `presets.masks.*` se um dia houver mensagem lá.
    presets: {
        rules: {
            required: "Campo obrigatório.",
            min: {
                number: "Valor mínimo: {min}.",
                length: "Mínimo de {min} caractere. | Mínimo de {min} caracteres."
            },
            max: {
                number: "Valor máximo: {max}.",
                length: "Máximo de {max} caractere. | Máximo de {max} caracteres."
            },
            email: "E-mail inválido.",
            url: "URL inválida.",
            br: {
                cpf: "CPF inválido.",
                cnpj: "CNPJ inválido.",
                cep: "CEP inválido.",
                telefone: "Telefone inválido."
            }
        }
    },
    // De onde `dateFormat` deriva máscara, regex de parse e exibição. Tokens `D`,
    // `M` e `Y`.
    formats: {
        date: "DD/MM/YYYY"
    }
};