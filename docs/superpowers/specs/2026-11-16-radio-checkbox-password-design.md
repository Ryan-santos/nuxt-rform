# RRadio, RCheckbox, RPassword e a rule `regex`

## Contexto

Três campos novos embutidos no módulo. O motivo imediato é o `RPassword`: hoje ele
existe só no atendas (`app/rform/fields/Password.vue`), e o ATD "Lista de requisitos
ao definir senha" pede uma lista de requisitos marcada enquanto se digita, ligada por
prop, para as telas novas (ATD-251, ATD-255) ganharem a lista só usando o campo — e com
os requisitos num lugar só servindo à lista **e** à validação (hoje a mesma regex está
repetida em duas telas). `RRadio` e `RCheckbox` completam o conjunto de campos de
escolha ao lado do `RSelect`.

Decisões tomadas na conversa:

- a lista do `RPassword` é um array de `{ label, rule }` — qualquer rule (preset,
  função, zod) serve de requisito;
- o indicador de força mede **requisitos atendidos** (sem dependência);
- o gerador de senha entra no módulo e segue a política;
- entra uma rule nova genérica, **`regex`**, que é a peça dos requisitos de classe de
  caractere (minúscula, maiúscula, número, símbolo, caracteres permitidos). Leitura
  minha da mensagem "ter rule nova, regex": **ela substitui** os cinco presets
  específicos (`lowercase`, `uppercase`…) que eu tinha proposto — uma peça só.

Não-objetivos: migrar o atendas (o `Password.vue` de lá e as duas telas viram uma
tarefa à parte, depois de publicar); espanhol no pack do módulo (os rótulos da lista
são do app, e o app traduz); `options` remoto/paginado/`modelFull` em Radio e Checkbox.

## Como fica para quem usa

```vue
<RRadio name="plano" :options="planos" :pick="{ value: 'id', label: 'nome' }" />
<RCheckbox name="aceite" label="form.aceite" />              <!-- booleano -->
<RCheckbox name="dias" :options="['seg', 'ter', 'qua']" />    <!-- lista → array -->

<RPassword
    name="senha"
    autocomplete="new-password"
    strength
    :generate="{ symbols: '@$!%*?&' }"
    :checklist="[
        { label: 'senha.min', rule: { name: 'min', min: 8 } },
        { label: 'senha.minuscula', rule: { name: 'regex', pattern: '[a-z]' } },
        { label: 'senha.maiuscula', rule: { name: 'regex', pattern: '[A-Z]' } },
        { label: 'senha.numero', rule: { name: 'regex', pattern: '[0-9]' } },
        { label: 'senha.simbolo', rule: { name: 'regex', pattern: '[@$!%*?&]' } },
        { label: 'senha.permitidos', rule: { name: 'regex', pattern: '^[A-Za-z0-9@$!%*?&]*$' } }
    ]"
/>
```

## 1. Rule `regex` — `src/runtime/presets/rules/regex.ts`

`{ name: "regex", pattern: string | RegExp, flags?: string, message?: string }`.

- `isBlank(value)` → `undefined` (o `required` continua dono da vacuidade, como `email`/`url`).
- Padrão inválido **lança** com `[rform]` na mensagem — erro de autoria, a mesma linha
  do `matchCondition`. Compila uma vez por `(pattern, flags)` num `Map` de cache.
- Mensagem default `trRule("regex")` → pack `rform.presets.rules.regex`
  ("Formato inválido." / "Invalid format."); `message` troca, como no `schema.ts`.
- `RegExp` com flag `g` teria `lastIndex` com estado: recriar sem `g`/`y` antes do `test`.
- Molde: `presets/rules/schema.ts` (args nomeados + `message`) e `presets/helpers.ts`.

## 2. Tipos de opção saem do `Select.vue`

`OptionOf`, `OriginalOf`, `PropOf`, `KeyOf`, `ValueOf`, `LabelOf`, `OptionKey`
(`Select.vue:364-410`) descem para `src/runtime/type.d.ts`, exportados por
`#rform/types`, e o `Select.vue` passa a importá-los. Radio e Checkbox usam os mesmos.
Manter o `& string` **escrito por extenso na prop** (`pick.value`/`pick.label`) — ver
"O generic do `RSelect` vai até o model" no CLAUDE.md; não embrulhar num alias de dois
parâmetros (TS2590). Guarda: `test/fixtures/basic/components/SelectTypes.vue` continua
passando no `vue-tsc` da fixture.

## 3. `RRadio` — `src/runtime/components/fields/Radio.vue`

- Generic `<Opts extends Options, KeyValue = "id", KeyLabel = "name">`; props
  `options`, `pick` (mesmo formato e default do Select); model = `ValueOf<…>`.
- Reusa `normalizeOptions` + `keyOf` (`utils/normalizeOptions.ts`) para montar as linhas
  e para saber qual está marcada (comparação por `keyOf`, não por `===`, cobre `1`/`"1"`).
- Uma `<label>` por opção com `<input type="radio" :checked @change="model = option.value">`
  — `:checked` + `@change`, **nunca `v-model`** (issue #6; `templates.test.ts` reprova).
  O `name` nativo do grupo é o `id` do campo, para o Tab/setas nativos funcionarem.
- `defaults.default: null`; `ui`: `container` (`w-full`, nunca `grow`), `disabled` logo
  depois do container, `group.container` (`flex flex-col gap-2`), `option.{container,input,indicator,label}`.
  Indicador desenhado por CSS (`peer-checked`), cores só por `--rf-*`, borda de repouso `--rf-color-border`.
- Utils: Label, Description, Error. `disabled` no `withDefaults` como `undefined`,
  junto de `required`/`loading`; repassado a cada input.
- Slot `default` por opção (`{ option, checked }`) para rótulo custom.

## 4. `RCheckbox` — `src/runtime/components/fields/Checkbox.vue`

- **Sem `options`: booleano** (`default: false`), um input só, rótulo pelo `placeholder`
  como o `RSwitch` faz.
- **Com `options`: array dos valores marcados.** `defaults.default` é estático, então a
  normalização para `[]` vai no `opts.get` do `useField` usando `_props.options` cru —
  o mesmo seam do `multiple` do `RFile`. Marcar/desmarcar monta um array novo
  (filtro por `keyOf`), nunca `push` no model.
- Mesmo generic, `pick`, `ui` e slot do Radio; ícone de marcado é `icon("check")`
  (já existe). `inputChecked` (`utils/inputValue.ts`) no ramo booleano.
- Model tipado: `boolean` sem options, `ValueOf<…>[]` com — se a condicional por
  `Opts` estourar o checker, `InternalProps` simples + cast na chamada do `useField`
  (padrão já documentado em "Union type too complex").

## 5. `RPassword` — `src/runtime/components/fields/Password.vue`

Base: o `Password.vue` do atendas (mesmo `ui` do `RText`, `Placeholder` de uma linha,
`Autocomplete`, `Utils["Length"]`), trocando o que é do app:
`UiButton`/`UiTooltip` → `<button type="button">` nativo com `:title`/`aria-label`;
`v-model` → `:value` + `@input="model = inputValue($event)"`.

Props novas (fora do `defaults` quando o "não apaga" do `merger` morderia):

| prop         | tipo                                               | notas                                                                       |
| ------------ | -------------------------------------------------- | --------------------------------------------------------------------------- |
| `checklist`  | `{ label: TrInput; rule: RuleRef }[]`              | liga a lista                                                                |
| `strength`   | `boolean`                                          | barra de força; exige `checklist` (sem ela, `console.warn` e não renderiza) |
| `generate`   | `boolean \| { length?: number; symbols?: string }` | `@generate` liga sozinho, como no atendas                                   |
| `onGenerate` | `(password: string) => void`                       |                                                                             |

`generate`, `strength` e `checklist` entram no `withDefaults` como `undefined`
(boolean casting).

**Avaliação ao vivo.** As rules da lista são resolvidas por `resolveRule` com a tabela
de `import("#rform/presets")` (mesmo import dinâmico do `useField`). Um `watch` do
model roda cada item e grava o estado por índice: `met` | `pending`. Corrida contra
tecla rápida: token `++token`, descartado se mudou (molde do `useRemoteOptions`).
**Campo vazio → todos neutros**, sem rodar nada (edição de usuário com senha opcional).

**Validação do form.** A lista vira uma rule a mais do campo. Seam novo no `useField`:
`Options.rule?: (rule) => rule`, aplicado dentro do `watch(() => props.value.rule)`
(mesma forma do `get`/`set`). O `Password` devolve `[...rule do call site, checklistFn]`.
O `checklistFn`: vazio → `undefined`; senão roda os itens, marca `attempted = true` e,
havendo falha, devolve `tr("rform.fields.password.checklist")`. Com `attempted`, os
itens não atendidos renderizam como **erro** (ícone + cor), e voltam a `met` conforme
são corrigidos. O `RUtilsError` **não** renderiza quando a mensagem do bag é a do
checklist — a lista é que fala (critério do ATD); erro de outra rule (`required`)
continua aparecendo.

**Itens com ícone, não só cor**: `met` → `check`, `pending` → `circle`, erro → `remove`.

**Força**: `met / total` → `weak` (< 50%), `medium` (< 100%), `strong` (100%); barra
de N segmentos + texto do pack. Cores `--rf-color-danger`/`warn`/`success`.

**Gerador** — `src/runtime/utils/generatePassword.ts`, puro, no barrel:
`generatePassword({ length = 16, symbols = "@$!%*?&" })` com `crypto.getRandomValues`,
garantindo ≥ 1 de cada classe (minúscula, maiúscula, dígito, símbolo se houver) e
embaralhando (Fisher–Yates). O campo sorteia e **confere contra o `checklistFn`**,
até 20 tentativas; se nenhuma passar, `console.warn` com `[rform]` dizendo que
`generate.symbols` não casa com a lista. Ao gerar: escreve o model, mostra a senha
(`visible = true`) e chama `onGenerate`.

`defaults.text`: `show`, `hide`, `generate`, `strength: { weak, medium, strong }`,
`checklist`. Lidos como `tr(props.text?.show)` (árvore aninhada, `TextProp<…>`).

## 6. Ícones, pack, tema

- `module.ts` `prefixIcons`: + `eye` (`fa6-regular:eye`), `eye-off`
  (`fa6-regular:eye-slash`), `key` (`fa6-solid:key`), `circle` (`fa6-regular:circle`).
  `test/unit/icons.test.ts` exige o conjunto igual ao usado.
- `src/runtime/locales/pt-BR.ts` e `en.ts`: `fields.password.*` e `presets.rules.regex`
  (o `en` é tipado contra o `pt-BR`; `i18n.test.ts` cobra paridade e as quatro raízes).
- Nenhuma classe de cor/radius crua — `theme.test.ts` (tokens iguais nos dois sentidos,
  `BANNED` de borda). Sem classe Tailwind dentro de comentário/JSDoc.

Registro, `FieldType`, `components-map`, `Components` e schema saem sozinhos do
`collectComponents` (`src/scan.ts`) — nenhum nome novo é reservado. Conferir que
`password`, `radio`, `checkbox` aparecem no `FieldType` gerado após `dev:prepare`.

## 7. Testes

- `test/unit/presetsBuiltin.test.ts`: `regex` — casa, não casa, vazio, `flags`,
  `message`, padrão inválido lança, `RegExp` com `g` não guarda estado.
- `test/unit/generatePassword.test.ts`: comprimento, uma de cada classe, só caracteres
  do alfabeto.
- `test/nuxt/Radio.test.ts`, `Checkbox.test.ts`: três formatos de `options`, `pick`,
  model escrito com o valor (não string do DOM), `disabled`, booleano vs array, dentro
  de `RForm`.
- `test/nuxt/Password.test.ts`: toggle de visibilidade; lista marca/desmarca ao digitar;
  vazio sem acusar; `form.validate()` reprova e marca itens como erro sem o
  `RUtilsError`; `required` ainda mostra erro; gerar deixa todos `met`; força.
- `test/nuxt/suspense.test.ts`: incluir os três (janela do `:value`).
- `test/nuxt/fieldLayout.test.ts` e `hookClasses.test.ts` varrem `fields/*` — devem
  passar sem lista nova; o `Password` entra no `describe("placeholder parado")`.
- Fixture: `SelectTypes.vue` intacta; um `RadioTypes.vue` com o model tipado.

## 8. Documentação e playground (agentes `docs` e `playground`, depois do código)

- `docs/content/{pt,en}/…/fields/{radio,checkbox,password}.md` + demos em
  `docs/app/demos/{Radio,Checkbox,Password}/`, chaves `demo.*` nos dois packs do site,
  `regex` na página de presets. `docs.test.ts` cobra paridade e demos citados.
- `playgrounds/i18n/app/pages/form.vue` (smoke test) ganha os três.
- CLAUDE.md: seções curtas para o seam `opts.rule` do `useField`, a lista do Password
  (erro pela lista, não pelo `RUtilsError`) e o model do Checkbox via `opts.get`.

## Verificação

1. `pnpm run dev:prepare` e `pnpm exec nuxi prepare test/fixtures/basic`.
2. `pnpm test` (unit + nuxt + e2e), `pnpm run test:types` (os oito alvos),
   `pnpm run lint`.
3. `pnpm play` → `/form`: digitar a senha e ver a lista marcar, salvar com item faltando,
   gerar senha, alternar idioma pt/en; Radio/Checkbox com os três formatos.
4. `pnpm run docs:build` e conferir `api.json — N componentes` com os três novos.

Ao aprovar, o desenho acima é salvo também em
`docs/superpowers/specs/2026-11-16-radio-checkbox-password-design.md`.