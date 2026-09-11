import type { Rule } from "#rform/types/presets";
import type { TrInput } from "#rform/types/tr";

export type { TrInput };

/**
 * A forma do `defaults` de qualquer componente. `default` é opcional para
 * `defineDefaults` tipar um util também — um Label tem `ui` e não tem model.
 *
 * `text` é a chave que marca o que é chave de tradução do módulo, e continua um
 * objeto **aninhado** o caminho inteiro; `label` e `placeholder` são as duas
 * exceções que moram no topo por contrato. Ver "`defaults.text` é o marcador" no
 * `.claude/CLAUDE.md`.
 */
export interface Base {
    ui: Record<string, unknown> | string;
    default?: unknown;
    text?: TextSource;
    label?: unknown;
    placeholder?: unknown;
}

/** A forma de autoria de `defaults.text`: grupos aninhados de chaves de mensagem. */
export interface TextSource {
    [key: string]: string | TextSource;
}

export type ConvertNeverToUnknown<T> = T extends never[]
    ? unknown[]
    : T extends never
      ? unknown
      : T extends Array<infer U>
        ? Array<ConvertNeverToUnknown<U>>
        : T extends object
          ? {
                [K in keyof T]: ConvertNeverToUnknown<T[K]>;
            }
          : T;

/**
 * O que um slot nomeado do schema recebe do RForm / RDynamic. Tipado aqui para o
 * escopo sobreviver ao salto pelos bindings dinâmicos `#[slotName]`.
 */
export type SlotScope = {
    fieldName: string | number;
    rule?: Rule;
};

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends Record<unknown, unknown> ? DeepPartial<T[P]> : T[P];
};

/**
 * O inverso do `DeepPartial`: o que um `ui` parcial vira depois de mesclado sobre
 * os defaults completos — toda chave presente, em toda profundidade.
 */
export type DeepRequired<T> = T extends object
    ? { [P in keyof T]-?: DeepRequired<NonNullable<T[P]>> }
    : T;

/**
 * Espelha a árvore de `defaults.text` na prop que a carrega, virando toda folha um
 * `TrInput` e todo nível opcional. Mapped type de propósito, nunca condicional no
 * nível da prop — ver "O `Element` não deriva os props de texto" no
 * `.claude/CLAUDE.md`.
 *
 * @example TextProp<{ hint: string, teste: { a: string } }>
 * // → { text?: { hint?: TrInput, teste?: { a?: TrInput } } }
 */
export type TextTree<T> = {
    [K in keyof T]?: T[K] extends string ? TrInput : TextTree<T[K]>;
};

export type TextProp<T> = {
    text?: TextTree<T>;
};

/**
 * O mesmo componente visto do próprio `defaults` em vez do call site: igual a
 * `Props`, menos `text`, que ainda guarda o sufixo cru que o `prefixText` não
 * expandiu. Ver "`WithTextSource<P>`" no `.claude/CLAUDE.md`.
 */
export type WithTextSource<P> = Omit<P, "text"> & { text?: TextSource };

/**
 * As props que todo campo tem. `C` é o field type ("text", "color", …) e filtra
 * quais presets o `rule` aceita, pelo `available` de cada um.
 *
 * `text` está ausente de propósito: cada componente o intersecciona com
 * `TextProp<typeof defaults.text>`, porque só ele sabe a forma da própria árvore.
 *
 * `error` é `TrInput` como `label` e `placeholder`, mas só na entrada: quem resolve é
 * o `useField`, e o que sai do merger é sempre a mensagem pronta.
 *
 * `disabled` é prop de todo campo, e o `RDynamic` a preenche a partir do
 * `disabledWhen` do schema — ver "Condicionais no schema" no `.claude/CLAUDE.md`.
 */
export type Element<OBJ extends Base = Base, C = any, D = ConvertNeverToUnknown<OBJ["default"]>> = {
    name?: string | number;
    error?: TrInput;
    required?: boolean;
    rule?: Rule<C>;
    loading?: boolean;
    disabled?: boolean;
    default?: D;
    ui?: DeepPartial<OBJ["ui"]>;
    modelValue?: D;
    "onUpdate:modelValue"?: <T extends D>($event: T) => void;
};

/**
 * Os tokens de autofill do WHATWG, escritos à mão. O `AutoFill` do `lib.dom` é uma
 * união de template literal e estoura o `defineProps` com "union type too complex";
 * a lista literal mais o `(string & {})` dá o mesmo autocompletar e ainda aceita as
 * formas compostas (`"shipping street-address"`, `"section-a username"`).
 */
export type AutocompleteToken =
    | "off"
    | "on"
    | "name"
    | "honorific-prefix"
    | "given-name"
    | "additional-name"
    | "family-name"
    | "honorific-suffix"
    | "nickname"
    | "username"
    | "new-password"
    | "current-password"
    | "one-time-code"
    | "organization-title"
    | "organization"
    | "street-address"
    | "address-line1"
    | "address-line2"
    | "address-line3"
    | "address-level4"
    | "address-level3"
    | "address-level2"
    | "address-level1"
    | "country"
    | "country-name"
    | "postal-code"
    | "cc-name"
    | "cc-given-name"
    | "cc-additional-name"
    | "cc-family-name"
    | "cc-number"
    | "cc-exp"
    | "cc-exp-month"
    | "cc-exp-year"
    | "cc-csc"
    | "cc-type"
    | "transaction-currency"
    | "transaction-amount"
    | "language"
    | "bday"
    | "bday-day"
    | "bday-month"
    | "bday-year"
    | "sex"
    | "tel"
    | "tel-country-code"
    | "tel-national"
    | "tel-area-code"
    | "tel-local"
    | "tel-extension"
    | "impp"
    | "url"
    | "photo"
    | "webauthn"
    | "email"
    | (string & {});

/**
 * A prop `autocomplete`, interseccionada campo a campo e de propósito **fora** do
 * `Element`: o atributo não vale nos inputs de `Switch` (checkbox) nem de `File`
 * (file), e dá-lo aos treze no nível do tipo sem os treze honrarem é quebra calada
 * — a mesma armadilha que o `disabled` já encontrou.
 *
 * Ver "A prop `autocomplete`" no `.claude/CLAUDE.md`.
 */
export type Autocomplete = {
    autocomplete?: AutocompleteToken;
};

/**
 * O que o app empurra para dentro do formulário: erros vindos de fora, na forma
 * que uma API produz. Aninhado, já pontilhado ou os dois misturados — quem
 * achata é o `flattenErrors`.
 */
export type FormErrors = {
    [key: string]: string | string[] | FormErrors;
};
/**
 * O mínimo que uma função de upload devolve, e o que o model do `RFile` passa a
 * guardar quando a prop `upload` existe. O resto do objeto passa intacto.
 */
export type Uploaded = {
    id: string | number;
    name: string;
    url: string;
    /** Opcional: quando vem, a linha mostra o tamanho. */
    size?: number;
    /** Opcional: `image/*` faz a `url` valer de miniatura sem depender da extensão. */
    type?: string;
} & Record<string, unknown>;

/** O que o campo dá à função de upload: como abortar, e onde relatar o progresso. */
export type UploadContext = {
    signal: AbortSignal;
    /** Fração de 0 a 1. O campo desenha a barra; chamar é opcional. */
    onProgress: (ratio: number) => void;
};

/**
 * O transporte, que é do app: o módulo é dono do ciclo (fila, progresso, cancelar,
 * erro, retry) e não tem convenção de envelope nem dependência de fetch.
 *
 * @example const upload: UploadFn = async (file, { signal }) => $fetch("/api/uploads", { method: "POST", body, signal });
 */
export type UploadFn<U extends Uploaded = Uploaded> = (
    file: File,
    context: UploadContext
) => Promise<U>;

/**
 * Uma linha da lista do `RFile`: um item já assentado no model, ou um arquivo em
 * voo que a fila ainda segura. É o que o slot `#item` recebe e o que o
 * `RUtilsFileItem` desenha.
 */
export type FileEntry = {
    /** Estável dentro de uma renderização — serve de `key` do `v-for`. */
    key: string;
    name: string;
    /** Do `File`, ou o `size` que o `Uploaded` trouxe. */
    size?: number;
    /** O `File` cru, quando existe: é dele que sai a miniatura. */
    file?: File;
    /** A URL do que já subiu, para a miniatura e o link. */
    url?: string;
    /** O MIME do que está na `url`, quando o `Uploaded` o trouxe. */
    type?: string;
    status: "done" | "pending" | "error" | "rejected";
    /** Fração de 0 a 1. */
    progress: number;
    message?: string;
    /** Presente só enquanto a linha é uma entry da fila. */
    uid?: string;
};
/** Operadores unários: não levam `value`, e a união discriminada os impede de levar. */
export type ConditionUnary = "is_empty" | "is_not_empty";

export type ConditionBinary =
    | "=="
    | "==="
    | "!="
    | "!=="
    | ">"
    | ">="
    | "<"
    | "<="
    | "in"
    | "not_in"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "matches";

export type ConditionOperator = ConditionUnary | ConditionBinary;

/**
 * Uma comparação entre um campo do form e um valor literal. `op` é obrigatório —
 * sem default a diferença entre `==` e `===` fica sempre escrita no schema, que é
 * onde ela precisa estar quando o autor não controla se o campo devolve `"18"` ou
 * `18`.
 */
export type ConditionRef =
    | { field: string; op: ConditionUnary }
    | { field: string; op: "matches"; value: string; flags?: string }
    | { field: string; op: Exclude<ConditionBinary, "matches">; value: unknown };

/** A escotilha de fuga: recebe o mesmo par que uma `validation` de preset. */
export type ConditionFn = (context: { value: unknown; form: unknown }) => boolean;

/** Uma folha: a comparação em si, ou a função de escape. */
export type ConditionLeaf = ConditionRef | ConditionFn;

/** Os combinadores, sobre o nível de baixo. Array é AND. */
export type ConditionGroup<C> = { or: readonly C[] } | { not: C } | readonly C[];

/**
 * O que `visibleWhen` e `disabledWhen` do schema aceitam. Array é AND; `{ or }` e
 * `{ not }` compõem. Ver "Condicionais no schema" no `.claude/CLAUDE.md`.
 *
 * A recursão é **desdobrada em quatro níveis**, e não auto-referente, de propósito:
 * medido, `ConditionGroup<Condition>` faz o checker desistir e resolver o `or` de um
 * grupo já estreitado como `any` — o interior de um `{ or: [...] }` deixaria de ser
 * checado, calado. Quatro níveis é `[{ or: [{ not: [...] }] }]`; o runtime do
 * `matchCondition` recursiona sem limite, então só a tipagem para aí.
 *
 * @example { field: "body_type", op: "in", value: ["json", "form"] }
 */
export type Condition =
    | ConditionLeaf
    | ConditionGroup<ConditionLeaf | ConditionGroup<ConditionLeaf | ConditionGroup<ConditionLeaf>>>;
/* ------------------------------------------------------------------ RSelect */

/** O que um `options` em array de primitivos guarda. */
export type Primitive = string | number | boolean;
export type OptArray = Array<Primitive>;
export type OptArrayObj = Record<string | number, unknown>[];
export type OptObj<T = unknown> = Record<string | number, T>;

/** Os três formatos que o `RSelect` aceita em `options`. */
export type Options = OptArray | OptArrayObj | OptObj;

/**
 * Uma opção já normalizada: o que vai ao model (`value`), o que se lê na tela
 * (`label`) e o item de onde os dois saíram (`original`, o que o `modelFull` guarda).
 */
export type OptionItem<O = unknown, V = unknown, L = unknown> = {
    value: V;
    label: L;
    original: O;
};

/**
 * O que o campo dá à função de `options`. `page` é **1-based**, e um array vazio
 * encerra a paginação — não há cursor a montar.
 *
 * `loaded` é o que já está na lista, para quem prefere paginar por último item em
 * vez de por número. `signal` aborta a requisição obsoleta.
 */
export type OptionsContext = {
    search: string;
    value: unknown;
    form: unknown;
    page: number;
    loaded: OptionItem[];
    signal: AbortSignal;
};

/**
 * A página com o total, para a API que o tem: `total` é quantos itens casam o
 * termo, vai ao rodapé no lugar da contagem do que já carregou e encerra a
 * paginação quando a lista o alcança. O array puro continua valendo.
 */
export type OptionsPage<O extends Options = Options> = { items: O; total?: number };

/**
 * `options` como função: quem busca e pagina é o app, e o módulo é dono do ciclo
 * (debounce, página, fim da lista, erro, retry). Devolve a página — um array, ou
 * `{ items, total }` — e um array vazio encerra.
 *
 * @example const options: OptionsFn = ({ search, page, signal }) => $fetch("/api/usuarios", { query: { search, page }, signal });
 */
export type OptionsFn<O extends Options = Options> = (
    context: OptionsContext
) => O | OptionsPage<O> | Promise<O | OptionsPage<O>>;

/** O que o campo dá ao `resolve`. Sem `search` nem `page`: é uma tradução, não uma busca. */
export type ResolveContext = { value: unknown; form: unknown; signal: AbortSignal };

/**
 * Traduz o valor que já está no model no item correspondente, para a tela de edição
 * mostrar o rótulo em vez do id. Só é chamada quando `options` é função e nem a
 * página corrente nem o cache respondem pela chave — com `modelFull` o model já é o
 * objeto, e `resolve` não é preciso.
 *
 * @example const resolve: ResolveFn = ({ value, signal }) => $fetch(`/api/usuarios/${value}`, { signal }).then((u) => [u]);
 */
export type ResolveFn<O extends Options = Options> = (context: ResolveContext) => O | Promise<O>;