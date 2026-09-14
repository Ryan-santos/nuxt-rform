@rules/comentarios.md

# rform

Nuxt module that ships form components (`RForm`, `RText`, `RSelect`, `RArray`, etc.) built around an injection-based composition pattern.

## Arquitetura

### O nome no npm é `nuxt-rform`; tudo o mais é `rform`

São duas coisas distintas, e o `module.ts` as separa de propósito:

| | valor | de onde vem |
|---|---|---|
| nome no npm, `meta.name` | `nuxt-rform` | `import { name as pkg } from "../package.json"` |
| `configKey`, `#rform`, `app/rform/` | `rform` | `const name = "rform"`, no próprio `module.ts` |

`rform` **já existe no npm** — um pacote React/Redux sem relação, publicado desde
2016 —, então o prefixo `nuxt-` não é só a convenção que a página do ecossistema
recomenda para módulo de terceiro: é a única forma de publicar. E o `configKey` e
o alias não podem pagar por isso, porque são contrato público: `#rform/utils` está
escrito em todo preset de usuário, e `app/rform/fields` no disco de quem já usa.

O acoplamento existia porque todo `${name}` do `module.ts` — 40 e poucos, entre
nome de template, raiz em `srcDir` e alias — saía do `package.json`. A separação é
uma constante local com o nome curto, e o `pkg` sobrevivendo só no `meta`. Cuidado
ao mexer: dentro dos `map(({ name }) => …)` o `name` é o do **componente**, e
sombreia — foi por isso que a constante manteve o nome `name` em vez de virar
`SHORT`, e o import é que ganhou o apelido.

### Layout dos componentes

```
src/runtime/components/
  Form.vue      ← não é campo; provê a raiz da injeção. Reservado.
  Dynamic.vue   ← não é campo; renderiza um schema. Reservado.
  fields/       ← É o FieldType, por construção
  utils/        ← Label, Error, Placeholder… (RUtils*)
```

`src/runtime/utils/` continua sendo helper TS (`merger`, `vMask`, `definePreset`) — não colide, porque componente mora sob `components/`.

`fields/` **ser** o `FieldType` é o ponto: não existe mais lista de exclusão `["Form", "Dynamic"]` no `module.ts`, e o `Form.vue` deixou de declarar `Element<typeof defaults, "form">` com um `"form"` que nunca existiu no union.

### Padrão de componente

Todo componente em `components/fields/*.vue` e `components/utils/*.vue` — embutido **ou** do usuário — segue o mesmo formato:

1. **`<script lang="ts">`** — exporta `defaults` (via `defineDefaults`) e o tipo `Props`. Campo monta `Props` a partir de `Element<typeof defaults, "<tipo>">` (de `src/runtime/type.d.ts`) interseccionado com `Utils["..."]` (de `#rform/types/components/utils/props`), `TextProp<typeof defaults.text>` quando há texto, e props específicas; util escreve `Props` à mão e referencia `DeepPartial<typeof defaults.ui>` (mais `TextProp<typeof defaults.text>`, no mesmo caso).
2. **`<script setup lang="ts">`** — campo chama `await useField(_props)` para obter `{ id, model, props, tr, locale }`; util chama `await useUtil<Props>()`, que devolve `{ props, upper, tr, locale }`. Containers (Form, Array, Object) também chamam `useProvide({ id, model })`.
3. **`defaults`** sempre define `ui` (classes Tailwind); campo também define `default` (valor inicial do model); quem tem texto define `text`, um **objeto aninhado** de chaves de tradução do módulo — é o marcador que autoriza o auto-prefixo `rform.<fields|utils>.<componente>.`, e a árvore mantém a forma até o template: `text: { button: "add" }` lê `tr(props.text?.button)`, nunca uma prop `buttonText` de nível superior. Outros campos (`keyValue`, `keyLabel` no Select, `max` num Rating) também viram defaults mesclados via `merger` — e ficam fora do `text` justamente porque não são texto. `label` e `placeholder` são as duas exceções: moram no topo por contrato (um app os passa direto), mas ainda são `TrInput` e ainda são prefixados quando o valor vem do próprio `defaults` do componente.

`Base["default"]` é **opcional** justamente para o item 1 valer nos dois: um util tem `ui` mas não tem model. Antes os utils usavam um par `defaultUi` + `defaults: Props` que não passava por `defineDefaults` — eram duas convenções, e só uma estava documentada.

### Campos e utils do usuário (`app/rform/fields|utils`)

Um `.vue` em `app/rform/fields` é um campo de **primeira classe**: entra no `FieldType` (então `useRForm`/`RDynamic` aceitam `type: "rating"`), no `components-map`, no `Components` (então `defineFieldDefaults({ Rating: … })` tipa) e pode ser alvo do `available` de um preset. `app/rform/utils` faz o mesmo para os `RUtils*`.

Mesmo nome de um embutido **substitui** o embutido inteiro — mesma precedência dos presets. Para embrulhar em vez de reescrever, o original continua alcançável pelo alias `#rform/builtin`:

```ts
import Base, { defaults as base } from "#rform/builtin/fields/Text.vue";
```

Esse alias é registrado **antes** de `#rform`: o Vite casa aliases na ordem de inserção, então o prefixo mais curto engoliria o mais longo. (No TS não importa — `paths` resolve pelo padrão mais específico.)

`Form` e `Dynamic` são nomes reservados; um `app/rform/fields/Form.vue` falha o build nomeando o arquivo.

### Escaneamento e templates gerados (`src/scan.ts`)

`collectComponents` é puro e recebe as raízes já lidas, na ordem embutido→usuário — quem vem depois vence, igual ao `collectPresets`. Desse escaneamento único saem `types/components/*`, `types/fields.d.ts`, `types/schema.d.ts`, `components-map.ts`, `registry.ts` e as raízes do vite plugin. Nome de arquivo precisa ser PascalCase alfanumérico, porque vira chave de objeto **e** membro do `FieldType`.

Os `import()` de `.vue` nos templates de tipo saem **relativos**. O `@vue/compiler-sfc` resolve import relativo com `fs` puro, e manda qualquer outra coisa para a resolução de módulos do TypeScript, que sozinha não resolve um specifier `.vue`.

### useField (`src/runtime/composables/useField.ts`)

- Lê o pai (Form) via `inject(key)`. Quando há pai e `props.name` está definido, `model.value` lê/escreve diretamente em `upper.model.value[name]` — é por isso que mutações em arrays no model do filho refletem no Form.
- Mescla `defaults` + defaults do usuário + `localProps` + `sourceProps` via `merger` — e sobrescreve o `error` depois, que é a única prop com duas procedências (ver "O `error` é `TrInput`", adiante) — depois de passar o `defaults` do componente pelo `prefixText`, que é o que dá procedência de graça ao texto (ver `defaults.text`, na seção de i18n).
- Carrega os defaults do componente pelo `#rform/registry` gerado (`nome → () => import(path)`). **Não** pode ser `import('../components/${name}.vue')`: o Vite compila isso num glob ancorado no arquivo da composable, e um campo em `app/rform/fields` não faz parte dele. As entradas são thunks, então o ciclo `Text.vue → useField → registry → Text.vue` não fecha em tempo de carga.
- `componentName` vem do `src/vite.plugin.ts`. Nome ausente ou fora do registry **lança**. Havia um fallback `"Text"` (e `"Label"` no `useUtil`) que renderizava o campo com os defaults de outro componente sem dizer nada.
- O `useModel` recebe `sourceProps`, **não** `props.value`: este é o snapshot que o `merger` devolveu durante o setup, um objeto simples que o `useModel` não rastreia — o `localValue` congelaria no `modelValue` inicial, e toda mudança posterior no objeto ligado (um reset, uma carga async) deixaria o campo escrevendo num objeto destacado.
- O `get()` **clona** o `default` no fallback. `props.value.default` é o próprio objeto que o componente declarou em escopo de módulo — o `merger` copia objeto e array por referência quando a chave existe numa fonte só. Entregá-lo cru deixava um filho escrever direto nele (um `RObject` destacado, cujo índice acabou de ser removido, ainda lê por ali), poluindo o default de toda instância seguinte no processo. O `??` mantém o clone preguiçoso.
- O `seed()` desiste quando o índice está **além do fim** do array — o array acabou de encolher (um splice do botão de remover, ou um reset que devolveu o default vazio). Semear ali ressuscitaria o slot: o watcher é `flush: "sync"`, então roda antes de o `v-for` desmontar o item, e `arr[length] = default` cresce o array de novo.
- `#rform/presets` é importado **dinamicamente**, e só quando o campo declara `rule` ou `mask`. O barrel importa todo preset estaticamente e toda rule importa zod, então um import estático aqui poria zod no caminho crítico de qualquer página com campo, validado ou não. A carga inicial é aguardada dentro do `setup`, onde o registry já é aguardado; um `rule` que aparece depois resolve pelo `loadPresets` no watcher, um microtask atrás — que a validação, sendo async, não percebe.
- O `fn` que o campo registra no `rulesList` **só devolve a mensagem**: não escreve no `error` e não lança. Quem escreve é o `errorsBag` (adiante), e é isso que mata os dois escritores concorrentes do mesmo slot — e a unhandled rejection do `@submit.prevent`.
- `upperId`/`id` são montados **antes** do `useModel`, e não mais depois do `provide(keyProp)`: o setter do model precisa do `id` para descartar a entrada do bag. Sem mudança de comportamento — `id` só lê `sourceProps.name` e `upper`, ambos prontos ali.

### O `errorsBag`: um escritor só para o `error` (`src/runtime/composables/errorsBag.ts`)

O Form provê cinco coisas, e as direções não são as mesmas:

| provide | direção | o que carrega |
|---|---|---|
| `useProvide` | Form → campo | `{ id, model }` — a raiz da injeção |
| `defineFormRoot` | Form → campo | o model inteiro, para o `form` de toda `validation` |
| `defineRulesList` | campo → Form | **pull**: `id → () => Promise<string \| void>` |
| `definePendingList` | campo → Form | **pull**, antes de tudo: `id → () => Promise<string \| void>` |
| `defineErrorsBag` | Form → campo | **push**: `id → string` |

Os dois últimos são chaveados pelo **mesmo `id` pontilhado**, e é a inversão que faz tudo caber: o bag é o **único escritor** do `error` de um campo. O Form junta as duas fontes — os issues do `:rules` agregado e o retorno de cada `fn` do `rulesList` — num mapa só e escreve no bag; o watcher de cada campo espelha `bag[id]` no próprio ref `error`.

- **O setter do model apaga a entrada do bag**, além de zerar o `error`. Sem isso a mesma mensagem empurrada duas vezes (submit → corrige → submit) não é mudança para o watcher, e o erro simplesmente não reaparece — modo de falha mudo.
- **`flush: "sync"`** no watcher, pelo mesmo motivo do watcher de seed: o setter do model limpa o erro de forma síncrona, e um flush atrasado inverteria a ordem.
- `validate()` **devolve `boolean`** e nunca rejeita, e **recalcula tudo**: o mapa é substituído por inteiro, não acrescentado — é o que cobre o model mudado por fora (`data.value.nome = "x"` não passa pelo setter do campo, e o erro ficaria grudado). `submit()` devolve `undefined` quando passou, ou o mapa de erros.
- As portas de entrada de um erro vindo de fora são o **retorno do `onSubmit`** e o `setErrors` do `defineExpose`. **Não há prop `errors`**: em modo `schema`/`RDynamic` não existe tag de campo para receber um `:error`, então o canal tem de ser do Form.
- `issue.path.join(".")` casa com o `id` do `useField` **por construção** — o `name` de um filho de `RArray` *é* o índice, então `["itens", 0, "nome"]` → `"itens.0.nome"`. Issue de raiz (`path: []`) vira a chave `""`, que nenhum campo tem: aparece no retorno do `submit` e não renderiza em lugar nenhum.
- A rule do campo **vence** o issue agregado: é a declaração mais local.
- Em modo `schema` o mesmo `rule` valida duas vezes — uma pelo campo, uma pelo agregado. As mensagens são idênticas (é o mesmo preset), então o resultado é correto e só desperdiça um parse; não vale mecanismo para evitar. É por isso que `docs/app/demos/Form/modo-schema.vue` continua **sem** `:rules`, e o `modo-zod.vue` passou a ter.

#### O gancho de pendência no `RForm` (`src/runtime/composables/pendingList.ts`)

Espelho exato do `rulesList` — mesma assinatura de entrada (`() => Promise<string | void>`), mesma chave (o `id` pontilhado do campo), `define*` no Form e `inject*` no campo. O que muda é **quando** o Form o consome: primeiro, antes do `:rules` agregado e antes das rules de campo.

```ts
const pending = await Promise.all(
    [...pendingList.value.entries()].map(async ([key, fn]) => [key, await fn()] as const)
);
```

A ordem importa duas vezes. **Antes**, porque o `safeParseAsync` do `:rules` precisa rodar sobre o model já assentado — um upload que ainda não voltou deixaria o parse ver `null` onde vai haver um objeto. **E a mensagem entra por último**, com `messages[key] ??= message`: a declaração mais local continua vencendo, então uma `rule` do campo fala na frente do "o envio falhou".

**A entrada resolve, nunca rejeita, e resolve na _liquidação_ — não no sucesso.** Um upload que falhou devolve a mensagem (`rform.fields.file.failed`) e a validação segue; sem isso um arquivo que falhou sumiria do submit calado, que é a classe de falha que este repo persegue em toda parte.

Quem registra hoje é só o `RFile`, e ele **apaga a própria entrada no `onUnmounted`** — um `RFile` dentro de um `RArray` que some deixaria o Form esperando por uma fila morta, e pior, reprovando o submit por uma falha que já não está na tela. O `export default { definePendingList, injectPendingList }` é obrigatório: o template de `#rform/composables` emite `import <basename> from` e **não** faz `export *`, ao contrário do `#rform/utils`.

#### O `error` é `TrInput` na entrada e `string` na saída

`error` é chave de tradução como `label` e `placeholder` — `<RText error="form.erros.nome" />`, e num app com i18n um literal solto ali é erro de compilação, como em toda prop de texto. Mas ele é a única delas com **duas** procedências, e é isso que decide onde a tradução acontece:

| de onde vem | o que é | quem resolve |
|---|---|---|
| `sourceProps.error` — o call site | `TrInput` | `useField`, dentro do computed de `props` |
| o `errorsBag` — rule, issue do `:rules`, `setErrors` | mensagem pronta | ninguém: já veio resolvida |

Por isso o `error` interno **não mora mais no `localProps`**: é um `ref<string>` à parte, e o computed escolhe entre os dois com `sourceProps.error ? tr(sourceProps.error) : error.value`.

**Resolver no `RUtilsError`, como o `Label` faz, seria o simétrico e está errado.** Um `tr` sobre a mensagem do bag a levaria ao `t` do app — e com ponte isso é o aviso de *missing key* do vue-i18n uma vez por campo inválido, em toda submissão. O `tr` de um lado só é o que mantém a mensagem de uma rule intacta. `test/nuxt/formErrors.test.ts` grava a fronteira empurrando `"rform.presets.rules.required"` pelo `setErrors` e exigindo que ele **apareça cru**.

A contrapartida é que o tipo de entrada e o de leitura divergem, e os dois estão escritos: `Element["error"]` é `TrInput`, e `FieldProps<T>` (`useField`) troca a chave por `string` — que é o que `UtilProps` herda e o que todo template de campo lê. É a mesma assimetria que `WithTextSource` e o `ui` de `UtilProps` já carregam.

#### O foco é resolvido pelo DOM

`focusFirstError` (`src/runtime/utils/`) procura `.RUtilsError`, sobe até o `.RField` dono e foca o primeiro focável dentro dele — `focus({ preventScroll: true })` e **depois** `scrollIntoView({ block: "center" })`, porque o `focus()` sozinho rola de forma abrupta e descentralizada. Os dois ganchos já existem e já são testados (`hookUi`).

**Pelo DOM, e não pelo `rulesList`**: o registro está em ordem de registro, e "primeiro campo com erro" é uma afirmação sobre a ordem **visual**. `querySelector` responde em ordem de documento e cobre de graça tanto o campo que o `RDynamic` renderiza quanto o que o app escreveu à mão. O escopo é o `ref="form"` do próprio `<form>`, e é ele que impede um `RForm` de roubar o foco de outro na mesma página. O `nextTick` antes da chamada é obrigatório: o watcher do campo é síncrono, mas o `<p class="RUtilsError">` só existe depois do render.

`scrollIntoView` **não existe no happy-dom/jsdom**, e `focus()` é no-op numa árvore destacada — daí o `Element.prototype.scrollIntoView = vi.fn()` e o `attachTo: document.body` em `test/nuxt/formErrors.test.ts`.

#### `focusError` não pode morar no `defaults`

Dois modos de falha calados no mesmo prop, e por isso ele fica **fora** do `defaults` e é lido como `!== false`:

- o `merger` pula quando o resultado é truthy e o valor novo é falsy (a regra "não apaga"), então um `defaults.focusError: true` seria **impossível** de desligar com `:focus-error="false"`;
- `focusError?: boolean` compila com `type: Boolean`, e o boolean casting do Vue transformaria a prop **ausente** em `false` — daí ele entrar no `withDefaults` como `undefined`, junto de `required` e `loading`.

O mesmo vale para `rules`: `defaults` só existe para semear o `merger`, e o `merger` copia qualquer chave de `sourceProps` de qualquer jeito.

### Condicionais no schema: `visibleWhen` e `disabledWhen`

Duas chaves do **schema**, não props de campo. No modo template o `v-if` do próprio
Vue já resolve — e resolve melhor, porque o campo desmonta e leva a `rule` junto.
No modo schema não há markup onde escrevê-lo: um `<RDynamic :schema>` vindo de uma
rota do Nitro não tinha como dizer "o `body` só aparece quando `body_type` é `json`
ou `form`". Quem lê as duas é o `RDynamic`, que decide o `v-if` e preenche o
`disabled` do campo.

Junto delas, `disabled` virou prop base de verdade: antes só o `RFile` a tinha, e um
`<RText disabled>` não fazia nada, calado. Essa continua sendo prop, e das duas é a
única que vale numa tag escrita à mão.

**Isso já foi prop de campo**, com o `useField` calculando um `visible` que cada
componente aplicava num `v-if` da raiz. Custava um `v-if` em quinze templates, um
`visible` no retorno da composable e um acessor tardio do model dentro do
`useField` — tudo para dar, no modo template, uma segunda forma de escrever o `v-if`
que o Vue já tem. Do arranjo antigo sobrou o que ele consertou de verdade: o
`disabled` como prop base e o `rulesList.delete` do `onUnmounted`.

O avaliador é `matchCondition` (`src/runtime/utils/`), puro e testável sem app, e a
forma é a mesma que o `rule` já aceita — um objeto, um array (AND), `{ or }`,
`{ not }` ou uma função. Os tipos moram em `src/runtime/type.d.ts`, importados como
`import type`: `importsRformValue` ignora import de tipo, então o helper não vai
para o fim da lista de reentrantes do barrel.

**`op` é obrigatório, e não há default.** `{ field: "x", value: 1 }` não compila. A
diferença entre `==` e `===` fica sempre escrita no schema, que é onde ela precisa
estar quando o autor não controla se o campo devolve `"18"` ou `18`. E a união
discriminada é o que paga o `flags`: com os unários (`is_empty`, `is_not_empty`)
tipados sem `value`, o `matches` declara o próprio `flags?: string` sem que ele
apareça nos outros quinze — regex sem `i` é metade dos casos, e `(?i)` não existe
em JS.

**A linha entre lançar e não casar**, e é a mesma escolha do `fromPreset`:

- **erro de autoria lança**, alto, com `[rform]` na mensagem — operador
  desconhecido, `op` ausente num schema vindo de API, `value` que não é array num
  `in`, padrão de regex inválido;
- **dado ausente não lança** — um `field` apontando para caminho inexistente devolve
  `undefined`, e o operador simplesmente não casa.

`in` e `contains` são inversos e os dois são necessários: o primeiro pergunta se o
campo está numa lista fixa do schema, o segundo se o campo (um `RSelect multiple`,
uma string) contém um item.

#### O contexto é `{ form, path }`, e o `value` sai do `path`

`matchCondition` recebe o form inteiro e o **caminho do próprio campo**, não o valor
já resolvido — e é ele quem desce o caminho quando uma condição em forma de função
pede o `value`. O caller passa o que já tem em mão (o `id` pontilhado, o mesmo que
chaveia as rules), e não há como o valor chegar dessincronizado do form.

`path` é opcional porque só a função o lê: as quinze comparações declarativas olham
`condition.field`, que é outro caminho.

#### O curto-circuito quando a condição é `undefined`

`evaluate` sai antes de ler o `formRoot` quando o campo não declara a condição.
Sem isso o `rest` de **todo** campo do schema passaria a depender do model, e uma
tecla em qualquer um invalidaria as props de todos os outros. Com o curto-circuito
só quem declarou paga, e a leitura reativa é `form.body_type`, que o Vue rastreia
por propriedade.

**Sem `formRoot` (um `RDynamic` fora de `RForm`) a condição não é consultada** — o
campo fica visível e habilitado, e sai um `console.warn` nomeando a prop. Avaliar
contra `undefined` esconderia o campo calado.

`disabled` ganha **duas procedências**, exatamente como o `error`, e o valor escrito
no schema vence: `r.disabled ?? evaluate("disabledWhen")`. Nos dois sentidos —
`disabled: false` mantém o campo ligado contra a condição.

#### O registro do escondido é do `RDynamic`, não do campo

O campo escondido **não monta**, então não tem como tirar a própria mensagem da
validação. Quem o registra no `hiddenList` é o `RDynamic`, que continua na árvore:
um `watch(visible)` com `flush: "sync"` e um `onUnmounted` que limpa.

O `id` é montado uma vez, como no `useField` — `inject(key)` para o prefixo do
container mais o `name` —, e por construção é a mesma chave pontilhada que o
`rulesList`, o `pendingList` e o `errorsBag` usam. Uma linha de `RArray` fica com o
índice que recebeu.

O `rulesList.delete` no `onUnmounted` do **`useField`** é outra coisa, e é correção
de um bug latente adjacente: o `useField` nunca limpava a própria entrada, então uma
linha removida de um `RArray` deixava uma rule órfã continuando a reprovar o submit
sobre um model descartado. Ele é também o que faz o `v-if` do modo template tirar o
campo da validação de graça.

#### O filtro é um ponto só, na saída do `validate()`

O `hiddenList` (`composables/hiddenList.ts`) é cópia estrutural do `rulesList` /
`pendingList` — `shallowRef<Set<string>>` mutado no lugar, `define*` no Form,
`inject*` no `RDynamic`, `export default` obrigatório porque o template de
`#rform/composables` emite `import <basename> from` e não faz `export *`.

O Form o consome **uma vez**, depois de as três fontes terem montado `messages` e
antes de escrever no bag. **Um ponto só, e é o que faz a feature caber:** as três
fontes (rule do campo pelo `rulesList`, issue do `:rules` agregado, retorno do
`pendingList`) são chaveadas pelo **mesmo `id` pontilhado**, então o filtro cobre as
três de uma vez — inclusive o `:rules` agregado, que é montado no `useRForm` e não
tem como saber de condição nenhuma. Por isso `useRForm.ts` e `aggregateRules` ficam
**intocados**.

E o retorno do `validate()` sai do mapa **já filtrado**, senão um campo escondido
reprovaria o submit sem mostrar erro nenhum na tela.

O casamento é por **prefixo** (`key === h` ou `key` começando com `h` mais ponto), e
é o que cobre um `object` escondido: `endereco` no `hiddenList` derruba
`endereco.cep` e `endereco.uf`. Note que o filtro só trabalha de verdade sobre o
`:rules` agregado — um filho que desmontou já levou a própria rule junto, pelo
`onUnmounted`.

**Campo escondido mantém o valor no model.** Só `visibleWhen` tira da validação;
**`disabled` continua sendo validado**, e é decisão explícita — ele mexe em UI e
interação, e o HTML não é a autoridade sobre o que está no model.

#### O nome da chave é camelCase, o valor do operador é snake_case

Não é inconsistência: `op: "is_empty"` é um *valor*, e ali snake_case é a convenção
da casa; já a chave espelha o nome de prop que o resto do módulo usa.

**No schema, snake_case é aceito para qualquer chave composta** — `visible_when`,
`disabled_when`, e de graça `model_full`, `on_search`. Não é uma tabela
de apelidos: é uma regra, com duas metades.

**Runtime**, no `rest` do `Dynamic.vue`. As duas condicionais são resolvidas antes,
por nome, num `CONDITIONS` de duas entradas — elas não são props de campo nenhum, e
o `delete` das quatro grafias é o que as impede de sair como
`visible_when="[object Object]"` no `<div>` raiz. O que sobra passa pela regra geral,
e o que a torna segura é que o `components-map.ts` gerado importa os componentes
**estaticamente**, então `resolved.value.props` é a declaração compilada do
`defineProps`: dá para traduzir só o que de fato é prop **daquele** campo. Três
guardas, cada uma cobrindo um modo de falha:

- a **regex** (`/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/`) exclui `__proto__` e
  `constructor` de saída — atribuir com chave calculada é onde poluição de protótipo
  entraria;
- o **`declares`** é o que dissolve a objeção contra a regra geral: um campo de
  usuário com uma prop legitimamente chamada `foo_bar` não é renomeado, porque
  `fooBar` não está nas props dele. Nada é perdido e nada é renomeado calado;
- o **`delete`** não é higiene. O `rest` é espalhado com `v-bind`, e chave que não
  casa com prop declarada vira **atributo de fallthrough**.

`r[camel] ??= r[key]`: quem escreveu as duas quis a explícita.

**Tipo**, no `Base<P, C>` do template de `schema.d.ts` (`src/module.ts`). As
condicionais entram por um `Conditions` escrito à mão (não vêm do `P`, porque não
são props), e o apelido delas sai do mesmo `SnakeAliases` que já cobre o `P`.
`Snake<K> extends K ? never` derruba toda prop de uma palavra só — sem isso `label`
e `name` voltariam como si mesmas e colidiriam com as chaves explícitas.

#### `Condition` é desdobrada, não auto-referente

A forma óbvia — `ConditionGroup<Condition>` dentro do próprio `Condition` — **faz o
checker desistir**. Medido: com ela, o `or` de um grupo já estreitado
(`"or" in condition`) resolve como `any`, e o interior de um `{ or: [...] }` deixa
de ser checado, calado. Um `{ field: "a", op: "equals" }` ali passaria a compilar.

A saída é desdobrar a recursão em **quatro níveis** (`ConditionLeaf` +
`ConditionGroup<C>` aninhado três vezes), o que é `[{ or: [{ not: [...] }] }]`. Aí o
checker rejeita o operador errado nos quatro, medido com `@ts-expect-error` nos três
níveis. O runtime do `matchCondition` recursiona sem limite — só a tipagem para aí.

Isso **já teve outra causa**: enquanto `Condition` morava no `Element`, a forma
auto-referente estourava o "Type instantiation is excessively deep" no `merger` do
`useField`. Esse caminho não existe mais — o `Element` não conhece `Condition` —, e
a auto-referência foi remedida agora que ele sumiu. O motivo de continuar desdobrada
é o outro, e é pior: aquele falhava alto, este falha calado.

#### Campo do usuário não precisa fazer nada pelo `visibleWhen`

Quem decide montar é o `RDynamic`, então um `.vue` em `app/rform/fields` entra no
schema como qualquer embutido, sem uma linha a mais.

O `disabled`, sim, o campo honra sozinho: o `useField` o entrega em
`props.disabled`, e o template o repassa ao controle nativo e ao `ui.disabled` do
container. `test/fixtures/basic/rform/fields/Rating.vue` e as cópias no `docs/` e no
`playgrounds/i18n` são o exemplo vivo.

`disabled` num container (`Object`, `Array`) **não cascateia** para os filhos: o
`pointer-events-none` bloqueia o mouse por CSS, mas não tira os filhos do Tab. Quem
quer filho desabilitado põe `disabledWhen` no filho. Limite conhecido.

O `File` fica com a própria semântica de `disabled` (`ui.group.disabled`, mais rica:
congela a dropzone e as ações da lista, e o que já subiu continua visível); só o
`disabled?: boolean` duplicado saiu do `Props` dele, que agora vem do `Element`. Nos
outros doze o `disabled` do `ui` entra **logo depois de `container`**, e a posição
importa: o `hookUi` prepende `RField RText` na **primeira entrada que guarda
classes**.

E `disabled: undefined` entra no `withDefaults` de cada campo junto de `required` e
`loading`: `disabled?: boolean` compila com `type: Boolean`, e o boolean casting
transformaria a prop **ausente** em `false`, apagando a diferença entre "não
declarei" e "declarei desligado". Não é o que faz a condição funcionar — quem
decide o `disabled` no schema é o `RDynamic`, e ele sempre passa um booleano
explícito —, é a mesma convenção que `required` e `loading` já seguem.

É por isso que o `Select`, que não tinha `withDefaults` nenhum, ganhou um só para
essa chave. **O `required` e o `loading` dele continuam sendo castados**, e por
tabela o `<RUtilsLoading v-if="props.loading !== undefined">` renderiza sempre ali.
Desvio anterior a isto, deixado de lado de propósito.

### useUtil (`src/runtime/composables/useUtil.ts`)

- A sobrecarga que recebe o `defaults` do componente é **síncrona**, e é esse o ponto: um campo renderiza seis utils, e todo `await` num `setup` transforma o componente em async — uma boundary de Suspense e um salto de microtask antes de a subárvore existir, pagos até pelos cinco utils que decidem não renderizar nada. O `<script setup>` compartilha escopo com o `<script>`, então o objeto já está em mão; buscá-lo no registry era ida e volta para pegar o que o chamador estava pisando. A forma sem argumento continua resolvendo pelo registry e continua devolvendo promise, porque um util escrito antes disso chama assim.
- As três leituras — `inject`, `userDefaults` e `useTranslate` — acontecem **antes de qualquer `await`**: as duas primeiras precisam da instância do componente ainda corrente, e no caminho legado a continuação roda num microtask, muito depois de o Vue tê-la limpado.

### useRForm (`src/runtime/composables/useRForm.ts`)

- A tabela de presets é buscada **dentro** do `superRefine`, não no import. Estaticamente, este módulo era a última aresta de `#rform/composables` para `#rform/presets`, e os arquivos de preset chamam `defineRule(...)` em escopo de módulo — efeito colateral que o Rollup não consegue provar inócuo — então toda página que importasse *qualquer* composable do barrel embarcava as nove rules e, com elas, zod. O refinement já é async, e o import é no-op depois que o chunk carregou.
- O `rules` agregado **deixou de ser órfão**: quem o consome é `<RForm :rules>`, que faz o `safeParseAsync` no submit e distribui cada issue pelo `path` (ver "O `errorsBag`"). Nada mudou aqui — o formato já saía certo.

### Defaults do usuário (`app/rform/defaults.ts`)

Arquivo único, opcional, chaveado por nome de componente — é o que sobrepõe o `defaults` que cada componente declara:

```ts
import { defineFieldDefaults } from "#rform/utils";

export default defineFieldDefaults({
    Text: { default: "", ui: { container: "gap-2" } },
    Utils: { Placeholder: { ui: { default: "text-xs" } } }
});
```

Entra no `merger` entre o `defaults` do componente e as props do call site, então **prop no campo sempre ganha**. `useField` lê `userDefaults[componentName]`; `useUtil` lê `userDefaults.Utils?.[componentName]`.

`src/module.ts` gera `#rform/defaults.ts`: reexporta o arquivo do usuário quando ele existe, senão emite `const defaults = {}`. Nos dois casos o template existe, então as composables importam sem guarda. O `builder:watch` cobre o caminho `<srcDir>/rform/defaults` (sem extensão, pra pegar `.ts` e `.js`), pra criar o arquivo depois regenerar o template.

**Isso já morou no `app.config.ts`** (`rform.components.*`, via augment de `nuxt/schema`). Não mora mais — o augment e o template `types/app-config.d.ts` foram removidos, e nada em `src/` importa `#app`.

O nome `defineFieldDefaults` está hardcoded em dois lugares fora do código: o selector de callee do `better-tailwindcss` em `oxlint.config.ts` e o `tailwindCSS.experimental.classRegex` em `.vscode/settings.json`. Renomear o helper sem mexer nos dois faz lint de classe e IntelliSense **pararem calados** dentro do `defaults.ts`. O `path` do matcher é `(^|\.)ui(\.|$)` — ancorado por segmento, então pega `ui.container`, `Text.ui.label.required` e `Utils.Placeholder.ui.default`, e deixa `Text.default` (que não é classe) de fora.

### Tema: cores e radius (`src/runtime/style.css`)

Nenhum `ui` do módulo usa token semântico do Tailwind. Toda cor e todo radius passam por variável própria, em forma de arbitrary property:

```ts
container: "rounded-(--rf-radius-xl) bg-(--rf-color-background-100) has-[:focus]:outline-(--rf-color-primary)"
```

São 17 variáveis, declaradas em `src/runtime/style.css`: `--rf-color-{background,background-100,background-200,background-300,contrast,border,primary,primary-fg,danger,danger-fg,success,warn}` e `--rf-radius-{sm,md,lg,xl,2xl}`. Trocar tema é trocar variável — `ui` não se mexe.

Hoje o único declarado sem nenhum `ui` embutido lendo é o `--rf-radius-2xl`: a escala é oferecida inteira ao app. Por isso ele está na lista `orphans` de `test/unit/theme.test.ts` — que também asserta o contrário, então no dia que um `ui` passar a usá-lo o teste manda tirar dali. O `--rf-color-background-200` **saiu** dessa lista ao virar o trilho da barra de progresso do `RUtilsFileItem`, e o `2xl` entrou no lugar quando o overlay do `RFile` passou a casar o raio da própria dropzone em vez de arredondar mais que ela.

**Isso já foi token do playground.** Os `ui` usavam `bg-background-100`, `text-contrast/50`, `outline-primary`, que só existem no `@theme` de `playgrounds/i18n/app/assets/css/main.css`. Instalado em qualquer outro app, todo campo renderizava transparente. A lint não pegava porque `oxlint.config.ts` aponta o `entryPoint` do `better-tailwindcss` para o CSS **do playground**.

#### A linha que o app escreve

```css
@import "tailwindcss";
@import "#rform/tailwindcss";
```

Uma linha só, e ela traz as duas coisas: o `@source` dos componentes (o Tailwind não varre `node_modules`, então sem ele nenhuma classe do módulo é emitida) e um `@import` dos tokens.

**A ordem das duas linhas afeta menos do que parece, mas afeta.** Ordem de layer é ordem de primeira aparição, então `#rform` antes deixa `rform` como a layer mais fraca, e depois como a mais forte. Só que isso só decide quem ganha quando **as duas** declaram a mesma variável. Medido no browser, com override de `--rf-color-primary`:

| forma do override no app | `#rform` antes | `#rform` depois |
|---|---|---|
| `@theme { --rf-color-primary }` | pega | **ignora** |
| `@layer base { :root { --rf-color-primary } }` | pega | **ignora** |
| `@layer rform { :root { --rf-color-primary } }` | pega | pega |
| `:root { --rf-color-primary }` (fora de layer) | pega | pega |
| `@theme { --color-primary }` (encadeia) | pega | pega |

As três de baixo são imunes à ordem, cada uma por um motivo diferente: mesma layer resolve por ordem de declaração (e o app vem depois); declaração fora de layer ganha de toda layer de autor; e `--color-primary` o módulo **nunca** declara, então não há conflito para resolver — é só o `var(--color-primary, …)` do default encontrando um valor.

Ou seja: as duas formas naturais de fato usadas — encadear pelo tema do app, ou declarar `--rf-*` dentro de `@layer rform` — funcionam nas duas ordens. Quem quebra é declarar `--rf-*` **fora** da `@layer rform`, e aí quebra calado. `#rform` antes faz as cinco funcionarem, e por isso é a recomendação; os playgrounds usam depois, com o override em `@layer rform` (`playgrounds/ui/app/assets/css/main.css`).

É **template** gerado pelo `module.ts`, não um `.css` do `dist`, e o `@source` sai com caminho **absoluto**. Um `@source` relativo dentro de um arquivo publicado só funcionaria com o pacote instalado em `node_modules` — e os playgrounds carregam o módulo por caminho relativo (`"../../src/module"`), sem `rform` nas dependências e sem `node_modules/rform`. Com o template, a mesma linha vale para pacote instalado, link de workspace e caminho relativo.

Tem de ser `@import` do entry do app, nunca `nuxt.options.css`: num arquivo que o Tailwind não trata como parte de um entry, `@source` é ignorado e a at-rule **vaza crua** para o browser. Já foi `nuxt.options.css.unshift(style.css)` + um segundo arquivo só com o `@source`; virou um arquivo só a pedido.

Três nomes que não resolvem, todos testados: `#rform` puro (o alias aponta para um diretório e o resolver de CSS do Vite não pega `index.css` dele), `#rform/tailwindcss` pela regra geral `#rform/*` (sem extensão o Vite não acha o arquivo) e qualquer `@source` relativo. O nome sem extensão funciona por um **alias exato** `#rform/tailwindcss` → `<buildDir>/rform/tailwind.css`, registrado **antes** de `#rform/*`, que senão engole o caminho.

Consequência de ter saído do `nuxt.options.css`: um app **sem Tailwind** não recebe mais token nenhum — nada mais os injeta. Para esse caso o `package.json` exporta `nuxt-rform/style.css`, que dá para pôr no `css:` na mão.

#### Invariantes do `style.css`

- **`@layer rform`, e a declaração `@layer rform;` antes de qualquer bloco.** Declaração de autor fora de layer ganha de *toda* layer de autor, antes de especificidade entrar na conta — um `:root` solto aqui inverteria o override inteiro, calado, e nas duas ordens de import. A layer nomeada também é o que dá ao app o alvo imune à ordem da tabela acima.
- **Tokens e resets, todos ancorados em `.RField`.** Os quatro resets que nenhum `ui` expressa (spinner do `number`, o truque `transition: … 600000s` do autofill, `[data-autocompleted]`, o hide do placeholder sob `:-webkit-autofill`) moram aqui, no fim do arquivo. **Já moraram no `<style>` do `Form.vue`, ancorados em `.RForm`** — e ali perdiam todo campo usado sem `RForm` em volta, calado, porque nem a classe existia no DOM nem o `<style>` do SFC chegava a ser injetado. Um `<style>` de SFC também não passa pelo `postcss-nested` (o default do Nuxt tem só `autoprefixer` e `cssnano`), então tinha de ser escrito achatado; aqui o mkdist achata.
- **Nenhuma at-rule do Tailwind.** Agora que o arquivo é `@import`ado do entry, `@theme` e `@apply` ali **seriam** processados — e é o que não se quer: um `@theme` do módulo despejaria variáveis e utilitários no namespace do design system do app (`--color-foo` viraria `bg-foo` lá). Só `@layer`/`@media`/`@supports`.

Os defaults **encadeiam** no tema do app (`--rf-color-primary: var(--color-primary, #005BDF)`), então um app que já tem `primary` no `@theme` adota sozinho — é por isso que o playground não precisou de uma linha de override. Os degraus `-100`/`-200`/`-300` (10%/15%/20%) são derivados com `color-mix` em vez de encadeados: `--color-background-100` de outro app pode significar "tom mais claro" em vez de "10% na direção do contraste". Os três batem, medidos no browser, com o degrau de mesmo nome do playground — nos dois esquemas.

**A borda de repouso é `--rf-color-border`**, encadeada em `--color-border` e com fallback **translúcido** (`color-mix(in oklab, var(--rf-color-contrast) 10%, transparent)`), não um degrau opaco. A mesma borda pousa sobre `background` (grupo do `RArray`/`RObject`) e sobre `-100` (popover do `RSelect`, dropzone do `RFile`, `RUtilsFileItem`, `RUtilsCalendar`); um tom igual ao `-100` sumiria contra a própria superfície nesses quatro, e o mix com `transparent` é byte a byte o `contrast/10` que cada componente reescrevia antes. **Isso já foi treze bordas soltas** — `border-(--rf-color-contrast)/10`, três a `/20`, `border-current/10` nos dois containers e um `border-(--rf-color-background-100)` no `RSwitch` — sem um endereço que o app pudesse trocar de uma vez. Só a de repouso: `hover:border-(--rf-color-primary)`, `hasFile` e `dragging` são estado e continuam em `primary`/`success`. O `BANNED` de `test/unit/theme.test.ts` proíbe `border`/`divide` sobre `contrast`, `background*` e `current`, para a borda não voltar a ser reescrita num componente novo.

Fica literal de propósito: `*-current/*` (já é `currentColor`), `bg-transparent`, `outline-transparent`, `rounded-{full,none,l-none,r-none}` (estruturais), o `bg-[linear-gradient(…#f00…)]` do matiz em `fields/Color.vue`, e o `border-white` dos marcadores do color picker — branco **por desenho**, para contrastar com uma cor arbitrária. Note a assimetria: `text-white` é drift (virou `-fg`), `border-white` não é.

**`test/unit/theme.test.ts` é a guarda, e cobre o modo de falha novo.** `bg-(--rf-color-primry)` (typo) compila, passa na lint e renderiza `var(--undefined)` → transparente, calado em todo ambiente inclusive nos testes — pior que o `bg-primry` de antes, que ao menos não emitia regra. Os cinco casos: (a) nenhum token semântico cru voltou, (b) o conjunto de `--rf-*` usado nos componentes é **igual** ao declarado, nos dois sentidos, (c) o template tem exatamente um `@source` absoluto apontando para um diretório que de fato contém `fields/`, `utils/` e `Form.vue`, mais o `@import` dos tokens, (d) todo token mora dentro de `@layer rform`, (e) o `style.css` não tem at-rule do Tailwind. O (a) tokeniza o arquivo inteiro por whitespace e tira a pontuação das pontas — sem isso a última classe de cada literal chega como `text-white",` e escapa de todo padrão ancorado em `$`.

`src/runtime/style.css` mora em `src/runtime/` porque o `@nuxt/module-builder` só constrói `src/module` e `src/runtime/` — um `.css` na raiz de `src/` nunca chega ao `dist`. O mkdist passa cssnano nele, então o arquivo publicado sai minificado (`@layer` sobrevive).

### Os ícones vivem num namespace (`icon()` + `prefixIcons`)

Os 16 aliases que o módulo registra no `@nuxt/icon` são **prefixados**, e as duas
metades do prefixo não se conhecem:

| lado | quem escreve | o que sai |
|---|---|---|
| build | `prefixIcons` (`module.ts`), sobre o `moduleDependencies` | `"rform:plus": "fa6-solid:plus"` |
| runtime | `icon()` (`utils/icon.ts`), exportado por `#rform/utils` | `icon("plus")` → `"rform:plus"` |

**Isso já foi um espaço global.** Os aliases eram os nomes curtos (`plus`,
`calendar`, `loading`…) e o template escrevia `<Icon name="plus" />`. Custava duas
coisas, as duas caladas: instalar o rform passava a definir 16 aliases **no app**,
então um `<Icon name="plus" />` em qualquer página dele resolvia para o
`fa6-solid:plus` que o módulo escolheu; e um app que já tivesse um alias `calendar`
próprio **vencia** o merge — o `RDate` passava a renderizar o ícone do app, sem
ninguém pedir. Na direção contrária, quem quisesse trocar só o calendário do rform
não tinha como sem trocar o `calendar` do próprio app.

#### Trocar um ícone é sobrescrever o alias

```ts
// nuxt.config.ts
export default defineNuxtConfig({
    modules: ["nuxt-rform"],
    icon: {
        aliases: { "rform:calendar": "lucide:calendar" }
    }
});
```

**Um alias sozinho não derruba os outros 15**, e é o `defu` que garante: os
`defaults` de um `moduleDependencies` chegam ao app por
`nuxt.options[configKey] = defu(...overrides, nuxt.options[configKey], ...defaults)`
(no `installModules` do `@nuxt/kit`), que mescla **fundo**, chave a chave. O valor
do app ganha só na chave que ele escreveu.

Não há prop de ícone a inventar por causa disso: o endereço de um ícone é o alias,
como o endereço de uma cor é a variável `--rf-*`. Dois campos abrem uma segunda
porta, e as duas são **por instância**, não globais — o `icon` do `RSwitch`
(`{ true, false, loading }`, nomes crus do iconify) e o `ui.icon.name` do
`RUtilsError`, que é `ui` como qualquer outro.

#### O `icon()` é o que dá o conjunto a um campo do usuário

Ele mora em `#rform/utils` justamente para um `.vue` de `app/rform/fields` chamar
`icon("alert")` e receber o mesmo ícone que o `RUtilsError` usa — **acompanhando o
override que o app tenha feito**, o que escrever `"fa6-regular:file-lines"` na mão
não faz. Mesma ideia do `tr` e do `vMask`: o campo do usuário é de primeira classe,
então alcança o que o embutido alcança.

O prefixo fica **escrito duas vezes**, e não há como não ficar: `utils/icon.ts` é
runtime e não pode importar o `const name` do `module.ts`, porque só
`src/runtime/` chega ao `dist` (ver "Só `src/runtime/` chega ao `dist`"). Quem liga
os dois é o teste.

#### As duas formas de errar são caladas

`useResolvedName` do `@nuxt/icon` faz `options.aliases?.[bare] || bare` e **só
depois** procura o `:` para partir em coleção. Então:

- **nome fora do registro** — `icon("plux")`, ou o alias removido — cai no ramo do
  `:` como coleção `rform`, vira uma consulta de `plux` numa coleção que não existe,
  e renderiza **nada**, com um `[Icon] failed to load icon` no console;
- **nome cru que sobrou** — um `name="loading"` que não passou pelo `icon()` — não
  tem `:` nenhum, não casa com coleção nenhuma, e renderiza nada do mesmo jeito.

O segundo é o que de fato aconteceu ao prefixar: `RUtilsLoading`, `RUtilsError`,
`RUtilsFileItem` e o botão de remover do `RArray` ficaram com o nome curto e
**perderam o ícone** — quatro pontos, dois deles (o spinner e o ícone de erro) em
todo campo do módulo. Nenhum teste viu, e a lint não tem como ver.

**`test/unit/icons.test.ts` é a guarda**, três casos: (a) o conjunto de nomes que
os componentes pedem ao `icon()` é **igual** ao declarado no `prefixIcons`, nos dois
sentidos — com uma lista de `orphans` para o que é oferecido ao app sem o módulo
usar (hoje só `image`), e uma terceira asserção que manda tirar da lista o alias que
passar a ser usado; (b) nenhum `<Icon name="…">` estático sem `:` sobrou num
componente; (c) o prefixo do `icon()` e o `const name` do `module.ts` são a mesma
string.

### RArray: um render effect por linha

O `v-for` do `RArray` itera `length` e passa cada item por um componente de linha, em vez de `v-for="(item, index) in model"`. Aquela forma lia **todo** elemento no render *deste* componente, então uma tecla — uma escrita em `array[i]` — invalidava a lista inteira e repatchava todo irmão: 0,6 ms com 10 linhas e 4,1 ms com 100, crescendo com a lista onde um form plano ficava plano.

Iterar `length` e passar `item` por um getter **não basta sozinho**: o `v-bind` num `<slot>` normaliza o objeto e lê o getter do mesmo jeito. Só a fronteira de componente escopa a dependência de verdade.

### O campo `File`: dois modos, e a fila mora fora do model

`RFile` deixou de ser um arquivo só. A presença da prop `upload` é o que decide o que vai ao model:

| `upload` | o que o model guarda | quem envia |
|---|---|---|
| ausente | o `File` do browser | o submit do app |
| presente | o que a função devolveu, no mínimo `{ id, name, url }` (`Uploaded`) | o campo, no instante da escolha |

O transporte é do app — `UploadFn` recebe `(file, { signal, onProgress })` e devolve uma promise. Zero dependência de `fetch` e nenhuma convenção de envelope; o módulo é dono do **ciclo** (fila, progresso, cancelar, erro, retry), não do fio.

```
src/runtime/utils/formatBytes.ts             ← puro: bytes → { value, unit }
src/runtime/utils/acceptMatch.ts             ← puro: accept → { attr, list, matches(file) }
src/runtime/composables/useUploadQueue.ts    ← a fila: add/reject/retry/cancel/settled/stop
src/runtime/composables/pendingList.ts       ← o gancho do Form (acima)
src/runtime/components/utils/FileItem.vue    ← RUtilsFileItem: uma linha
src/runtime/components/fields/File.vue       ← dropzone, input, orquestração
```

**`formatBytes` devolve `{ value, unit }`, não a string.** A unidade é chave de `text.bytes.*` e quem traduz é o componente — a função fica pura e testável sem `tr`. A tupla `UNITS as const` é o que mantém o índice sendo chave de `text.bytes` e não `string`.

**Estado pendente mora fora do model.** Um arquivo em voo ainda não é um `Uploaded`, e não pode poluir o model com um marcador de status. A fila guarda `entries` locais (`uid`, `file`, `status`, `progress`, `message`), e o que a lista renderiza é *itens do model ++ entries em voo*. Ao resolver, a entry sai e o `Uploaded` entra; ao falhar, a entry fica em `status: "error"` com o botão de retry. `status: "rejected"` é o arquivo que nem chegou a subir (`accept`, `maxSize`, `maxFiles`) — e a mensagem dele aparece **na linha**, não no `error` do campo, que é do `errorsBag` e tem um escritor só.

Isso mata de saída a race da referência, em que um POST em voo regrava o model depois de o usuário ter removido o arquivo: cancelar aborta o `signal` **e** descarta a entry, e a resolução só escreve no model se a entry ainda existir.

**Cancelar também solta a promise.** O `pending` da fila é um `Map` por uid, não um `Set`, justamente para `cancel`/`stop` poderem removê-la: o resultado já foi descartado, e esperar por ela no `settled()` prenderia o submit para sempre se o `upload` do app ignorasse o `signal`. Já o `while (pending.size)` do `settled()` cobre o inverso — um retry começado *durante* a espera.

**`multiple` e o `default`.** `defaults.default` é estático (`null`), então a normalização para array vai no `opts.get` do `useField` — o seam que já existe — usando `_props.multiple`, a prop crua, antes do merger. O model pristino continua `null`; toda escrita posterior é uma lista.

**`FileItem` é um util de verdade**, não um `defineComponent` inline como o `Row` do `Array.vue`. É a linha que um app mais quer restilizar, e como util ela ganha `ui.Utils.FileItem`, a classe-gancho `RUtil RUtilsFileItem` e o `::ui-tree{component="File"}` de graça. Ela lê `props.text.*` **herdado do campo** — `useUtil` já mescla as props do pai —, então todo o texto continua morando em `rform.fields.file.*` e não se parte em duas subárvores. O `Props` dela declara as folhas que lê, sem importar o `defaults` do `File.vue`: importar fecharia um acoplamento entre util e campo que não existe hoje.

**O objectURL é do `FileItem`, não da fila.** Um `File` cru no model (modo sem `upload`) não tem entry nenhuma, então a fila não teria onde revogar o dele — dois donos seriam duas formas de vazar. O util cria no watcher e revoga no `onUnmounted`, e o watcher observa `entry.file`/`entry.url`/`entry.type` e **não** o `entry`: o objeto da linha é remontado a cada tique de progresso, e revogar ali piscaria a miniatura. `createObjectURL` vai em try/catch — no happy-dom sobre o `URL` do Node ele recusa o `File`, e uma exceção ali derruba o util inteiro em vez de só ficar sem miniatura.

**A miniatura tem dois caminhos, e o segundo precisa do `type`.** O `Uploaded` de uma API é `{ id, name, url }` e a `url` é `/api/uploads/7` — sem extensão para o regex de imagem enxergar. Então, no instante em que a entry sai da fila e o item entra no model, a miniatura sumia: o `File` já não estava em lugar nenhum.

Quem a segura é um `WeakMap<Uploaded, File>` no campo, escrito no `onDone` (que por isso recebe o `File` junto do valor) e lido no `rows`. **Fraco de propósito**: a chave é o próprio objeto do model, então a entrada morre com o item e não há nada a limpar no `discard` — e um `Map` forte guardaria o binário de todo arquivo já enviado na sessão.

O outro caminho é o do arquivo que **já veio do servidor**, em que não há `File` nenhum: aí a decisão é o `type`, opcional no `Uploaded`, e o regex de extensão fica de reserva para quem não o manda. `size` é opcional pelo mesmo motivo e com a mesma direção — e vem **na frente** do `File` local na hora de escrever a linha (`file?.size ?? uploaded?.size ?? local?.size`), porque quem declarou o tamanho é a API, que é a dona do que está no model.

**`upload` e `remove` aceitam `false`, e é a única forma de recusar o padrão do app.** Os dois são props como quaisquer outras, então `defineFieldDefaults({ File: { upload, remove } })` padroniza o transporte para o app inteiro — e aí um campo precisa de como sair. `:upload="undefined"` não serve: o `merger` pula quando o resultado é truthy e o valor novo é falsy (a regra "não apaga"), e `undefined` nem chega a ser considerado. É a mesma parede que o `focusError` do `RForm` encontra, e a saída aqui é a mesma — ler a prop **crua**:

```ts
const upload = computed(() => fnProp<UploadFn>(_props.upload, props.value.upload));
```

O `fnProp` também exige `typeof === "function"` no valor mesclado, que é o que cobre o `<RFile upload>` sem valor: com `Boolean` na lista de tipos que o SFC compila, a forma curta vira `true`, e chamar `true(file)` seria o erro. E os dois entram no `withDefaults` como `undefined`, junto de `required`, `loading` e `disabled`, senão o boolean casting transformaria a prop **ausente** em `false` — que este campo lê como "recuso o default", e o padrão do app nunca funcionaria.

**`disabled` vem do `Element`, e o `RFile` faz mais com ele.** Todo campo tem a prop e todo campo a honra — `pointer-events-none opacity-60` no container e o `disabled` do controle nativo. Aqui ele desliga em três lugares: o `disabled` do input nativo, um `pointer-events-none` na dropzone (que apaga o hover e o drag de uma vez, coisa que nenhuma utility consegue desfazer sozinha) e o `:disabled` dos três botões da linha, que o `FileItem` herda pelo merge de props do `useUtil` sem o campo precisar passar. O `intake`, o `retry` e o `discard` repetem a guarda em JS porque o slot `#item` expõe as três funções — e um slot não passa pelo `pointer-events-none`.

**Isso já foi prop só do `RFile`**, quando nenhum outro campo a honrava: pôr no `Element` daria a prop a todos os quinze no nível do tipo sem nenhum honrá-la no template, que é quebra calada. Hoje os quinze honram, e o que sobrou de exclusivo aqui é o `ui.group.disabled`.

**A lista saiu de dentro do `<label>`.** Era o `<label>` da dropzone que embrulhava tudo, e por isso cada botão precisava de `pointer-events-auto` para não abrir o seletor de arquivos ao ser clicado. Fora dele, nada disso é preciso.

#### O que estava quebrado, e não aparecia

Não havia **nenhum** teste montando o `RFile`, e a lista é a prova do que isso custa:

- **`multiple` não ligava na forma curta.** `multiple?: Multiple` sem o `& boolean` compila `multiple: {}` em vez de `{ type: Boolean }`, então `<RFile multiple>` chegava como `""` — falsy. Só `:multiple="true"` funcionava, e a própria demo do site usava a forma curta. É o mesmo remendo que o `Select.vue` já tinha.
- **`props.loading` era ignorado** — o overlay só reagia ao `ref` local.
- **O filtro de `accept` só olhava extensão pelo nome**, então o `accept="image/*"` do próprio JSDoc do componente nunca casava; e o valor ia cru para o atributo nativo, onde `"png, jpg"` não é aceito pelo diálogo do SO. Hoje é `acceptMatch`, que devolve o `attr` normalizado (`.png,.jpg`) junto do `matches`.
- **`acceptSplit` era calculado uma vez fora de `computed`** — `accept` vindo de schema dinâmico não atualizava nada.
- **Os listeners de drag eram de `window`**, então dois `RFile` na mesma página pulsavam juntos. Hoje é um contador de `dragenter`/`dragleave` (que disparam em filhos) escopado ao elemento.
- **`<Icon name="close" />` nunca existiu** na lista de aliases do `module.ts`. Os cinco novos são `file`, `image`, `upload`, `retry` e `cancel`; remover continua sendo o `remove` que o `RArray` já usa.
- **`useIsURL(model.value as unknown as string)`** rodava um regex sobre um `File` ou sobre um array coagido a string. Funcionava por acidente.

### Presets (rules e masks)

Um arquivo = um preset. O nome vem do caminho relativo em camelCase (`br/insc-est.ts` → `brInscEst`).

- **Embutidos:** `src/runtime/presets/{rules,masks}/**/*.ts`. Tudo que é do Brasil mora em `br/`, dos dois lados: rules `brCpf`, `brCnpj`, `brCep`, `brTelefone`; masks `brCpf`, `brCnpj`, `brCep`, `brTelefone`, `brCelular`, `brCpfCnpj`, `brPlaca`, `brData`. Genéricos ficam na raiz: `required`, `min`, `max`, `email`, `url` — hoje não há mask genérica.
- **Do usuário:** `app/rform/presets/{rules,masks}/**/*.ts` (recursivo). Mesmo nome sobrescreve o embutido.
- Cada arquivo faz `export default defineRule({ available?, validation })` ou `defineMask({...})`, **importados explicitamente de `#rform/utils`** — os helpers não estão no auto-import. O `const` type parameter em `defineRule` é o que preserva `available: ["text"]` como tupla literal — sem ele o filtro por componente para de funcionar.
- `available` é `readonly FieldType[]`, então `["txt"]` falha na definição com "Did you mean `"text"`?" em vez de nunca casar com componente nenhum.

`src/module.ts` escaneia as duas raízes e gera:

- `#rform/presets.ts` — imports estáticos + objetos `rules`/`masks`;
- `#rform/types/presets.d.ts` — `typeof import(...)` por arquivo. **O build nunca executa os arquivos**, o TS resolve.
- `#rform/types/fields.d.ts` — só o union `FieldType` (`"text" | "select" | ...`), um membro por componente fora `Form`/`Dynamic`.

`fields.d.ts` é gerado **sem nenhum import de propósito**. Tirar `FieldType` de `FieldConfig["type"]` fecharia um ciclo: `definePreset` → `schema.d.ts` → `components.d.ts` → `Element` → `Rule` de `presets.d.ts` → `typeof import(<preset>)` → `defineRule` → `definePreset`. `schema.d.ts` só reexporta o union.

Dois caminhos que colapsam no mesmo nome (`br/cpf.ts` + `brCpf.ts`) fazem os dois templates falharem, com `ERROR [rform] duplicate preset name` nomeando os dois arquivos. O Nuxt rebaixa falha de template a warning, então o `prepare` ainda sai com 0 — o sintoma é `#rform/presets` sumir, não o build parar.

Resolução em runtime é ponto único: `resolveRule` / `resolveMask` (`src/runtime/utils/`), chamados por `useField`. `rule` aceita nome, `{ name, ...args }`, função, `ZodType` ou array; `mask` procura o preset primeiro e cai pra pattern maska cru. O `form` das validations vem de `defineFormRoot` (`composables/formRoot.ts`), provido **só** pelo Form — Array/Object não sobrescrevem, então campo aninhado enxerga o form inteiro.

#### Um objeto só: `{ value, form, ...args }`

Toda validação — `validation` de preset **e** função inline no `rule` — recebe um único objeto. Quem tipa é `RuleContext` (`utils/definePreset.ts`, exportado por `#rform/utils`): `value` e `form` já vêm, o parâmetro é só o que o preset **acrescenta**. O tradutor **não** está aí — uma rule chega ao locale ativo pelo `trRule` importado, e o contexto continua sendo só o que o campo de fato tem.

```ts
import { defineRule, type RuleContext } from "#rform/utils";

defineRule({ validation: ({ value, form, uf }: RuleContext<{ uf: string }>) => … });
```

`RuleContext` também **estreita**: `RuleContext<{ value: string, uf: string }>` tipa `value` como string, porque `unknown & string` é `string`. Sem parâmetro (`RuleContext`) o preset não tem args e é referenciado só pelo nome.

Os args são **nomeados no próprio ref**, não posicionais: `{ name: "min", min: 3 }`, `{ name: "brInscEst", uf: "SP" }`. O tipo sai de `Omit<P, keyof BaseContext>` sobre o parâmetro da `validation` (em `types/presets.d.ts`), então:

- preset sem args → aceita `"min"` e `{ name: "min" }`;
- preset com arg obrigatório → **só** `{ name, ...args }`, e faltar/errar o tipo do arg é erro de compilação;
- `args: [3]` (a forma antiga) agora falha com `'args' does not exist`.

`fromPreset` monta o contexto como `{ ...args, value, form }` — nessa ordem de propósito, para um arg chamado `value` ou `form` não conseguir sombrear o que o campo realmente tem.

#### As rules embutidas são zod

Cada uma é uma **fábrica sem parâmetro** — `const schema = () => z.custom(…, trRule("required"))` — e passa por `check(schema(), value)` (`presets/helpers.ts`), que devolve `issues[0].message`. É isso que torna a mensagem do preset a mensagem do campo. Fábrica, e não constante de escopo de módulo, porque `trRule` é resolvido **na construção do schema**: a mensagem tem de ser a do locale ativo, e o locale muda sem a página recarregar. Consequência de empacotamento: `#rform/presets.ts` importa **todos** os presets estaticamente, e todo campo importa `#rform/presets` — então **zod deixou de ser peer dependency opcional**, é obrigatória.

As format rules (`email`, `url`, `br/*`) saem cedo em `isBlank(value)` para `required` continuar dono sozinho da vacuidade. `min`/`max` escolhem o schema pelo **valor** (`z.number()` / `z.array()` / `z.string()`), não pelo tipo do campo.

Preset em `useRForm(schema)` passa intacto por `normalizeSchema` (quem resolve é o campo) e vira `z.any().superRefine(async ...)` no `rules` agregado — **schema com preset exige `safeParseAsync`**; schema só-Zod continua síncrono.

### i18n: `tr`, uma função e dois motores (`src/runtime/translate`, `utils/tr.ts`, `src/runtime/locales`)

Nenhum texto e nenhum formato de data cravado, e **uma** função de tradução só: `tr`. Ela é o que campo, util e rule chamam, e aceita quatro formas de entrada:

```ts
tr("form.nome")                              // chave do app
tr({ key: "form.max", params: { n: 30 } })   // chave do app, com params
tr("rform.formats.date")                     // chave do módulo, caminho por extenso
tr("~~Nome")                                 // literal explícito
```

As camadas:

- **Packs** — `src/runtime/locales/<code>.ts`, objeto aninhado com `export default`. `pt-BR` é o de referência (é o `typeof` dele que vira `Messages`) e `en.ts` é tipado *contra* ele, então uma chave nova sem tradução é erro de compilação. Sintaxe do vue-i18n: interpolação `{param}` **e** plural `a | b`, que agora rendem o mesmo nos dois motores.
- **`tr`** — `useTranslate()` (composable) devolve `{ tr, locale }` delegando a `#rform/translate`; `useField` e `useUtil` o chamam, então **todo** campo e util — inclusive os de `app/rform/{fields,utils}` — ganham `tr` sem escrever import, do mesmo jeito que já ganham `mask`. Fora de componente, `tr` e `trRule` saem de `#rform/utils`.
- **Datas** — `dateFormat(pattern)` (`utils/dateFormat.ts`, puro) deriva de `formats.date` a máscara maska, o regex de parse e a formatação de exibição, que antes eram três literais `dd/mm/yyyy` em dois arquivos. Quem lê o pattern é `tr("rform.formats.date")`.

`app/rform/locales/<code>.ts` é o pack do usuário, escaneado como os presets. **Mesmo code mescla** (via `merger`), não substitui — diferente de campo, util e preset, onde mesmo nome troca o arquivo inteiro. É o que permite um pack de três chaves continuar completo. Um code novo (`es`) simplesmente entra, e o que faltar cai no `fallbackLocale`, que é o pack default.

#### As duas rotas

O algoritmo mora **acima** do motor. `normalize` (em `utils/i18n.ts`) reduz qualquer das quatro formas a `(key, params)` — e mora ali, não ao lado do `tr`, porque os dois motores o importam e `utils/tr.ts` importa os motores: a outra direção fecharia ciclo. Daí em diante:

```
COM PONTE (translate/bridge.ts)
  1. key começa com "~~"  →  key.slice(2).trimStart()
  2. resto                →  $i18n.t(key, params, plural?)
       (o store do app já tem os packs do módulo sob `rform`, registrados pelo
        i18n:registerModule — "rform.fields.array.add" resolve sem tratamento especial)

SEM PONTE (translate/standalone.ts)
  1. key NÃO começa com "rform."  →  key, intacta
  2. resto                        →  translate(ctx, key.slice(6), params, plural?)
```

Com ponte, `tr("Nome")` — literal sem `~~`, que a tipagem já proíbe — cai no passo 2 e o vue-i18n loga *missing key* no dev. Barulhento de propósito. Sem ponte, uma chave do módulo que o pack não tem volta como a **chave inteira** (`rform.foo.bar`), e não como o caminho pelado que o intlify devolve — uma mensagem faltando continua legível como uma.

`tr` lê `locale.value` **a cada chamada**, então uma chamada dentro de template rastreia o ref e trocar de idioma re-renderiza. É o que faz `RDate` reformatar: o `watch` dele tem `[model, pattern]` como fonte, não só `model` — trocar de idioma não mexe no model (que é ISO), mas muda como ele se escreve.

O `standalone` mantém **um** `CoreContext` para o processo (compilar mensagem é a parte cara e o intlify cacheia por contexto) e troca `context.locale` a cada chamada. O contexto é casteado para `CoreContext<string>`: com o tipo literal dos packs, as sobrecargas de `translate` andam recursivamente por ele (`PickupPaths`/`PickupKeys`) e o TS desiste com *"Type instantiation is excessively deep and possibly infinite"* — e a completação de chave que elas dão não serve a este call site, que monta o caminho na mão.

#### O corte do bundle é estrutural

**Detecção:** `hasNuxtModule("@nuxtjs/i18n", nuxt)`, no topo do `setup`. Ele lê a lista **declarada** de módulos, então não depende de o rform ser registrado antes ou depois do i18n no `modules:` — ao contrário do hook, que só resolve tarde.

**Forma:** dois arquivos reais, não um template que gera código em string, para que os dois corpos passem por oxlint e `vue-tsc` como qualquer fonte. O `module.ts` registra um **alias exato** `#rform/translate` → um dos dois, **antes** de `#rform/*` — o Vite casa aliases na ordem de inserção, e o prefixo mais curto engoliria o mais longo. Mesma precedência que `#rform/tailwindcss` e `#rform/builtin` já usam.

**A exclusão é estrutural, não uma otimização de bundler que pode falhar: o corpo da ponte não escreve o import.** `test/unit/translateBridge.test.ts` lê o fonte de `bridge.ts` e asserta que a string `@intlify` não aparece — e a prova final do build é `grep -c "@intlify" dist/runtime/translate/bridge.mjs` dar `0`.

Custo medido (ESM cru, `@intlify/core` 11.4.10):

| pacote | tamanho |
|---|---|
| `@intlify/core-base` | 66.239 B |
| `@intlify/message-compiler` | 57.230 B |
| `@intlify/shared` | 13.820 B |
| **total** | **~137 kB** |

No app **sem** i18n. Zero no app com.

**Alavanca futura, fora de escopo:** a flag `__INTLIFY_DROP_MESSAGE_COMPILER__` corta os 57 kB do compilador em troca de packs pré-compilados. `#rform/locales` já é template gerado, então é viável — mas não hoje.

`@intlify/core` está em `dependencies`, não como peer opcional: o caminho sem i18n é o **comum**, e um peer opcional faria o caso padrão exigir instalação manual. (É também o que evita "Potential implicit dependencies" no `prepack`.)

#### A assimetria do `~~`

`~~` é removido **só** com ponte. Sem ela, `tr` é a identidade para tudo que não começa com `rform.` — e `~~Nome` inclui o `~~` na string devolvida, então **um componente escrito com `~~Nome` imprime `~~Nome` num app sem i18n**. Custo aceito, não bug: sem ponte não há nada contra o que resolver uma chave do app, então não há como distinguir "literal" de "chave" sem inventar uma segunda regra que só existiria para esse caso. A rigidez do `~~` só faz sentido onde ela compra alguma coisa — no app com i18n, onde a tipagem transforma todo literal solto em erro de compilação.

#### `defaults.text` é o marcador

O `defaults` de um componente guarda coisas de naturezas diferentes, e só uma é texto:

```ts
export const defaults = defineDefaults({
    ui: { … },                          // classes
    default: [],                        // valor inicial do model
    text: {
        button: "add",                  // ← chave de tradução DO MÓDULO
        bytes: { kb: "kb" }              // ← grupo: a própria chave entra no caminho
    },
    pick: { value: "id" }                // nome de propriedade — NÃO é texto
});
```

`Base` reserva `ui`, `default`, `text` e as duas que moram fora dele por contrato — `label` e `placeholder`, adiante. `text` é `TextSource` (`src/runtime/type.d.ts`): um objeto aninhado, `{ [key]: string | TextSource }`, e continua aninhado o caminho inteiro — nada é achatado para o topo. Um template lê `tr(props.text?.button)`, nunca uma prop de nível superior tipo `buttonText`. Sem esse marcador a regra "prefixa toda string do `defaults`" transformaria `Select.pick.value: "id"` em `"rform.fields.select.id"`, e o Select passaria a procurar `option["rform.fields.select.id"]` — quebra calada em dois lugares hoje (`Select.pick`, `Pin.type`) e armadilha permanente para campo de usuário. Note que o `label` **aninhado** dentro do `pick` também escapa: o `prefixText` só prefixa `text` e as duas chaves de topo `label`/`placeholder`, e `pick.label` não é chave de topo.

Quem prefixa é `prefixText` (`utils/prefixText.ts`, puro), chamado por `useField` (com `scope: "fields"`) e por `useUtil` (com `scope: "utils"`) sobre o `defaults` do componente, **antes** do `merger`:

```
defaults.text = { button: "add", bytes: { kb: "kb" } }
      ↓ prefixa com rform.<scope>.<componente>.
{ button: "rform.fields.array.add", bytes: { kb: "rform.fields.file.bytes.kb" } }
      ↓ merger(defaults, userDefaults, localProps, sourceProps) — recursivo, folha a folha
props.text.button / props.text.bytes.kb
```

**Um grupo carrega a própria chave para dentro do prefixo.** Sem isso o aninhamento seria forma para a prop e nada para a chave, e cada folha teria de reescrever o caminho inteiro na mão. É por isso que `text: { bytes: { kb: "kb" } }` no `File` sai como `rform.fields.file.bytes.kb`, e não `rform.fields.file.kb`.

O `scope` (`"fields"` ou `"utils"`) é o que dissolve a preocupação antiga de um campo e um util com o mesmo nome disputarem chave: `Calendar` é os dois hoje, e um vive em `rform.fields.calendar.*`, o outro em `rform.utils.calendar.*` — subárvores diferentes, sem teste nenhum precisando provar a ausência de colisão.

**Como o prefixo acontece antes do merge, e o merge é recursivo, quem sobrescreve substitui só o valor prefixado daquela folha** — a procedência sai de graça, sem rastrear nada:

```ts
<RArray :text="{ button: 'form.adicionar' }" />                    → "form.adicionar"         (cru)
defineFieldDefaults({ Array: { text: { button: "meu.add" } } })    → "meu.add"                (cru)
// nada passado                                                    → "rform.fields.array.add" (prefixado)
```

**`label` e `placeholder` são as duas exceções — sempre fora de `text`, no topo**, por contrato: um app os passa direto (`<RText label="Nome" />`), então não podem morar dentro de uma árvore que o app não escreve por inteiro. Continuam sendo `TrInput`, e `prefixText` prefixa os dois quando o valor veio dos defaults do próprio componente e não é uma string vazia — é o `placeholder: "placeholder"` do `File`, que sai como `rform.fields.file.placeholder`. A string vazia é deixada em paz: é o sentinela de "não renderiza nada", e `rform.fields.file.` sozinho nunca é uma chave a resolver por engano.

No `useUtil` o `prefixText` roda **uma vez, fora do `computed`**: ele copia, e o objeto `defaults` do componente é compartilhado por todas as instâncias.

**Isso já foi achatamento, e a colisão que ele arriscava já foi resolvida por guarda em vez de por forma.** `defaults.text` costumava virar props de nível superior — `text: { buttonText: "add" }` produzia `props.buttonText` — e `defineDefaults` recusava em tempo de tipo qualquer chave de `text` que colidisse com uma chave do topo (`NoTextCollision`), porque o achatamento a sobrescreveria calado. A armadilha real, e ela mordeu de verdade: `utils/Calendar.vue` chegou a declarar `timeLabel` em vez de `time`, porque `time` já era o booleano que decide se o relógio aparece, e uma chave achatada ali seria *truthy* para sempre — o painel de hora abriria e nunca mais fecharia. Com `text` aninhado, `props.text.time` e `props.time` são caminhos diferentes e não podem colidir; a chave voltou a ser `time`, e o guard `NoTextCollision` não existe mais — nada precisa recusar o que não pode acontecer. A lição que fica, mesmo sem o mecanismo que a forçava: não dar a uma chave de `text` o nome de uma prop que o componente testa por veracidade.

Cuidado com o nome, também: `src/runtime/presets/helpers.ts` exporta uma função `text()` (coerção para string, usada pelas rules de formato). Não colidem — helper de preset não entra no barrel `#rform/utils` — mas são coisas diferentes com o mesmo nome num repo onde as duas aparecem lado a lado.

#### O `Element` **não** deriva os props de texto — e não tem como, na forma ingênua

A forma óbvia seria `Element<OBJ> & { [K in keyof OBJ["text"]]?: TrInput }`, com `OBJ` vindo de `typeof defaults`. **Não é implementável.** Quem resolve `defineProps<Props>()` é o `@vue/compiler-sfc`, que anda o tipo na mão e não tem checker: indexar `OBJ["text"]` atrás de um `TSTypeQuery` e depois enumerar `keyof` disso para gerar props novas é pedir para resolver um mapped type sobre o índice de um genérico — e falha, derrubando a coleta de props do SFC inteiro (`@vue-ignore` "resolve" compilando, mas pior: os props type-checkam enquanto a declaração de runtime não existe, e um valor passado em `text` cai em `attrs` sem nunca chegar ao componente, calado).

A saída é `TextTree`/`TextProp` (`src/runtime/type.d.ts`), um **mapped type**, não condicional, ancorado num lugar fixo:

```ts
export type TextTree<T> = {
    [K in keyof T]?: T[K] extends string ? TrInput : TextTree<T[K]>
};

export type TextProp<T> = { text?: TextTree<T> };
```

O que o compiler-sfc aceita aqui e recusa na forma ingênua é que **a chave `text` sempre existe** — só o interior dela é mapeado sobre `T`. Um `TSConditionalType` que decide **se** a prop existe é o que ele não resolve (`"Unresolvable type: TSConditionalType"`); um mapped type que decide **o que tem dentro** de uma prop que já existe, ele resolve. Um campo escreve `TextProp<typeof defaults.text>` na interseção do próprio `Props` e para de restatar as chaves à mão: `TextProp<{ hint: string, teste: { a: string } }>` vira `{ text?: { hint?: TrInput, teste?: { a?: TrInput } } }`.

`Element` não tenta enxergar `text` de propósito — ele nem recebe `OBJ["text"]` como conceito, e não faz por onde. Cada campo intersecciona `TextProp<typeof defaults.text>` por conta própria, porque só o componente sabe a forma da própria árvore; um util, que já escreve `Props` à mão, faz o mesmo sem estranhar.

**Isso já foi resolvido diferente.** Antes de `TextTree` existir, cada campo escrevia os props de texto por extenso (`buttonText?: TrInput`) e listava as mesmas chaves em `defaults.text` — duas fontes de verdade para a mesma lista, uma delas silenciosamente esquecível. `timeLabel` no `Calendar` (acima) é do mesmo período: a chave existia tanto para nomear a mensagem quanto para não pisar na prop `time`.

#### `WithTextSource<P>`: o mesmo componente, visto do lado errado

`useUtil<Props>(defaults)` (a forma síncrona, com os próprios `defaults` do componente em mão) não pode receber `defaults` tipado como `Props`: em `Props`, `text` é `TextTree<...>` — folhas `TrInput` — mas o objeto que o componente de fato declara em `defaults.text` ainda não passou por `prefixText`, e suas folhas são só o **sufixo** cru (`"start"`, não um `TrInput` resolvido). Num app com `@nuxtjs/i18n`, `TrInput` estreita para `ModuleKey | Literal` — nenhum sufixo solto como `"start"` é `ModuleKey` nem começa com `~~` — então os dois tipos genuinamente divergem, e não é um detalhe de nomenclatura.

`WithTextSource<P>` (`src/runtime/type.d.ts`) existe para isso: `Omit<P, "text"> & { text?: TextSource }` — o mesmo `Props`, com `text` trocado de volta para a forma de autoria. `useUtil` aceita `WithTextSource<P>` e não `P` na sobrecarga síncrona precisamente porque `defaults` está do lado de cá do prefixo; quem chama `useUtil<Props>()` sem argumento (a forma assíncrona, que busca os defaults pelo registry) não precisa dele — ali quem já prefixou é o próprio `useUtil`, por dentro.

#### O plural é o **quarto** argumento

Medido contra `@intlify/core@11.4.10`, com `presets.rules.min.length` = `"Mínimo de {min} caractere. | Mínimo de {min} caracteres."`:

| chamada | resultado |
|---|---|
| `translate(ctx, path, { named: { min } })` | param chamado literalmente `named`; `{min}` sai **vazio** |
| `translate(ctx, path, { min: 5 })` | interpola, mas fica no ramo 0 → `"Mínimo de 5 caractere."` |
| `translate(ctx, path, { min: 5 }, 5)` | interpola **e** escolhe o ramo → `"Mínimo de 5 caracteres."` |

Ou seja: o terceiro argumento é o objeto de params **cru** (nada de wrapper `{ named }` / `{ plural }`), e a escolha do plural é o **quarto**. Sem ele o intlify renderiza o ramo 0 qualquer que seja a contagem, que é exatamente o bug que isto substitui (`"Mínimo de 1 caracteres."`).

Quem fecha essa lacuna é `pluralOf` (`utils/i18n.ts`), compartilhado pelos dois motores: **o primeiro valor numérico do objeto de params serve de escolha**. É o que permite a uma rule escrever `trRule({ key: "min.length", params: { min } })` sem repetir o número — a mensagem interpola e pluraliza pelo mesmo `min`. A ponte faz igual, com a sobrecarga `t(key, named, plural)` do vue-i18n, que é a mesma posição.

#### `trRule`: a rule importa o tradutor, não o recebe

Uma rule não é componente e não pode chamar composable — era por isso que `t` viajava no contexto. Um helper **importado** resolve o mesmo problema sem ocupar o canal:

```ts
import { trRule } from "#rform/utils";

trRule({ key: "min.number", params: { min } });
//  → tr({ key: "rform.presets.rules.min.number", params: { min } })
```

`#rform/utils` exporta os dois: `tr` (caminho completo, sem prefixo — para o `tr("rform.formats.date")` do `Date.vue` e para um preset de usuário que queira mensagem do **app**) e `trRule` (o açúcar que prefixa `rform.presets.rules.`).

Por tabela, nada disso existe: `resolveRule` não tem parâmetro de tradutor, `BaseContext` é `{ value, form }`, `fromPreset` não injeta nada além dos args, e `useField` não repassa tradutor nenhum para a validação. `RuleContext<T>` é `{ value, form } & T`.

**A rota sem build é o alias.** `resolveRule` não importa mais nada de tradução; quem precisa é a rule, e ela chega no motor por `#rform/translate` — que o `vitest.config.ts` aliasa para `runtime/translate/standalone.ts` no projeto `unit`. É a propriedade que o antigo `defaultT` carregava e que não pode se perder: `test/unit/presetsBuiltin.test.ts` continua chamando `preset.validation({ value })` **direto**, sem app, sem build e com a mensagem em pt-BR. `useRForm`, que agrega as rules num `z.any().superRefine`, é a mesma rota.

#### A forma do pack

```
rform.
  fields.                      ← components/fields, via prefixText(scope: "fields")
    array.add
    file.bytes.kb              ← grupo: a própria chave ("bytes") entra no caminho
    file.tooBig                ← com param: tr({ key, params: { max } }), montado no campo
    file.tooMany               ← plural pelo primeiro param numérico, via pluralOf
    date.hint
    date.hintTime
  utils.                       ← components/utils, via prefixText(scope: "utils")
    calendar.time
  presets.
    rules.min.number           ← preset, via trRule({ key: "min.number" })
    rules.required
  formats.
    date                        ← compartilhado; escrito por extenso: tr("rform.formats.date")
```

O topo tem exatamente as quatro raízes que o mecanismo de prefixo consegue produzir: `fields.*` e `utils.*` são o `scope` que `useField`/`useUtil` passam para `prefixText`; `presets.*` e `formats.*` são espaços compartilhados que nada prefixa, escritos por extenso nos call sites (`trRule`, `tr("rform.formats.date")`). Quem guarda essa forma é `test/unit/i18n.test.ts` — `keeps the top level to the four namespaces the prefix can produce` — que também asserta que os dois packs concordam em toda chave, para nenhum locale cair no fallback calado.

`fields.*`/`utils.*` é o que dissolve a antiga preocupação de um campo e um util de mesmo nome disputarem chave: `Calendar` é os dois hoje, e cada um tem a própria raiz — `rform.fields.calendar.*` contra `rform.utils.calendar.*`. Isso já foi um espaço plano só, com os dois lados no mesmo nível e um teste dedicado só para provar que não colidiam; a separação por `scope` torna a colisão impossível em vez de meramente ausente.

`presets.rules.*` pareia com o layout de `src/runtime/presets/{rules,masks}` e deixa espaço para `presets.masks.*` se um dia houver mensagem lá.

#### O mapa de chaves do app (`src/appMessages.ts`)

Com `@nuxtjs/i18n` instalado, o módulo lê o arquivo de mensagens do app e gera `#rform/types/tr.d.ts` — a união `TrInput` que faz de um literal solto numa prop de texto um **erro de compilação**.

**Onde a config é lida: dentro do `getContents` do template, não no `setup`.** O @nuxtjs/i18n resolve `langDir` durante o setup **dele** (`resolve(layer.i18nDir, layer.i18n.langDir ?? "locales")`, com `i18nDir = <rootDir>/<restructureDir ?? "i18n">`), e `getContents` só roda no `builder:generateApp` — o mesmo truque que o `localeFiles()` já usa.

**São duas leituras de config diferentes, e as duas precisam existir.** `declaredLocales()` existe para a ponte e precisa só dos *codes*, então também olha as opções inline do `modules:` — a ponte é registrada durante o setup, quando o i18n ainda pode não ter mesclado nada. `resolveAppMessages()` precisa de `langDir` + `file` já **resolvidos**, e por isso lê o `nuxt.options.i18n` mesclado, tarde. Fontes e momentos distintos.

A decisão de modo mora no `appMessages.ts` com o disco **injetado** (`read`, `warn`) — puro, porque é a decisão que precisa de cobertura e o `module.ts` não tem costura para testar:

| caso | chaves | o que sai |
|---|---|---|
| `.json` do `defaultLocale` | lidas e achatadas | `TrInput = Paramless \| ModuleKey \| WithParams \| Literal` |
| i18n sem nenhum `file` declarado | não há | `TrInput = ModuleKey \| Literal` — **o rigor fica** |
| `.ts`/`.js`, yaml, json5, loader de `lazy: true`, JSON que não parseia | não | `TrInput = string` + `console.warn` nomeando arquivo e motivo |
| sem `@nuxtjs/i18n` | — | `TrInput = string` |

**As duas degradações são diferentes de propósito.** "Nenhum arquivo declarado" não é falha: o app tem i18n, só não há chave do app a oferecer, e exigir chave ou `~~` continua valendo. "Há arquivo e não dá para ler" é falha, e ser rigoroso ali rejeitaria toda chave válida — daí cair para `string`, com aviso.

Só `.json`, e por escolha: `JSON.parse` é zero dependência. Ler `.ts` exigiria executar o arquivo no build, e um loader de `lazy: true` (`defineI18nLocale(async …)`) não tem chave nenhuma para ler — é provavelmente o caso mais comum em produção, e é por isso que o aviso nomeia o motivo.

Detalhe do ambiente: **`@nuxtjs/i18n@10.6.0` lança o próprio `ENOENT` durante o setup dele quando um `file` declarado não existe**, então a degradação por leitura cobre o arquivo *presente e ilegível*, não o ausente — para o ausente o build já morreu antes, no i18n.

Extração, sobre o arquivo do `defaultLocale`, achatado em caminhos pontilhados: as interpolações literais do vue-i18n (`{'…'}`) saem **antes** de procurar params, para que `{'{{contato_nome}}'}` não vire param; params nomeados por `/\{\s*(\w+)\s*\}/g`; plural é a mensagem conter `|`. Sem params e sem plural → `never`; só nomeados → `{ a: Interp }`; só plural → `number`; ambos → a união dos dois.

O `builder:watch` cobre `/(^|[\\/])i18n[\\/].*\.json$/` e chama `builder:generateApp` — inclusive em **edição**, não só add/unlink: o arquivo mora fora do `srcDir` (`<rootDir>/i18n` por padrão) e mudar uma mensagem muda as chaves que o `tr.d.ts` oferece.

#### A ponte é hook, não peer dependency

`nuxt.hook("i18n:registerModule", …)` é a API documentada. O hook **nunca dispara** se o @nuxtjs/i18n não estiver instalado, então não há guarda a escrever nem dependência a declarar — e é por isso que a *detecção* de qual motor entra no bundle não pode depender dele, e usa `hasNuxtModule` (acima).

Quem escolhe o motor é o build; quem acha o `$i18n` é o runtime. O `bridge.ts` lê `tryUseNuxtApp()?.$i18n` e o valida **estruturalmente** (`t` função, `locale` com `.value`) — o módulo é opcional, então não há tipo a importar nem dependência a declarar. Sem `$i18n` por perto (um teste unitário, um `mount()` fora de app), a ponte devolve a chave e um `ref("")`. O `standalone.ts` usa `useState("rform-locale")` semeado com a opção `locale` do módulo (default `"pt-BR"`) quando há app Nuxt, e um `ref` local quando não há — cair de volta em vez de lançar é o ponto, porque `tr` também é chamado de dentro de uma `validation`, muito depois de qualquer setup.

**O arquivo de locale é um loader, e o import dele é dinâmico** (`src/langFile.ts`). Não é estilo — é a única forma que atravessa o `@nuxtjs/i18n` inteira. Ele pré-compila **todo** arquivo de locale pelo gerador do intlify, que só sabe lidar com literal estático; diante de um `export default { rform: locales["pt-BR"] ?? {} }` o `scanAst` dele vê `ObjectExpression`, entra no gerador e emite `"rform": rform{` — código inválido. O sintoma é o pior possível: um `Transform failed` apontando para `.nuxt/rform/i18n/pt-BR.ts`, **cujo conteúdo em disco está correto**. Função no `export default` é o que o `allowDynamic` deixa passar intacto.

E o import é `import()` porque o mesmo handler faz `i18nPathSet.add` de todo **import estático** do arquivo de locale: um `import { locales } from "#rform/locales"` arrastaria o barrel de packs para o mesmo pré-compilador, e aquele arquivo é ainda menos literal. `findStaticImports` não vê import dinâmico.

Isso quebrou o `0.1.0` no npm (issue #1), e **não aparecia aqui**: o `localePaths` que o i18n manda pré-compilar passou a filtrar `type === "static"` no 10.6, que é a versão dos playgrounds. No 10.4 — a do app que reportou — a lista é todo arquivo de locale. `test/unit/langFile.test.ts` roda o `generateJavaScript` do `@intlify/bundle-utils` de verdade sobre o arquivo gerado, com os mesmos argumentos que o `VueI18nPlugin` recebe, e exige que ele volte **idêntico** — mais um caso que prova que a forma antiga saía com `rform{`.

**Os arquivos do `langDir` são escritos na mão, com `writeFile`, além do `addTemplate`.** O @nuxtjs/i18n lê cada um com `readFileSync` durante o setup dele (`analyzeResource`, para descobrir se é objeto ou loader), e template do Nuxt só chega ao disco no `builder:generateApp`, bem depois. O sintoma de esquecer isso é um `ENOENT` apontando para um caminho dentro do próprio `buildDir`.

**Quem manda na lista de codes é o app, e a ponte só responde.** O merge do i18n é por code exato — um app com `locales: ["pt"]` não veria um pack registrado só como `pt-BR` — mas registrar `pt` na marra tem preço: o `mergeConfigLocales` do i18n junta *todos* os configs num `Map` por code, então **um code que só a ponte cita entra na lista de locales do app**, e de lá sai no seletor de idioma dele, no `localeCodes` e no prerender.

Medido no playground `i18n` com `locales: ["pt", "es"]`: registrando os codes dos packs, o app passa a ter `["pt", "es", "en", "pt-BR"]`. Uma tabela de apelidos (`pt-BR` → `pt`, `en` → `en-US`/`en-GB`…) só piora — são mais codes inventados.

Então o `module.ts` lê os codes que o app declarou (`nuxt.options.i18n.locales` mais as opções inline do `modules:`) e registra **sob esses**, escolhendo o pack por code exato e, na falta, por língua. O app de `pt` + `es` continua com `["pt", "es"]`: o `pt` recebe o pack `pt-BR`, o `es` não recebe nada e cai no `fallbackLocale` do vue-i18n, que é a precedência normal dele. Sem code legível (config de i18n num layer) cada pack entra sob o próprio code — o mínimo que faz a ponte funcionar, e são os codes do módulo, não apelidos.

O `packFor` do `module.ts` é gêmeo em build time do `matchLocale` de `runtime/utils/i18n.ts`, e não um import dele: aquele arquivo só resolve pelo alias `#rform/types/locales`, que não existe em build time — trazê-lo para cá arrastaria o grafo de tipos gerado junto.

O app com i18n sobrescreve qualquer mensagem no próprio `locales/pt-BR.json`, sob a chave `rform` — precedência normal do vue-i18n, sem nada específico do módulo.

#### O que **não** foi localizado

`formatIso`/`formatIsoDate`/`formatIsoDateTime` e o ramo ISO de `parseIncoming`. ISO é o formato do model e é locale-independente por definição: localizá-lo faria o valor gravado mudar com o idioma da tela. Só o segundo ramo de `parseIncoming` — uma string digitada — passa a depender do pack, e por isso a função ganhou um parâmetro de pattern.

Cuidado com esse parâmetro: `arr.map(parseIncoming)` passaria o **índice** como pattern. Por isso `Calendar.vue` e `Date.vue` embrulham em `incoming(value)` antes de mapear.

### `Element<OBJ, C, D>` (`src/runtime/type.d.ts`)

- `C` é o field type ("text", "color", ...) e filtra quais presets o `rule` aceita, via `available` de cada um. Todo **campo** passa o seu: `Element<typeof defaults, "text">`. `Form` não passa `C`, porque não é campo e não tem membro no `FieldType`. Os que sobrescrevem o model (`File`, `Hour`, `Number`) passam `D` como terceiro parâmetro.
- Tipa `modelValue`/`default` baseado em `OBJ["default"]` via `ConvertNeverToUnknown`.
- `error` é `TrInput`, como `label` e `placeholder` — mas só na entrada: o que sai do merger é `FieldProps<T>`, com `error?: string`. Ver "O `error` é `TrInput` na entrada e `string` na saída".
- **Não** tipa nada a partir de `OBJ["text"]`, e não tem como — ver "O `Element` não deriva os props de texto", acima. Campo com texto intersecciona `TextProp<typeof defaults.text>` no próprio `Props`, ao lado da entrada em `defaults.text`; `label` e `placeholder` também ficam de fora do `Element` — quem os usa declara o próprio `TrInput` (é o `placeholder?: TrInput` do `File`).
- Atenção: se `defaults.default = null`, então `modelValue?: null` — props com valores diferentes precisam sobrescrever via `Omit<Element<...>, "modelValue" | "default"> & { modelValue?: unknown; default?: unknown }`.

### A prop `autocomplete`

É **prop**, e não atributo de fallthrough. Todo campo tem um `<div>` na raiz e
nenhum declara `inheritAttrs: false`, então um `<RText autocomplete="username" />`
pousava no wrapper, onde o navegador não o lê — e sem ele um formulário de login
não conversa com gerenciador de senha nenhum. Era a issue #3.

Ela mora **fora** do `Element`, num fragmento `Autocomplete` que cada campo
intersecciona no próprio `Props`. É a mesma parede que o `disabled` encontrou: dar
a prop aos treze no nível do tipo sem os treze honrarem no template é quebra
calada. E aqui não é escolha — o HTML **não** aceita `autocomplete` num
`<input type="checkbox">` nem num `<input type="file">`.

| campo | onde pousa |
|---|---|
| `Text` | `<input>` |
| `Textarea` | `<textarea>` |
| `Number` | `<input type="number">` |
| `Date` | primeiro `<input>` (os dois ramos do `mode`, não o do range) |
| `Hour` | primeiro `<input>` |
| `Pin` | primeiro `<input>`, via `index === 0` |

Fora: `Switch` e `File` pelo tipo do input; `Select`, `Color`, `Calendar`, `Array`
e `Object` porque não têm controle nativo do valor.

**Nos multi-input é o primeiro, e não todos.** Num `RPin` é onde
`autocomplete="one-time-code"` tem de estar para o Chrome e o Safari oferecerem o
código do SMS. Num `RDate`/`RHour` em range, repetir o token no segundo input
faria o preenchedor casar o par errado.

#### O autofill de OTP chega por `input`, não por `paste`

Pôr `one-time-code` no `RPin` **não bastava**: o `onInput` fazia
`clean(el.value.slice(-1))`, então o código inteiro que o navegador injeta de uma
vez virava o **último dígito** na primeira célula e os outros cinco sumiam. O
`onPaste` sempre distribuiu certo — e nunca era chamado, porque autofill (iOS
Safari, Chrome Android, gerenciador de senha no desktop) escreve o valor e dispara
`input`; `paste` só sai de um colar de verdade.

O que separa os dois casos é o comprimento: **digitar numa célula dá exatamente um
caractere a mais do que ela já tem** (`raw.length === current.length + 1`), porque
o `:value` a mantém com no máximo um. Qualquer coisa acima disso é preenchimento e
vai para o `fill`, que é o corpo que o `onPaste` já tinha e agora os dois
compartilham.

O guarda contra a volta é `test/nuxt/Pin.test.ts`, em "RPin, autofill de
one-time-code" — inclusive o caso de digitar numa célula cheia, que é o que a
regra do comprimento não pode quebrar.

Lida de `props.autocomplete` — o merge —, não de `_props`, então
`defineFieldDefaults({ Text: { autocomplete: "off" } })` padroniza o app inteiro e
a tag continua vencendo. Não entra no `defaults`, então a regra "não apaga" do
`merger` não tem o que atrapalhar. O modo schema sai de graça: sendo prop
declarada, o `rest` do `RDynamic` a entrega como prop em vez de fallthrough, e o
`Base<P, C>` do `schema.d.ts` a tipa — é uma palavra só, então o `SnakeAliases` a
descarta e não há apelido a inventar.

#### O `AutoFill` do `lib.dom` não serve

Ele é uma união de **template literal** (`${section}${addressKind}${field}${cred}`),
e usá-lo no `Props` derruba os seis campos com `TS2590: Expression produces a union
type that is too complex to represent`, apontando para o `withDefaults`. Medido: os
seis, mais três arquivos de teste que os montam. É a mesma família do estouro que o
`Condition` causou no `merger`, e a diferença é que este falha alto.

Por isso `AutocompleteToken` é a lista literal do WHATWG escrita à mão, mais
`(string & {})` — que preserva o autocompletar do editor **e** aceita as formas
compostas (`"shipping street-address"`, `"section-a username"`) que a união de
template literal existia para cobrir.

## Gotchas

### `#rform/utils` é o barrel público

O template de `utils.ts` emite `import X from "<path>"` (default, virando `export { X }`) **e** `export * from "<path>"` para cada arquivo de `src/runtime/utils`. É o `export *` que faz `import { defineRule } from "#rform/utils"` funcionar. De lá saem também `tr` e `trRule`, `defineLocale` e `prefixText`.

#### Só quem tem `export default` é nomeado

O template emite `import <basename> from` e a entrada no `export { }` **apenas**
para o helper que de fato tem `export default`. Um export explícito **sombreia** o
`export *` do mesmo arquivo, então um helper cujo default tem o nome de um export
nomeado seu entregaria o objeto errado.

É o caso do `tr.ts`, e ele mordeu de verdade: com `export default { tr, trRule }`,
`import { tr } from "#rform/utils"` devolvia **o objeto**, não a função — e o
sintoma era `This expression is not callable` no primeiro app fora do módulo que
tentou usar o que o próprio `.claude/CLAUDE.md` documenta. O default saiu do
`tr.ts`, e `hasDefaultExport` no `module.ts` é o que impede a classe inteira de
voltar.

#### O nome sai do `collectModules`, porque o `dist` tem cada helper duas vezes

O `src/runtime/utils/` do repo tem só `.ts`; o `dist` publicado tem `merger.js`
**e** `merger.d.ts`. Um `basename(file, ".ts")` sobre o `readdir` devolvia
`"merger.js"` e `"merger.d"` — os dois viravam identificador no barrel gerado, e
`.nuxt/rform/utils.ts` saía com `import merger.d from …`. Não parseia, e todo campo
importa dos dois barrels: no `0.1.0` do npm nenhum campo montava (issue #1).

Quem responde pelo nome agora é `collectModules` (`src/scan.ts`) — puro, e o único
lugar que conhece o layout do `dist`: ignora `.d.ts`, tira a extensão qualquer que
seja ela, e deduplica por nome. Os dois barrels e o escaneamento de locale passam
por ele; `collectPresets` mantém o próprio filtro, porque ali o nome vem do caminho
inteiro. O `specifier()` casa com isso, cobrindo `.mjs`/`.cjs` além de `.js`/`.ts`.

**Nada disso aparece rodando o repo**, e é o ponto: os playgrounds carregam o módulo
por caminho relativo (`"../../src/module"`), então todo teste vê o layout do fonte. A
única forma de exercitar o outro é consumir o tarball — `npm pack` num app de
verdade, que é como os três defeitos do `0.1.0` e o do `0.1.1` foram confirmados e
verificados.

#### Só `src/runtime/` chega ao `dist`

O `@nuxt/module-builder` publica exatamente duas coisas: o bundle rollup de
`src/module` — que engole `appMessages.ts`, `langFile.ts`, `presets.ts`, `scan.ts` e
o `vite.plugin.ts` junto — e o mkdist de `src/runtime/`. **Nada mais da raiz de
`src/` existe no tarball**, e é a mesma regra que já obrigou o `style.css` a descer
para `src/runtime/`.

O módulo de tipos mora em `src/runtime/type.d.ts` por isso, e não por gosto. Ele
esteve na raiz de `src/` até a `0.1.1`, onde três consumidores apontavam para um
arquivo que o app instalado não tinha (issue #2):

| quem | apontava para | no `dist` publicado |
|---|---|---|
| o template `types/index.d.ts` | `resolve("type")` | `dist/type` — inexistente |
| o template `#rform/defaults` | `specifier(resolve("type"))` | idem |
| `utils/defineDefaults.ts`, `defineFieldDefaults.ts` | `../../type` | `dist/type.js` — idem |

O mkdist copia um `.d.ts` **cru**: o `jsLoader` dele sai cedo no `DECLARATION_RE` e o
arquivo cai no fallback de cópia, sem passar pelo esbuild (que o esvaziaria, já que é
só tipo). Então `src/runtime/type.d.ts` chega ao `dist` byte a byte.

**Os dois primeiros modos de falha são calados, e o terceiro não.** `import type` é
apagado pelo esbuild antes de resolver, então o `defaults.ts` do usuário e os `.d.ts`
do próprio `dist` seguem funcionando com o caminho quebrado — só o `tsc` os lê, e um
app sem `typecheck` nunca percebe. Quem não escapa é um `.vue`: o
`@vue/compiler-sfc` precisa **resolver** o tipo para gerar as props em runtime a
partir do `defineProps<Props>()`, e aí o build morre com `Failed to resolve import
source`. É por isso que o defeito só apareceu quando alguém escreveu o primeiro campo
próprio em `app/rform/fields`.

A guarda é `test/unit/dist.test.ts`, e ela cobre a regra, não o caso: todo
`resolve("…")` literal do `module.ts` tem de apontar para dentro de `runtime/` **e**
existir em disco, e nenhum import relativo de `src/runtime/**` pode escapar de
`src/runtime/`. Roda na suíte normal, sem rede e sem build.

**Ela não substitui consumir o tarball**, e a diferença importa: a guarda prova que os
caminhos são publicáveis, não que o pacote monta. O defeito do `merger.d` acima, por
exemplo, passa por ela intacto — quem o pega é `npm pack` num app de verdade.

Ao montar esse app à mão, pine o `typescript` em `~5.9.3`: a `7.x` é o port nativo e
não expõe `ts.sys`, de que o `resolveFS` do `@vue/compiler-sfc` depende. O erro de lá
é `No fs option provided to compileScript in non-Node environment`, que não diz nada
sobre versão de TypeScript.

#### O `paths` da raiz é do build, não do editor

O `tsconfig.json` da raiz declara `compilerOptions.paths` para os `#rform/*`, e ele
existe pelo **build**. O `@nuxt/module-builder` acha o tsconfig mais próximo de
`src/runtime` (tsconfck, subindo) e entrega o `compilerOptions` cru ao mkdist, que o
passa por `convertCompilerOptionsFromJson(…, process.cwd())` — daí os alvos serem
relativos à raiz do pacote, que é onde o `prepack` sempre roda. Sem `baseUrl`: ele não
é preciso, e evita que todo specifier pelado passe a tentar resolver pela raiz.

Sem esse bloco o arquivo é *solution-style* puro (`files: []` + `references`), **sem
`compilerOptions` nenhum** — e aí `loadTSCompilerOptions` devolve `{}`. Nenhum
`#rform/*` resolve na emissão de declaração, e o estrago é total e calado:

```
#rform/types não resolve  →  Element, Utils, Mask viram `any`
                          →  Props = Element<…> & Utils[…] & … é INTERSEÇÃO
                          →  any & X = any  →  Props colapsa em `any` inteiro
                          →  dist sai com DefineComponent<any, …>
```

Ou seja: **nenhum campo do pacote publicado tem prop tipada**, e no `RSelect` o
`props` do `__VLS_export` sai como `__VLS_PrettifyLocal<any>` — o generic perde o
único site de inferência que tinha, `Opts` cai no constraint `Options`, e o slot
resolve para `OptionItem<Record<string | number, unknown> | Primitive, unknown,
unknown>`. Foi o que fez a issue #4 parecer não corrigida depois do `3b0e08f`: o
fonte estava certo, o `dist` é que não tinha tipo nenhum para inferir.

Com o `paths`, o emitido vira `DefineComponent<Props, …>` e
`__VLS_PrettifyLocal<Props<Opts, Multiple, KeyValue, KeyLabel, ModelFull>>`. A
**indireção é preservada** — o `.d.ts` mantém o `import type … from "#rform/types"`
—, então quem resolve `Utils`/`Element` é o `.nuxt` do app consumidor, e um util ou
campo de usuário continua entrando. Nada do `.nuxt` do módulo é assado no pacote.

Os alvos apontam para `.nuxt/rform/*`, que é **gerado**: `#rform/types/presets` e
`#rform/types/components/utils/props` são template, não têm equivalente em `src/`.
Quem os cria é o `nuxt-module-build prepare`, e o CI o roda (`pnpm run dev:prepare`)
antes do `pnpm publish`. `#rform/translate` é a exceção que precisa de entrada
exata, porque não existe em `.nuxt/rform/` — ele é alias para um dos dois motores.

A guarda é o segundo `describe` de `test/unit/dist.test.ts`, e cobre a regra: todo
`#rform/…` que `src/runtime/**` importa — estático **ou** dinâmico, que é como o
`#rform/presets` entra — tem de ser casado por algum padrão do `paths`. É pura e
sem build; o que ela não prova é que o `dist` monta, e isso continua sendo `npm pack`
num app de verdade.

#### O consumidor precisa incluir os `.d.vue.ts` do pacote

Um campo do app que **estende** o `Props` de um embutido —
`Omit<SelectProps, "options"> & { route }` a partir de
`#rform/builtin/fields/Select.vue` — quebrava o `nuxi build` do app instalado com
`[@vue/compiler-sfc] Failed to resolve import source "#rform/types"`, apontando para
o `Select.d.vue.ts` **dentro de `node_modules`**. Era a issue #5, e a indireção que
a seção acima preserva de propósito é o que a arma: o `.d.vue.ts` emitido importa
`#rform/types`, e só o `.nuxt` do app sabe para onde isso aponta.

O compiler-sfc precisa enumerar as props em runtime, então segue o tipo até o
arquivo do pacote e, para resolver o alias, faz `ts.findConfigFile` **a partir desse
arquivo** (`resolveWithTS`). Acha o `tsconfig.json` do app, carrega ele e os
referenciados, e escolhe o que **inclui** o arquivo pelo `include`/`exclude` — por
`minimatch`, não pela semântica do TS. Nenhum inclui `node_modules`, e o fallback é
o **último** da lista: a raiz, `files: []`, sem `paths`. O `exclude: ["../node_modules"]`
que o Nuxt escreve não atrapalha, porque sem `**` o minimatch não casa descendente
— é uma mudança de semântica do compiler-sfc de distância de passar a atrapalhar,
e é por isso que o primeiro `describe` de `test/unit/builtinInclude.test.ts` existe.

O kit só põe `runtime`/`dist/runtime` no `include` de módulo que mora **dentro** do
`rootDir` e fora de `node_modules`; instalado, o módulo recebe só `exclude`. Daí o
`module.ts` empurrar a entrada, no `prepare:types`:

```ts
tsConfig.include.push(`${componentsPath}/**/*.d.vue.ts`);
```

Três decisões nessa linha, e as três foram medidas:

- **Absoluto, e o kit relativiza.** O `resolveConfig` do `writeTypes` troca todo
  `include` absoluto por `relativeWithDot(buildDir, p)`, com `pathe`. Um
  `relative()` do `node:path` no Windows sairia com `\`, e o minimatch lê `\` como
  escape — a entrada compilaria e nunca casaria.
- **Do mesmo `componentsPath` do alias, e não do link.** O compiler-sfc resolve o
  arquivo pelo `ts.sys.realpath`, então com pnpm o arquivo lido mora em
  `node_modules/.pnpm/…`, e um padrão escrito pelo `node_modules/nuxt-rform/…` do
  link **não casa** — o contorno que o consumidor escreveria à mão só funciona no
  layout plano do npm. O `exsolve` já entrega ao Nuxt o caminho real do módulo, e o
  jiti o preserva, então `import.meta.url` — e o `componentsPath` — já é o real;
  alias e `include` saem da mesma variável e concordam por construção.
- **Só `.d.vue.ts`, e só sob `components/`.** São declaration files, então o
  `skipLibCheck` os ignora no editor e no `vue-tsc`; `runtime/**` inteiro poria os
  `.vue` e os `.js` do pacote no programa do Volar. O que se perde com o recorte,
  medido contra o `dist` de verdade: o `type.d.ts` (fora de `components/`) importa
  `#rform/types/presets` e `#rform/types/tr`, e continua sem casar — `rule` e
  `error` saem com `type: null` no consumidor em vez de `[Function, Array]` /
  `String`. É o mesmo que **todo** campo de usuário já recebe hoje: o
  `inferRuntimeType` falha macio por prop, e só a resolução do `Props` inteiro é que
  falha alto. Incluir `runtime/**/*.d.ts` fecharia isso; não se fez.

Uma linha de `include` **não** cobre o pacote linkado (`pnpm link`, `file:` para um
diretório): o `findConfigFile` sobe a partir do arquivo **real**, que mora fora da
árvore do app, e nunca chega ao tsconfig dele. É o cenário do clone que a issue
descreve como "passa" — passa porque acha o tsconfig deste repo, com o `paths`.

Duas guardas em `test/unit/builtinInclude.test.ts`: o compiler-sfc de verdade sobre
um consumidor sintético em layout pnpm (sem a entrada morre em `#rform/types`; com
ela o `Props` estendido enumera `label` e `route` e perde `options`; pelo link não
casa) e o `tsconfig.app.json` gerado da fixture carregando a entrada. Como a do
`paths`, ela prova a regra e não o pacote — o antes e o depois foram conferidos com
`npm pack`, `pnpm install` e `nuxi build` num app fora do repo, onde o `before.tgz`
morre na linha 113 do `Select.d.vue.ts` e o `after.tgz` monta com as 23 props
enumeradas e o `vue-tsc` limpo.

#### Os specifiers saem sem extensão

Os specifiers do `export *` passam por `specifier()` e saem **sem extensão**. Com `.ts` no caminho, o TS precisa de `allowImportingTsExtensions` e um app consumidor normalmente não liga — o sintoma é `TS2614: Module '#rform/utils' has no exported member 'defineRule'`, como se o barrel não exportasse nada nomeado.

Consequência de carga, da mesma classe que a do zod: **importar qualquer coisa do barrel puxa a pilha de tradução inteira**, e num app sem i18n isso inclui o `@intlify/core` e todos os packs de locale. O barrel é ansioso por construção — é o preço de ele ser a entrada pública única.

#### O `import` vem pareado com o próprio `export *`, e os reentrantes vão para o fim

O template não emite um bloco de `import` seguido de um bloco de `export *`: **cada `import` vem colado ao `export *` do mesmo arquivo**, e os helpers que fazem *value import* de `#rform/*` são estavelmente ordenados para o **fim** da lista.

Isso existe porque `utils/tr.ts` fechou um ciclo de verdade:

```
#rform/utils → tr.ts → #rform/translate → standalone.ts → #rform/locales
             → um pack de locale do usuário → import { defineLocale } from "#rform/utils"
```

O vite-node **rebaixa `export * from` para uma chamada posicional `__vite_ssr_exportAll__`**, não para um live binding. Na reentrada, portanto, só enxerga-se o que os `export *` que **já rodaram** trouxeram — não basta o `export *` estar declarado depois no arquivo, ele precisa não ter executado. O sintoma foi `defineLocale is not a function`, apontando para o **pack do usuário**, que não tem culpa nenhuma.

O predicado é `importsRformValue` (`module.ts`), e ele **ignora import type de propósito**: `import type { Base } from "#rform/types"` é apagado na compilação e nunca roda código — sem essa exclusão, quase todo helper qualificaria como reentrante e a ordenação perderia o sentido. Duas lacunas conhecidas dele, as duas por ser linha a linha:

- `import { type Foo } from "#rform/x"` — todo o conteúdo inline-type. Falso **positivo**: manda o helper para o fim sem necessidade, e não quebra nada.
- um `import` quebrado em **várias linhas**. Falso **negativo**, e esse deixaria o ciclo voltar. Um helper novo que faça value import de `#rform/*` precisa escrever a declaração numa linha só.

Ordenar em vez de contar com o `readdir` (que hoje põe `i18n.ts`, dono do `defineLocale`, antes de `tr.ts`) é o que torna a propriedade independente do que for adicionado ou renomeado nesse diretório depois.

### Um `@` literal numa mensagem precisa ser `{'@'}`

`@:chave` é a sintaxe de mensagem ligada (*linked message*) do vue-i18n, e ela não pede opt-in — um `@` cru em qualquer pack, do módulo ou do app, é interpretado como o início de uma. Um e-mail (`"Fale com a gente: contato@empresa.com"`) já derrubou uma mensagem de playground assim: em runtime, `"Invalid linked format (error code: 10)"`, nomeando o caminho da mensagem quebrada — não o `@`, então o sintoma não aponta pro problema.

A saída é escrever o `@` como interpolação literal, `{'@'}` — a mesma sintaxe que já escapa `{'{{...}}'}` para um par de chaves cru. E o gerador de `TrInput` (`src/appMessages.ts`, `messageParams`) já conta com isso: ele **remove** todo `{'…'}` antes de procurar `{param}`, então escapar o `@` não inventa um param fantasma — o comportamento é o mesmo que já existe para chaves literais, só que aplicado ao caso que ninguém tinha testado até morder.

### O preview do autofill é invisível para o JS

Passar o mouse sobre uma sugestão do preenchedor do browser pinta o valor no `input` **sem** disparar `input`/`change` — o `model` continua vazio, então o `RUtilsPlaceholder` fica em `notFilled` (atrás do campo, `-z-10`) e os dois textos se sobrepõem. Não há evento para escutar; quem enxerga esse estado é só o CSS, via `:-webkit-autofill` (que casa preview **e** valor comitado — Chrome, Safari e Firefox 86+; `:-internal-autofill-previewed`, que separaria os dois, é restrito à UA stylesheet e não parseia em folha de autor).

Daí o par: o `Placeholder.vue` emite `data-floating` quando virou label flutuante, e o `style.css` faz `.RField :has(:-webkit-autofill) > .RUtilsPlaceholder:not([data-floating]) { opacity: 0 }`. O `>` é o que limita ao placeholder cujo pai contém o input — sem ele o `:has()` casaria todo ancestral dentro do campo. O `:not([data-floating])` preserva o caso sem `label`, em que depois do autofill comitado é o próprio placeholder que rotula o valor lá em cima.

**Ancorar em `.RForm` não serve, e é o motivo de as classes-gancho existirem.** O autofill não depende de `<form>`: o Chrome agrupa campos soltos ("unowned form fields") por heurística de DOM desde a v91, e `useField` faz `inject(key, undefined)` — campo sem `RForm` pai é caso suportado.

Nenhuma utility do Tailwind declara `opacity: 1` no estado base, então a regra vence independentemente da ordem de layer — não precisa de `!important` como o `[data-autocompleted]`.

### `transition-[a_b]` com duas propriedades é silenciosamente `all`

`transition-[translate_position]` vira `transition-property: translate position` — sem vírgula, é sintaxe inválida, a declaração é descartada e a propriedade volta ao inicial `all`. Com o `duration-300` ao lado, **tudo** passa a animar, `opacity` incluída: o `disable` (`opacity-0`) do placeholder ganhava um fade de 300ms ao sumir e voltar. Vírgula é o separador (`transition-[translate,top,left]`); `_` só serve para espaço *dentro* de um valor.

Compila, passa na lint e não emite aviso nenhum. Para conferir o que o Tailwind de fato emitiu: `compile("@tailwind utilities;", { base }).build([classe])` da API de `tailwindcss`.

### `size()` do floating-ui sempre ganha do `flip()`

O `RUtilsDropdown` posiciona com `offset → flip → shift → middleware do campo`, e o campo que passa middleware é o `Select`, com um `size()` que casa a largura da referência e limita a altura ao espaço disponível. Os dois disputam o mesmo elemento, e **o `size` ganha**: ele devolve `reset: { rects: true }` sempre que o `apply` mudou as dimensões, e o `computePosition` reinicia a cadeia (`i = -1`) com rects novos. Na volta, o `flip` mede um painel **já** achatado no que cabe embaixo — sem overflow, sem flip.

E o achatamento já está lá antes de abrir: o `autoUpdate` continua recalculando com o painel fechado (`v-show` deixa ele na árvore, 0×0), então o primeiro `open` acontece com um `maxHeight` medido para o espaço de baixo. Medido no harness sintético do teste, com o campo a 100px do fim da viewport: `bottom-start` com **35px** de altura, aberto ou fechado, para sempre.

Quem destrava é o piso do `dropdownFit` (`src/runtime/utils/dropdownMiddleware.ts`): `max(min(minHeight, mais folgado − 10), availableHeight − 10)`. Recusando encolher abaixo do que o painel pede, sobra overflow para o `flip` enxergar — aí ele vira e o `size` da passada seguinte recalcula com o espaço de lá.

**E o piso tem um teto: o lado mais folgado.** Ele sai de um `detectOverflow` com `elementContext: "reference"` — o espaço acima e abaixo do **campo**, não do painel —, mais `altBoundary: true`, que é o que o mede contra o mesmo limite que o `size` usa: o painel é fixo e teleportado, então um scroller em volta do campo não é fronteira dele. Com o teto, o lado mais folgado sempre cabe o piso, então o `flip` **acha um lado que serve** e nunca precisa do `bestFit`: ou fica no preferido, ou vai para o maior — e em nenhum dos dois o painel sai da viewport. Isso já não valia: com o piso fixo em 160px, um campo sem 160px de nenhum dos dois lados virava para cima e sobrava fora da tela. Era o preço, e não é mais.

O número é `minHeight`, prop do `RSelect` (default `DROPDOWN_MIN_HEIGHT`, 320), e é o único lugar onde "de que lado abre" se decide. Ele mora **fora** do `defaults`, como o `debounce`: um `320` ali seria resultado truthy, e a regra "não apaga" do `merger` engoliria o `:min-height="0"` — que é como se recusa a conta e se volta à preferência fixa por baixo. O teto do `ui` (`--max-height`, 25rem) limita o quanto o painel cresce de qualquer jeito, então pedir mais que ele não muda nada.

Ordem: `size` **depois** do `flip`, que é o que a doc recomenda para o `fallbackStrategy` default (`bestFit`) — o outro par documentado é `size` antes com `initialPlacement`, e aí um campo espremido dos dois lados voltaria para baixo em vez de escolher o lado maior.

Nada disso aparece em teste de componente: jsdom e happy-dom não têm layout, todo rect é 0. `test/unit/dropdownMiddleware.test.ts` roda o `computePosition` de verdade sobre uma plataforma sintética (viewport fixa como clipping rect, altura do painel = conteúdo limitado pelo `maxHeight` que o `apply` escreveu) e computa **duas** vezes, fechado e aberto, porque o bug só existe no segundo.

#### O painel é do Dropdown: `z-999`, `--width`, `--available-height` e um endereço só

O `apply` do `dropdownFit` escreve a largura da referência como `--width` e a altura livre do lado escolhido como `--available-height` no painel, por `setProperty` — custom property atribuída num `CSSStyleDeclaration` vira propriedade JS comum e nunca chega ao CSS. Quem lê é o **default do `RUtilsDropdown`**, ao lado do `z-999` que os três campos repetiam: `w-(--width)` e `max-h-[min(var(--available-height),var(--max-height,100vh))]`.

O motivo de a largura ser classe e não `width` inline é precedência: inline ganha de qualquer classe, então um `ui: { Utils: { Dropdown: { popover: "w-80" } } }` não tinha como vencer e perdia calado (é o caso do `playgrounds/i18n/app/components/Locale.vue`). Como classe, o override é o `twMerge` de sempre: `w-80` substitui `w-(--width)`, e a medida do `size` deixa de ser lida — o `reset: { rects: true }` continua acontecendo, porque a largura renderizada muda do mesmo jeito.

**Toda aparência de painel mora em `ui.Utils.Dropdown.popover`, nunca num `class` no template do campo**, e é isso que faz os três campos conviverem:

| campo | `popover` | resultado do `twMerge` |
|---|---|---|
| `Select` | `[--max-height:25rem] overflow-auto rounded-… border… bg…` | `z-999 w-(--width) max-h-[min(…)] [--max-height:25rem] overflow-auto …` |
| `Date` | `w-72` | `z-999 w-72 max-h-[min(…)]` |
| `Color` | `flex w-64 flex-col …` | `z-999 flex w-64 flex-col … max-h-[min(…)]` |

`Date` e `Color` não passam `dropdownFit`, então não têm `--width` nem `--available-height` declarados — e `w-(--width)` sem a variável renderiza `width: auto`, enquanto o `min()` com uma variável indefinida é inválido em tempo de computação e cai em `max-height: none`. Se a largura deles continuasse num `class` do template, as duas classes cairiam no mesmo elemento **sem passar pelo merge**, e quem ganha aí é a ordem da folha de estilo, não a ordem do atributo: o painel abriria com a largura errada, compilando e sem aviso. Foi por isso que o `popover` do `RDate` e o `picker.container` do `RColor` mudaram de endereço.

As variáveis são `--width` e `--available-height`, e não `--rf-*`, de propósito: são medidas por elemento, não token de tema, e `test/unit/theme.test.ts` exige que todo `--rf-*` lido num componente esteja declarado no `style.css` — o que um valor inline nunca estará.

**A altura tem duas variáveis porque tem dois donos.** `--available-height` é a medida; `--max-height` é o **teto**, e quem o escreve é o `ui`. O `min()` dos dois mora uma vez só, no default do Dropdown, e o `Select` declara o teto de `25rem` (o `max-h-100`) com `[--max-height:25rem]` — uma lista de mil opções não toma a tela inteira, e o painel continua encolhendo quando a viewport tem menos que isso. **Isso já foi `maxHeight` inline**, escrito pelo próprio `apply`: o mesmo problema da largura, e um `max-h-100` no `popover` perdia calado do mesmo jeito.

Trocar o teto é uma arbitrary property, por campo ou pelo `defineFieldDefaults`: `ui: { Utils: { Dropdown: { popover: "[--max-height:30rem]" } } }` — o `twMerge` substitui a mesma propriedade em vez de acumular, então o `25rem` do Select vai embora. Tirar o teto é `[--max-height:100vh]`, que é o fallback do `var()`: `min(livre, viewport)` é só a altura livre. Um `max-h-60` cru também funciona, substituindo o `min()` inteiro — e aí a medida do `size` deixa de ser lida, o mesmo preço que `w-80` paga; num viewport curto o painel passa da borda. Não é o que se recomenda.

As guardas: `test/unit/dropdownMiddleware.test.ts` mede o painel a partir de `style["--width"]` e `style["--available-height"]` e asserta que `style.width` e `style.maxHeight` ficam `undefined` (o inline não pode voltar); `test/nuxt/dropdownPopover.test.ts` monta os três campos e confere o `z-999` e o `min()` em todos, o `w-(--width)` só onde há medida, a troca por `w-72`/`w-64` onde não há, o `[--max-height:25rem]` só no Select, e os dois overrides por `ui` — a largura, e o teto substituindo em vez de acumular.

#### O painel mora em `#teleports`

O `<div>` do painel é embrulhado num `<Teleport to="#teleports">`, e a referência
fica onde sempre ficou. `position: fixed` sozinho não bastava: um ancestral com
`transform`, `filter` ou `will-change` vira o containing block do `fixed`, e o painel
passa a se posicionar em relação a ele — um card com transição de entrada basta —, e
um `overflow: hidden` no mesmo ancestral o corta. Teleportar é a saída de todo
popover, e o que não muda por causa disso é o que faz ela caber aqui:

- os tokens `--rf-*` moram no `:root`, não no `.RField` — o painel continua com cor e
  radius. Os **resets** de `.RField` (spinner, autofill) deixam de alcançá-lo, e nada
  dentro dele precisa: o search do `RSelect` é `type=search`, o calendário é botão;
- o `handleClick` e o `useFloating` trabalham por `contains` e por ref de DOM, não
  pela árvore de componentes;
- a classe-gancho `RUtil RUtilsDropdown` vai no próprio `popover`, então viaja junto;
- o `has-[:focus]` do `RDate` fica no wrapper da referência, que nunca conteve o
  painel.

**`#teleports`, e não `body`.** O painel é `v-show`, então **renderiza no servidor**,
com `display:none`, e o alvo precisa existir no HTML do SSR. O renderer do Nuxt 4
trata os dois, mas de forma diferente: o conteúdo de `to="body"` sai como
`bodyPrepend` — **antes** do `#__nuxt` — no modo não-streaming e depois no streaming;
o de `#teleports` sai sempre dentro da `<div id="teleports">`, no fim do body, que é
o alvo documentado. O ambiente do `@nuxt/test-utils` cria essa `div` no happy-dom, e
é o que deixa o teleport real montar em teste.

**Os testes de campo passam por um stub.** O `find` do VTU só anda a árvore sob o
root do wrapper, então com o Teleport real todo `wrapper.findAll("li")` do
`Select.test.ts` — e todo `find(".RUtilsDropdown")` — voltava vazio, e os painéis das
instâncias anteriores se acumulavam no `#teleports` do mesmo arquivo.
`test/nuxt/setup.ts` (via `setupFiles` do projeto `nuxt`) põe
`config.global.stubs.teleport = true`, que renderiza o conteúdo no lugar; é o padrão
que a própria doc do VTU recomenda. Um caso só do `dropdownPopover.test.ts` desliga o
stub por mount (`global: { stubs: { teleport: false } }`) e asserta o painel em
`#teleports` e fora do `.RField`.

**O SSR é provado no e2e**, porque nenhum teste de componente o exercita:
`test/e2e/basic.test.ts` corta o HTML no `id="teleports"` e exige `RUtilsDropdown`
só depois do corte; `test/e2e/browser.test.ts` guarda o nó vindo do servidor num
`MutationObserver` de `addInitScript` (roda antes de qualquer script da página) e,
hidratado, exige que o nó em `#teleports` seja **o mesmo** — e um só. É a prova
possível num build de produção, onde o Vue não emite aviso de hydration mismatch.

Limites conhecidos, os mesmos de todo popover teleportado: o painel herda `color` e
`font-size` do `body`, não do container do form; um `<dialog>` nativo em top layer
continua por cima dele; Tab a partir do search do `RSelect` sai do fluxo da página
em vez de ir ao próximo campo; e um app que troque `app.teleportAttrs.id` no
`nuxt.config` perde o alvo.

### `v-mask` é nosso, não o `v-maska`

Os cinco componentes com máscara — `Text`, `Textarea`, `Date`, `Hour` e `Utils/Calendar` — usam `vMask` (`src/runtime/utils/vMask.ts`), não a diretiva do maska. Nenhum lugar do `src/` importa `maska/vue`. Motivo: `maska/vue` faz

```js
const a = e instanceof HTMLInputElement ? e : e.querySelector("input");
if (a == null || a?.type === "file") return;
```

— um `<textarea>` cai fora e nunca é bindado. O `MaskInput` do maska, porém, só usa `value`, `selectionStart`, `setSelectionRange`, `addEventListener` e `dispatchEvent`, que textarea tem; só o tipo `MaskaTarget` e esse guard excluem. `vMask` instancia `MaskInput` direto no elemento (input **ou** textarea), com WeakMap por elemento e `destroy()` no `unmounted`.

O cast `el as HTMLInputElement` na construção é deliberado — `MaskaTarget` é tipado só para input, o runtime é agnóstico.

**`v-mask` liga só no elemento onde está — não procura descendente.** O maska tem o fallback `querySelector("input")`, e ele é a causa de duas classes de bug: um wrapper (ou uma diretiva que o Vue repassa para a raiz de um componente) sequestra o campo que outro binding já possui, e `mounted`/`unmounted` resolvem nós diferentes, vazando listener. Resolver para `el` ou nada mantém todos os hooks falando do mesmo elemento a vida inteira do binding. Posto em elemento que não é campo, avisa no console em vez de falhar calado.

### Props genéricos booleanos: use `T & boolean`

Vue compila `defineProps<{ multiple?: Multiple }>()` (onde `Multiple extends boolean`) com `multiple: { type: null }` em runtime. Sem `type: Boolean`, `<RSelect multiple>` chega como `""` (string vazia, falsy). **Solução:** declarar como `multiple?: Multiple & boolean` — a interseção força o compilador SFC a emitir `type: Boolean` mantendo o generic para inferência de tipos do slot.

Confirmação: olhar o bundle servido pelo dev server (`curl /_nuxt/@fs/.../Select.vue | grep "multiple:"`).

### "Union type too complex" em useField

Generics com conditional types nas `Props` (ex.: `Multiple extends true ? T[] : T` no slot) cascateiam complexidade quando passados para `useField<T extends Element>`. **Solução:** declarar um tipo `InternalProps` simples (sem generics) e castear na chamada — `await useField(_props as unknown as InternalProps)`. Mantém o tipo público rico sem estourar o type-checker.

Quando o slot precisa expor um tipo conditional (`Multiple extends true ? Item[] : Item`), criar helpers em script (`fieldSlot()`, `rowSlot(option)`) que retornam `as Selected` — o template não suporta cast `as` direto em expressões.

### O generic do `RSelect` vai até o model

O campo é genérico sobre `options` desde sempre, mas por muito tempo **nada do que
saía dele usava esse generic**: `modelValue`, `default` e o payload de
`update:modelValue` eram `unknown`, e o `OptionItem` do slot declarava
`value: unknown` / `label: unknown` — só o `original` ficava certo. Quem consumia um
select tipado reconquistava na mão o tipo que o componente já tinha, com cast ou com
um `find` na própria lista de opções. Era a issue #4.

São **cinco** parâmetros hoje, e todos com default — é isso que mantém o modo schema
intacto, porque o `Components["Select"]` do `types/components` lê o `Props` **sem
argumento** e cai em `OptArrayObj`, `false`, `"id"`, `"name"`, `false`, exatamente a
forma anterior:

```ts
Props<Opts extends Options, Multiple = false, KeyValue = "id", KeyLabel = "name", ModelFull = false>
```

A derivação é uma cadeia de aliases pequenos, cada um com um trabalho só:

| alias | responde |
|---|---|
| `OptionOf<Opts>` | o item bruto — elemento do array, ou valor do objeto |
| `OriginalOf<Opts>` | o que o `original` guarda, e o que vai ao model com `modelFull` |
| `PropOf<U, K>` | `U[K]`, e o próprio `U` quando ele é primitivo |
| `KeyOf<Opts>` | a chave de um `options` em forma de objeto |
| `ValueOf` / `LabelOf` | o `value` e o `label` de uma opção |
| `SelectedOf` / `ModelOf` | a seleção, e ela embrulhada em lista pelo `multiple` |

**`PropOf` cai em `unknown` de propósito.** O `getProperty` faz `path.split(".")`, então
`:pick="{ value: 'user.id' }"` é caminho aninhado e **não** é `keyof` de nada — fechar as
duas chaves em `keyof` quebraria esse uso. Elas continuam aceitando qualquer string, e o
valor só estreita quando a chave é simples; no caminho pontilhado ele volta a ser
`unknown`, que é o que **todos** os casos eram antes.

**`KeyOf` só estreita a chave quando ela já é string.** Um `options` em forma de objeto
com chave numérica (`{ 1: "a" }`) sai `string`, porque quem monta o valor é o
`Object.entries`, e ele devolve a chave já convertida — estreitar para `1` seria
mentira. Não há `[keyof Opts] extends [string]` aqui: `keyof Opts` não é parâmetro de
tipo pelado, então não distribui, e o par de colchetes seria decoração (medido, as duas
formas dão o mesmo nos três casos).

**O `& string` em `pick.value`/`pick.label` é o mesmo remendo do `Multiple & boolean`.**
`OptionKey<Opts>` é conditional, e o `inferRuntimeType` do compiler-sfc devolve
`UNKNOWN` para conditional; numa interseção ele filtra o que não resolveu, então basta
**um** membro resolvível para o `type: String` voltar. Medido, comparando os props
compilados antes e depois: sem o `& string`, as duas chaves perdem o `type` — compila,
roda, e some a validação de prop do dev mode, calado. Com o `pick`, quem precisa de
`type: Object` é a prop de topo, e um `TSTypeLiteral` o compiler resolve sozinho; o
`& string` de dentro passou a servir só à inferência.

**E a interseção fica escrita por extenso na prop, nunca atrás de um alias de dois
parâmetros.** Um `OptionKey<Opts, K> = K & string & (…)` é a forma legível, e foi
medida: ela estoura `TS2590 "union type too complex"` em `Date`, `Hour`, `Number`,
`Pin`, `Text` e `Textarea` — em todo campo, não no Select, porque quem paga é o
`Element` que o `schema.d.ts` instancia. O custo da forma por extenso é uma tabela de
props do site mostrando `KeyValue & OptionKey<Opts> & string` em vez de `string`.

#### `pick` é uma prop só, e a inferência anda por propriedade

`keyValue`/`keyLabel` viraram `pick: { value, label }` — duas props de topo para
dizer uma coisa só, com o prefixo repetido em cada nome. Os parâmetros de tipo
`KeyValue`/`KeyLabel` **ficaram**, com os mesmos defaults `"id"`/`"name"`:
`ValueOf`, `LabelOf`, `SelectedOf` e `ModelOf` não mudaram uma linha.

O `merger` recursiona em objeto que não é array, então `:pick="{ value: 'codigo' }"`
conserva o `label: "name"` do default. A semântica de "sobrescrevo uma das duas"
sai de graça.

**O `prefixText` não alcança o `label` de dentro**, e isso é o que o teste passou a
provar: ele só prefixa `defaults.text` e as duas chaves de **topo**
`label`/`placeholder`, e `pick.label` não é chave de topo.

**Descer um nível não muda a inferência do literal**, e isso foi medido: o tipo
contextual de `'id'` continua sendo a mesma interseção, então `:pick="{ value: 'id' }"`
escrito **inline** infere `KeyValue = "id"` exatamente como o `key-value="id"` de antes.

O que muda é a vizinhança, e ela falha **alto**, não calada:

```ts
const chave = "id";                          // "id"     → infere, como sempre
const cfg = { value: "id", label: "name" };  // { value: string } → NÃO compila
const cfg = { value: "id" } as const;        // "id"     → infere
```

Propriedade de objeto alarga para `string`, e aí não há candidato de inferência:
`KeyValue` cai no **default** `"id"` e o objeto deixa de ser atribuível. A mensagem
reclama de `"id"` — o default, não a chave que o autor escreveu —, e é confusa; a
saída é `as const`, e está escrita nas duas páginas do Select.

**Não é regressão.** Medido nas duas assinaturas: uma string já alargada em
`key-value` errava do mesmo jeito e pelo mesmo motivo. O que `pick` acrescenta é o
caso do objeto inteiro alargado, que erra igual.

**O snake_case do schema sai de graça**: `pick` tem uma palavra só, então nem o
`rest` do `Dynamic.vue` nem o `SnakeAliases` do `Base<P, C>` têm o que fazer — e as
duas chaves de dentro não são chave de topo do `rest`, então a regra geral nunca as
vê. O exemplo do teste que **documenta** a regra trocou para `model_full`, que
continua sendo prop composta e real do mesmo campo.

O runtime é dinâmico e o tipo é o contrato, então há **um** ponto de cast, e é o
`toItem(value, label, original)` que monta cada opção. Fora dele o `_options` não
casteia nada.

A guarda é `test/fixtures/basic/components/SelectTypes.vue` — o `vue-tsc` da fixture é
quem a executa, do lugar de quem consome. Ela cobre os cinco formatos pelo lado
positivo (passando `selected.value` e o payload do evento a funções tipadas) e quatro
casos pelo negativo, com `<!-- @vue-expect-error -->` — o quarto é o `pick` numa
variável sem `as const`. Vale conferir que ela morde: contra o `Select.vue` anterior
são dez erros e duas diretivas ociosas.

#### A busca é opt-in, e o ref teve de mudar de nome

`search: false` mora no `defaults`, então o painel abre sem busca e `<RSelect
search>` a liga. No `defaults` e não fora dele como o `focusError` do `RForm`: a
regra "não apaga" do `merger` só morde quando o **resultado** já é truthy, e um
default falsy não é — as duas direções passam.

Ela ainda entra no `withDefaults` como `undefined`, junto do `disabled`: sem isso
o boolean casting faria a prop ausente chegar como `false`, e um
`defineFieldDefaults({ Select: { search: true } })` seria apagado por todo campo
que não escrevesse a prop.

**O limite é o outro sentido**, e é o mesmo do `upload`/`remove` do `RFile`: com o
app ligando a busca pelo `defineFieldDefaults`, `:search="false"` numa tag não a
desliga — o `true` é o resultado truthy que a regra protege. Desligar num campo só
exigiria ler o `_props` cru. `test/nuxt/selectSearch.test.ts` grava as duas
direções; o caso sem defaults do app fica no `Select.test.ts`, porque o `vi.mock`
é do arquivo inteiro.

**O termo digitado virou `term`, e não é gosto.** O vue-tsc intersecciona as props
com os bindings do `setup` para montar o contexto do template, então um
`const search = ref("")` ao lado de uma prop `search?: boolean` reduz o
componente inteiro a `never` — `string` e `boolean` são disjuntos. O erro não
aponta para o ref: sai como `Property 'props' does not exist on type 'never'` na
**linha 2 do template**, repetido por binding, com a explicação
`property 'search' has conflicting types in some constituents` no fim de uma
mensagem longa. Vale para qualquer campo: prop nova não pode ter o nome de um
binding do `<script setup>`.

#### `@search`: quem escuta assume o filtro

`onSearch?: (term: string) => void` é a prop-callback do padrão da casa (a mesma
forma do `onComplete` do `RPin`), e com ela o `filteredOptions` **desiste de
filtrar**: o campo passa a mostrar exatamente as `options` que recebeu.

Não é atalho de implementação, é o único comportamento correto. O servidor casa o
termo com o que ele quiser — telefone, documento, UF —, e um segundo filtro pelo
rótulo esconderia justamente a linha que ele acabou de casar. O modo de falha é
mudo e parece bug do back: a lista chega com 3 itens e a tela mostra 0.

Ele é lido de `_props`, e não de `props.value`: é um callback do call site, e não
há sentido em um `defineFieldDefaults` decidir quem responde à busca de um campo.
O debounce fica **fora** do módulo — quanto esperar depende da rota que responde.

**E ele liga o input de busca sozinho**: o `v-if` do painel lê `searchable`, que
é `props.search || Boolean(_props.onSearch)`. O termo só nasce naquele input, então
um `<RSelect @search>` sem `search` ao lado nunca dispararia nada — calado, que é a
classe de falha que este repo persegue. Não existe caso de quem escuta `@search` e
não quer a busca, então `search` vira redundante ao lado dele, e o demo do site o
omite de propósito. Fica num `computed` e não num `_props` solto no template, porque
nenhum campo lê `_props` fora do script — o `File` e o `Pin` fazem o mesmo.

**O que o `term` não faz é ser limpo.** Escolher ou fechar mantém o termo e a última
lista; reabrir mostra a resposta anterior sem disparar `@search` de novo. Decisão
explícita, e a mesma da busca local.

**O que não é do campo, no `@search`**: manter o selecionado dentro de `options`. O
rótulo sai do casamento com a lista, então uma busca que não devolva o item já
escolhido deixa o campo em branco com o model intacto. Quem tem os dados é quem
responde ao `@search`. **Isso vale só para o `@search`** — a rota de `options` em
função resolve o problema com um cache de rótulos, adiante.

#### `options` em função: o campo passa a ser dono do ciclo

`options: Opts | OptionsFn<Opts>`. Com uma função ali, quem busca é o app e o
módulo fica com o **ciclo** — debounce, número da página, fim da lista, erro com
retry, cache de rótulos. O estado mora em `useRemoteOptions`
(`composables/useRemoteOptions.ts`), no molde do `useUploadQueue`: opções entram
como **getters**, a mensagem entra como `fallback: () => tr(...)`, e a composable
fica sem tradução dentro — que é o que a mantém testável no projeto `unit`.

`Opts` continua sendo o tipo dos **dados**, nunca o da função: o TS o infere de
uma posição de retorno tão bem quanto de um valor, então `OriginalOf`/`ValueOf` e
o generic inteiro do `RSelect` não mudam uma linha. Medido com o
`vue-component-meta`, que é quem gera a tabela do site: `options` sai como
`Opts | OptionsFn<Opts>` e `modelValue` continua `ModelOf<…>`.

**`page` é 1-based e array vazio encerra.** Sem cursor. São cinco camadas contra
o loop infinito, e a terceira é a que ninguém lembra:

- (a) não reentra se já está carregando, e não tenta depois do fim;
- (b) array vazio encerra — é o contrato;
- (c) **página que não faz a lista crescer** (depois de deduplicar por `keyOf`)
  encerra, que é a guarda contra a fn que ignora `page` e devolve sempre o mesmo.
  Sem ela o sintoma é o navegador travando;
- (d) erro para a paginação até um `retry()` explícito — rearmar sozinho é uma
  tempestade contra um servidor que já está caindo;
- (e) `total` conhecido e alcançado encerra, sem a requisição vazia do fim.

**O envelope `{ items, total }` existe pelo rodapé.** O plano dizia "sem
envelope", e o array puro continua sendo o contrato; o que o envelope acrescenta
é o único dado que a paginação não sabe sozinha — quantos itens casam o termo —,
que é o que o total do rodapé mostra em vez da contagem do que já carregou. O
discriminador é a chave `items` guardando um objeto (`unwrap`): um `OptObj`
legítimo não tem essa forma. O último envelope manda (`total` pode só vir na
página 1, ou ser corrigido a cada resposta), e o `reset()` o esquece. O generic
`Opts` sai da posição de retorno nas duas formas — medido na fixture
`SelectTypes.vue`, com `buscar` e `buscarComTotal`.

A corrida é o mesmo discriminador do `useUploadQueue`: cada `load()` faz
`const mine = ++token` e, na volta, `if (mine !== token) return` **antes de tocar
em qualquer coisa**. O `reset()` também incrementa. `signal` entra no contexto
porque abortar a requisição obsoleta é mais barato que deixá-la correr para
descartar o resultado — mas o token existe de qualquer jeito, porque ele protege
a máquina de estado mesmo do app que ignora o signal.

**`debounce` tem a armadilha do `focusError`.** Com `defaults.debounce = 300`, um
`:debounce="0"` seria engolido: o `merger` pula quando o resultado é truthy e o
valor novo é falsy, e `0` é falsy. A saída é ler a prop crua na frente, como o
`RFile` faz com `upload`/`remove`. Ele **não** entra no `withDefaults`, porque
`debounce?: number` compila com `type: Number` e não há casting booleano a
desfazer.

**`options` função não liga a busca sozinha**, ao contrário do `@search`. A razão
é a assimetria: o termo só nasce no input, então um `<RSelect @search>` sem
`search` nunca dispararia nada — calado; já uma lista infinita **sem** termo é uso
legítimo, e ligar o campo de busca ali seria surpresa. O que ela faz é entrar no
`filteredOptions` como mais uma cláusula de desistência do filtro local, ao lado
do `onSearch` e pelo mesmo motivo.

#### O cache de rótulos, e as quatro fontes que o semeiam

```ts
const keyOf = (value: unknown) =>
    value !== null && typeof value === "object"
        ? `o:${JSON.stringify(value)}`
        : `${typeof value}:${String(value)}`;   // number:1 ≠ string:1
```

A chave não pode ser o objeto — o model guarda `42`, um primitivo, e em
`modelFull` guarda um objeto remontado a cada resposta —, então é uma string. É a
diferença para os dois caches do `RFile`, cujas chaves têm identidade estável
dentro da sessão (`WeakMap` no `previews`, o próprio item no `failures`).

A leitura de `selected` tem duas etapas: **`_options` (a página corrente,
transiente) responde primeiro; só o que ela não responde cai no cache.** Se o
cache absorvesse toda opção normalizada, cinquenta buscas seguidas acumulariam
cinquenta páginas de itens que ninguém mais vai ler.

| fonte | quando |
|---|---|
| `select(option)` | **antes** de escrever no model — é o que faz o rótulo sobreviver a digitar na busca, paginar e reabrir |
| a opção que está na página **e** no model | o form carregado do servidor, em que ninguém clicou e não há `resolve` |
| `resolve` | só para valor que nem `_options` nem o cache respondem |
| `modelFull` | não usa cache nem `resolve`: o model **é** o objeto, e o rótulo sai por `getProperty(value, pick.label)` |

**A segunda fonte não estava no plano, e a falta dela foi medida montando o
campo.** Sem ela, um form vindo do servidor (model preenchido, ninguém clicou,
sem `resolve`) perdia o rótulo no instante em que a busca trocava a página — que
é exatamente a falha que o cache existe para consertar. Ela **não** afrouxa o
limite: só o que o model aponta entra, então o tamanho continua sendo o número de
seleções, não o da lista.

Fallback para valor sem rótulo: em modo remoto mostra o valor cru (`42`) e o
`resolve` o troca um tique depois — sem isso há um piscar de vazio. Em modo
**estático** continua `undefined`, isto é, o placeholder de hoje: mudar isso seria
alteração semântica calada no caminho que 100% dos usuários atuais usam.

`resolve` roda no `onMounted` (client-only) e quando o model muda por fora; uma
vez por chave, e a chave entra no `Set` de tentadas **mesmo quando não resolveu**,
senão cada re-render dispara de novo. O retorno alimenta **só** o cache, nunca a
lista — um item resolvido no painel seria duplicata. Ele é client-only por
`onMounted` e não por `useAsyncData`: a alternativa quebraria a regra estrutural
de que nada em `src/` importa `#app`, e quebraria o campo montado fora de app
Nuxt, que é o projeto `unit`.

#### A carga em voo **não** entra no `pendingList`

Três razões, em ordem de peso: (a) o `pendingList` protege a integridade do model
no submit — o `RFile` registra porque o `Uploaded` ainda não existe, enquanto aqui
o valor está no model desde o clique e o que está em voo é **rótulo**, que é
aparência; (b) registrar faria o `RForm` esperar uma requisição de *paginação*
disparada por scroll, e servidor lento viraria submit travado sem ganho de
correção; (c) ninguém lê o rótulo — a `validation` recebe `{ value, form }`, o
`rulesList` valida `model.value`, o `errorsBag` casa por `id`.

Pela mesma divisa, **falha ao carregar não vira o `error` do campo**: o
`errorsBag` é o único escritor daquele slot. O erro mora no rodapé quando há
linhas, e no lugar da lista quando não há. Mesma decisão que o `RFile` já tomou.

#### O painel deixou de ser o scroller

```
popover                            ← [--max-height:25rem] flex flex-col overflow-hidden
  ui.list.container                ← a coluna: flex min-h-0 flex-1 flex-col
    ui.list.search.container       ← shrink-0; deixou de ser sticky
    [role=listbox] ui.list.scroller ← min-h-0 flex-1 overflow-auto overscroll-contain
      …o topo + a página | <VirtualRows>
      ui.list.sentinel             ← 1px, último filho; só enquanto há página seguinte
    ui.list.state                  ← carregando / vazio / erro sem página — abaixo do scroller
    ui.list.footer.container       ← shrink-0
      ui.list.footer.status        ← <Transition>: página seguinte em voo, erro com retry
      ui.list.footer.bar           ← o total de linhas e o limpar
```

Os estados moram **abaixo** do scroller, e não no lugar dele: com o escolhido no
topo da lista, "carregando" e "nada encontrado" são afirmações sobre a página, e
o que está escolhido continua na tela enquanto elas aparecem.

`overflow-auto` → `overflow-hidden` no `popover` porque o arredondamento ainda
precisa cortar o conteúdo. `max-h-full` no filho **não** funciona (resolve contra
`height: auto` → `none`); a forma que funciona sem cravar `height` é o painel
virar flex container. O `min-h-0` não é decoração: `min-height: auto` é o default
de um flex item, e sem zerá-lo o bloco das linhas se recusa a encolher e estoura o
painel em vez de rolar.

**Nada mudou em `dropdownMiddleware.ts`** — o `apply` não escreve dimensão
nenhuma, só `--width` e `--available-height`, e quem compõe a altura é o default
do próprio Dropdown. O piso de 160px continua destravando o `flip()`.

O `overscroll-contain` fecha o gesto: o Dropdown já trava o scroll do body
enquanto aberto, então uma roda que chega ao fim da lista não tem para onde vazar.

**O `divide-y` saiu** e virou `border-t border-(--rf-color-border)` na própria
linha, com `option.first` zerando no índice 0 — nos **dois** modos, para trocar de
estratégia não mudar a aparência. O motivo é a virtualização: o `divide-y` casa
com filhos absolutos e a borda pinta, mas a janela começando no item 40 faz dele o
primeiro filho, sem borda; um pixel de scroll e ele ganha uma. Borda que aparece e
some. O token é obrigatório — o `BANNED` de `theme.test.ts` proíbe `border` sobre
`contrast`, `background*` e `current`.

Duas quebras assumidas, sem teste que as pegue: `ui.list.container` mudou de papel
(era o `<ul>`, virou a coluna) e o `divide-y` sumiu. `ui.list.footer` virou grupo
(`container`/`status`/`bar`/`count`/`clear`/`transition`) e `ui.list.pinned`
deixou de existir, os dois ainda dentro deste branch.

#### A próxima página é `IntersectionObserver`, não listener de scroll

Sentinela de 1px, último filho do scroller nos dois modos, com
`{ root: scrollerEl, rootMargin: "200px 0px" }`.

**O `root` no scroller é o que torna a coluna flex requisito e não preferência**, e
o teleporte deixa isso mais óbvio: o painel mora em `#teleports`,
`position: fixed`, fora da `.RField` — com `root: null` o observer mede contra a
viewport do documento e um painel cheio de itens nunca reporta interseção.

A sentinela só existe enquanto **há página seguinte a pedir** (`hasMore`:
`remote.page > 0`, não exausto, sem erro), então armar o observer pela **ref
dela** é o que garante que a página 1 nunca dependa dele — o observer só reporta
*mudança* de interseção. Por isso a composable expõe `page` como ref: com o
escolhido no topo, o scroller já existe antes de a página 1 chegar, e uma
sentinela ligada à existência do scroller seria observada cedo demais — visível,
sem mudar, e a página 2 nunca viria. Trocar o termo zera tudo e dispara a página
1 direto, pelo mesmo motivo. Fechar o painel **não** reseta: reabrir não custa
requisição.

**Depois de uma página assentar, a sentinela é reobservada** (`unobserve` +
`observe`, num `watch(_options)` de `flush: "post"`). Uma página menor que o
painel deixa a sentinela visível, e o observer não reporta o que não mudou;
reobservar refaz a leitura inicial. O `next()` que sobrar bate na guarda (a) da
composable.

`typeof IntersectionObserver === "undefined"` (SSR, happy-dom) → sem paginação por
scroll, mas a página 1 continua carregando pelo caminho direto. Mesma disciplina
do `isFile` com `typeof File !== "undefined"`.

**SSR:** o conteúdo do painel não existe no server (`everOpened` começa `false`),
então lista, observer e `VirtualRows` nunca são criados lá, e um `RSelect` remoto
**não faz requisição na renderização do servidor**.

#### O escolhido no topo é estado, recomposto em dois momentos

O que está no model vem como as primeiras linhas do **próprio scroller**, e a
página vem abaixo, sem o que o topo já mostra (por `keyOf`). É o `lifted` do
`Select.vue`: um `shallowRef` com as **entradas do model**, resolvidas pelo
mesmo `itemFor` do campo — o rótulo chega com o cache, e o `resolve` que volta
um tique depois troca o valor cru sem nada ali saber.

**Isso já foi uma seção fixa fora do scroller**, com `role="group"`, `max-h`
própria e a segunda barra de rolagem — computada do `selected`, sem estado. Saiu
por ser problema visual, e a troca de lugar mudou a natureza: no scroller, uma
linha que sobe e desce a cada clique é jitter sob o cursor. Daí ser **estado**, e
a regra ser "nada muda de lugar enquanto o painel está aberto". A lista só é
recomposta em dois momentos:

- **no `open`**: `lifted = modelValues` — é a única hora em que uma linha muda de
  lugar, e o painel estava fechado;
- **quando uma página assenta** sem trazer algo que está no model: o que falta é
  **acrescentado** ao topo. Não roda com a página 1 em voo (`status === "loading"`)
  — ali a lista está vazia por definição, e tudo subiria antes de a resposta
  dizer o que trouxe. Erro não muda `items`, então não dispara.

Consequências, todas medidas em `test/nuxt/selectRemote.test.ts`: marcar um item
no meio da lista não o move; desmarcar um do topo não o derruba (fica lá, com
`aria-selected="false"`); a busca que volta a trazê-lo não o duplica; fechar e
reabrir é o que reorganiza.

**Só em modo remoto.** Com `options` estática o escolhido já está na lista e sempre
esteve; subi-lo reordenaria a lista de 100% dos usuários de hoje, calado. Mesma
regra do `resolve`, e pelo mesmo motivo.

**A fronteira é uma entrada da lista, não um nó antes dela.** Quem marca onde o
topo acaba é uma linha própria (`ui.list.divider`, `role="presentation"`), que o
`entries` insere entre os dois blocos. **Entrada**, e não um `<div>` posto antes
do `<VirtualRows>`: o virtualizer mede a partir do topo do scroller, então um nó
a mais ali empurraria toda linha sem ele saber, e a correção seria um
`scrollMargin` que o `VirtualRows` não expõe. Como entrada ela é medida junto com
as outras, e os dois modos de render ficam idênticos — o guarda disso é a altura
total da janela em `selectRemote.test.ts`, que conta 151 com a marca e 150 sem.

Ela existe só quando há os dois lados: sem topo ou sem página o `entries` é um
bloco só, e ninguém fica com um traço pendurado. E o `first` — o `border-t-0` de
quem abre um bloco — viaja **na entrada**, não num `index === 0`: a linha logo
abaixo da marca é uma dessas, senão o traço de 1px dela encostaria no tracejado.

Vazia por default, com o slot `divider` (`{ count }`, quantas linhas vieram do
model) para o texto que cada app escreve — não há chave de tradução a inventar
para uma palavra que ninguém escreve igual. A cor é o `--rf-color-border` de
sempre e o peso vem da espessura: um `--rf-color-primary` ali encostaria no fundo
sólido da linha escolhida logo acima, que é justo o que ela precisa separar.

A linha é **a mesma linha**: mesmo `ui.list.option.*`, mesmo slot `default` com
`list: true`, mesmo `select(option)`. Não há terceiro valor de `list` a inventar.
Em remoto, "vazio" passou a ser o `status === "empty"` da composable, e não
`rows.length === 0`: com tudo o que a página trouxe já no topo, a lista de baixo
fica vazia sem nada ter faltado.

#### O rodapé e o X: dois lugares, um `clear`

Todo painel termina em `ui.list.footer`: a faixa de estado (`status`, dentro de
um `<Transition>` com `v-bind="ui.list.footer.transition"`, no molde do
`RUtilsLoading`) e a barra com o total de linhas (`rows.length` — em remoto, o
que já carregou) e o botão que esvazia a seleção. O mesmo `clear` é o X do campo,
um `<button>` antes do chevron com `@click.stop` (senão o clique abre o painel),
`v-if="hasSelection && !props.disabled"`.

`clear` escreve `[]` em `multiple` e `null` no resto — **nunca o `default`**, que
é o que um X não quer de volta. O slot `footer` substitui o rodapé inteiro e
recebe `{ status?, retry, count, clear }`.

O plural do total é o `{n} item | {n} itens` do pack, pelo `withParams` — que
saiu do `File.vue` para `#rform/utils` por ter ganhado o segundo call site.

#### `components/internal/` é uma terceira categoria

`VirtualRows.vue` não é campo nem util: não passa por `useField`/`useUtil`, não
tem `defaults`, não é registrado pelo `addComponentsDir`. O `RSelect` o carrega
por `defineAsyncComponent`, e isso é **obrigação, não estilo** — o `useVirtualizer`
é composable, registra `watch`/`onMounted` e precisa da instância corrente, que
não sobrevive a um `await import()` no meio do setup. É o mesmo modo de falha que
o `useUtil` já documenta. O `defineAsyncComponent` é a fronteira de *setup* que o
composable exige e a fronteira de *chunk* que o bundle exige, de uma vez; o
`@tanstack/vue-virtual` é importado **estaticamente** lá dentro, então viaja no
chunk assíncrono, uma vez.

Medido no `dev:build`: `VirtualRows.vue` sai com `isDynamicEntry: true` e
`measureElement` não aparece no chunk de entrada.

**Consequência que não pode ser esquecida:** `test/unit/theme.test.ts` varre raízes
**planas e não recursivas** — `components/internal` teve de entrar na lista, senão
o arquivo novo, que é justamente o que carrega as classes de layout mais frágeis,
ficaria sem guarda nenhuma.

`VIRTUAL_THRESHOLD = 100` e `overscan: 8` são constantes: quantas linhas o DOM
aguenta não é conhecimento do app. `rowHeight` vira `defaults` (48), derivado do
`ui.list.option.container` e por isso morando ao lado dele; ele só governa a barra
antes da primeira medição, e o `measureElement` remede de verdade — as linhas têm
slot livre, então altura fixa está errada por construção.

A troca é **monotônica dentro de uma abertura**: uma vez virtualizada a lista
continua assim até fechar, porque alternar a estratégia a cada tecla é jitter de
scroll e de foco.

O `VirtualRows` é **genérico sobre o item** e resolve o índice num `computed`, e
as duas coisas existem pelo mesmo motivo: sem elas o `RSelect` precisaria de um
`as Item` no `<template>`, que é o que a convenção da casa proíbe.

`@tanstack/vue-virtual` está em `dependencies`, e é o precedente do `@nuxt/icon`:
o caminho comum não pode exigir instalação manual. O import dinâmico corta o
**bundle**, não o `node_modules`.

#### O gatilho ganhou `role="combobox"`

`role="combobox" aria-haspopup="listbox" :aria-expanded="open"` no wrapper da
referência, e `<li>` virou `<div role="option">` — no modo virtualizado a linha
mora dentro do bloco de altura `totalSize`, e `div` filho de `ul` é HTML
inválido; assim os dois modos têm estrutura idêntica.

Por tabela, o helper `open()` dos testes deixou de ser `wrapper.findAll("div")[1]`,
que dependia do índice no DOM, e virou
`wrapper.get('[aria-haspopup="listbox"]')`. Acessibilidade de graça, seletor
estável.

### `addComponentsDir` não aninha

O scanner do Nuxt guarda cada diretório já varrido e pula todo arquivo sob ele (`if (scannedPaths.some(d => filePath.startsWith(d))) continue`). Registrar `components/` deixaria `components/fields` e `components/utils` **vazios**, sem erro nenhum — some a tag, não o build. Por isso `Form` e `Dynamic` entram por `addComponent`, um a um, e só `fields/` e `utils/` (mais as duas raízes do usuário, com `priority: 10`) entram como diretório.

`addComponent` também **não normaliza** o `filePath`, ao contrário do `addComponentsDir`. Com `\` do Windows o caminho vira import com escapes (`"C:UsersyandProjetos…"`) e o teste falha na coleta, não na asserção. `filePath()` no `module.ts` já devolve com `/`.

### O vite plugin roda antes do `@vitejs/plugin-vue`

Com `enforce: "pre"` o plugin vê o SFC cru; sem ele, o id `.vue` já foi compilado para um `import` de `?vue&type=script&setup=true`, a chamada da composable está nesse sub-request, e reescrever o que sobrou não muda nada. Rodando depois, a injeção de nome **não funcionava em build de produção** — e ninguém via, porque o fallback `"Text"`/`"Label"` cobria calado.

A consequência é que a regex passa a ver TypeScript cru: `useUtil<Props>()`, com o genérico entre o nome e o `(`. As regexes aceitam e **preservam** a lista de tipos.

**Quantos argumentos a chamada tem é contado por `countArgs`, não por lookahead.** O que decide entre injetar o nome como segundo ou terceiro parâmetro é a contagem de vírgulas, e a versão antiga contava *toda* vírgula — inclusive a de dentro de um `//` no corpo de um `opts`. Escrever um comentário com vírgula dentro do `useField(...)` fazia a contagem estourar o `switch`, o nome não era injetado, e o campo morria com o `throw` do `useField`. Hoje a contagem é de vírgulas em profundidade 0, com comentário de linha e de bloco removidos antes. O `ARGS` continua tolerando **um** nível de parênteses aninhado — é por isso que o `opts` do `File.vue`, como o do `Number.vue`, é escrito em forma de método e sem arrow aninhada.

### As classes-gancho (`RField` / `RUtil`) entram pelo `ui`

Todo campo e todo util — embutido **e** do usuário — carrega duas classes na raiz:

| raiz | genérica | específica |
|---|---|---|
| `fields/`, `app/rform/fields` | `RField` | `R<Nome>` — `RField RText` |
| `utils/`, `app/rform/utils` | `RUtil` | `RUtils<Nome>` — `RUtil RUtilsPlaceholder` |

A específica espelha a tag que o app escreve (`<RText>` → `.RText`), porque os prefixos são os mesmos que o `addComponentsDir` registra. É isso que dá ao `style.css` um alvo, sem que campo nenhum precise repetir a classe e **sem depender de `RForm` no ancestral**.

Quem escreve é `hookUi` (`src/runtime/utils/hookUi.ts`), chamado por `useField` e por `useUtil` **depois** do `merger`, sobre a **entrada mais alta** do `ui`: `container` num campo, `default` no `Placeholder`, o próprio `ui` onde ele é string. Não é o primeiro par qualquer — é a primeira entrada que guarda classes em vez de um grupo aninhado, porque o `RUtilsLoading` abre num `<Transition>` cujo `ui.transition` são nomes de transição, não classe. Componente sem nenhuma entrada de classe (`RUtilsDropdown` é `<slot>` + `<Transition>`) fica sem gancho, e não tem reset a perder.

**Depois do merge, e não dentro do `defaults`.** `ui` é sobrescrevível por contrato e o `mergerUI` lê `null` como "zera esta chave": um gancho declarado nos defaults iria embora junto com um `ui: { container: null }`, e um `container` apenas reescrito ficaria à mercê do que o `twMerge` decide descartar num namespace que não é do Tailwind — medido, `{container:"RField flex grow"} + {container:"RFieldset grid"}` dá `"RField grow RFieldset grid"`. Prependendo depois, nenhum dos dois toca no gancho. Ordem de chave sobrevive ao merge: o `merger` semeia o resultado a partir do `defaults` do componente e o `mergerUI` copia com spread.

O par nome→classe é **gerado**, em `#rform/registry` (`hooks.fields` / `hooks.utils`), ao lado do registry de módulos — é ali que o `module.ts` ainda distingue as três listas. Containers ficam de fora, então `Form` (que escreve o próprio `RForm`) e `Dynamic` não recebem gancho **sem** a composable precisar de uma lista de exclusão.

**Isso já morou no `src/vite.plugin.ts`**, que parseava o SFC com `vue/compiler-sfc` e injetava um `class` estático na raiz do `<template>`. Funcionava, inclusive com `ui.container` zerado — o Vue compila o `class` estático e o `:class` como canais independentes de um `normalizeClass`. Mas custava um parse de SFC por arquivo e punha um `import` de `vue/compiler-sfc` no bundle rollup do `dist/module.mjs`: import fora de `dependencies`/`peerDependencies` vira "Potential implicit dependencies", e com o `failOnWarn` do `@nuxt/module-builder` isso é **exit 1 no `prepack`** — resolvível só com um `build.config.ts` declarando `externals`. O plugin voltou a fazer só a injeção de nome, e o `build.config.ts` deixou de existir.

`test/unit/hookUi.test.ts` cobre a função pura (o `container: null`, o `ui` só de grupos, o não-mutar o objeto recebido) e `test/nuxt/hookClasses.test.ts` monta os componentes: campo embutido, util, campo do usuário, `ui.container` zerado e reescrito, campo sem `RForm` em volta, e o `Form` que continua sem `RField`.
### Um app consumidor precisa do próprio `tsconfig.json`

`ts.findConfigFile` sobe a partir do arquivo. Um app Nuxt sem tsconfig na raiz acaba achando o tsconfig de um projeto acima — e o `@vue/compiler-sfc` resolve `#rform/types/...` contra os tipos gerados **daquele** projeto. O sintoma é mudo e específico: as props que um util contribui simplesmente não são declaradas, e `<RRating hint="…">` cai como atributo de fallthrough em vez de prop, sem erro de compilação. Foi por isso que `test/fixtures/basic/tsconfig.json` teve que existir.

### vue-tsc precisa de `.nuxt`

`tsconfig.json` só referencia `.nuxt/tsconfig.*.json`. Sem rodar `nuxi prepare` (ou o `dev`) primeiro, `vue-tsc -p .nuxt/tsconfig.app.json --noEmit` falha.

**Um `generate` ou `build` também desfaz isso**, e o sintoma engana: o `.nuxt` fica sem as declarações de auto-import, e o check despeja `Cannot find name 'useI18n'`, `'useRForm'`, `'useDocsNav'` — 24 erros que parecem código quebrado e são estado do diretório. `nuxi prepare` no app resolve.

São **sete** apps Nuxt, cada um com o próprio `.nuxt` e o próprio `#rform` — checar um não cobre o outro, e é por isso que o `test:types` roda os sete. O oitavo alvo não é um app: é o **server** do docs, onde moram as ferramentas MCP, que nenhum `tsconfig.app.json` inclui:

```
vue-tsc -p tsconfig.check.json                        # o módulo
vue-tsc -p docs/.nuxt/tsconfig.app.json               # o site
vue-tsc -p docs/.nuxt/tsconfig.server.json            # o server/ do site (MCP)
vue-tsc -p playgrounds/i18n/.nuxt/tsconfig.app.json
vue-tsc -p playgrounds/basic/.nuxt/tsconfig.app.json
vue-tsc -p playgrounds/standalone/.nuxt/tsconfig.app.json
vue-tsc -p playgrounds/ui/.nuxt/tsconfig.app.json
vue-tsc -p test/fixtures/basic/.nuxt/tsconfig.app.json # a fixture (campos/utils de usuário)
```

## Convenções de código (oxfmt.config.ts)

- 4 espaços, aspas duplas, semicolons, `trailingComma: "none"`, `singleAttributePerLine: true`, `vueIndentScriptAndStyle: true`.
- Sem `insertFinalNewline`.

### Callback é `@evento`, nunca `:on-*`

`RForm` e `RPin` declaram `onSubmit` e `onComplete` como **prop**, e o Vue casa
`@submit` / `@complete` com a prop declarada de mesmo nome. As duas formas
funcionam; só uma se escreve:

```vue
<RForm @submit="enviar">      <!-- sim -->
<RForm :on-submit="enviar">   <!-- não -->
```

Vale em todo lugar que o usuário lê ou copia — demo, página do site, playground —
e é o que faz o componente parecer com o resto do Vue que ele já escreve.

### Tipagem não entra no template

Nenhum `as`, nenhum `satisfies`, nenhuma anotação em escopo de slot dentro de um
`<template>`. Quando o markup precisa de um valor estreitado, quem estreita é um
`computed` — ou uma função, quando o valor vem do escopo de um slot:

```vue
<!-- não -->
<LazyRDynamic :schema="props.schema as Schema" />
<RArray :rule="rule as Rule<'array'>" />

<!-- sim -->
<LazyRDynamic v-if="schema" :schema />
<RArray :rule="arrayRule(rule)" />
```

Três razões, e a terceira é a que mais dói: o cast some do olhar de quem lê o
markup, que é onde se procura o que um componente recebe; ele fica num lugar que o
`vue-tsc` checa e nenhuma busca por tipo encontra; e num demo do site ele vira
exemplo — o leitor copia o cast junto.

A anotação de escopo de slot é o caso menos óbvio e cai na mesma regra:
`#[slotName]="scope: SlotScope"` vira `#[slotName]="scope"`, porque o
`defineSlots<Record<string, (scope: SlotScope) => unknown>>()` do `RDynamic` já
tipa o escopo do outro lado — a anotação era eco, não informação.

Quem guarda é `test/unit/templates.test.ts`, sobre os 202 `.vue` do módulo, do
site, dos quatro playgrounds e da fixture.

## Publicação

O publish **não acontece na sua máquina**. `pnpm run release` encadeia `lint → test → prepack → changelogen --release → git push --follow-tags`, e para aí: quem publica é o `.github/workflows/release.yml`, disparado pela tag que o changelogen acabou de empurrar.

**O motivo é o 2FA.** A conta está em `auth-and-writes`, o modo estrito: todo write pede um OTP — e num terminal não-interativo o pnpm morre com `ERR_PNPM_OTP_NON_INTERACTIVE` depois de já ter construído o tarball inteiro. Vale **também no CI**: rodar de dentro de uma action não muda nada, e um token granular sem *Bypass two-factor authentication* marcado bate na mesma parede.

**Quem autentica hoje é o OIDC**, pelo *trusted publishing* do npm — não há token nenhum, nem no npm nem nos secrets do repo. O pnpm pede um id token ao GitHub com audience `npm:registry.npmjs.org` e o npm o troca pelo direito de publicar, conferindo repositório e nome do workflow contra o trusted publisher configurado nas settings **do pacote**. Daí o `id-token: write` no `permissions`: sem ele o pnpm avisa `Skipped OIDC: ERR_PNPM_ID_TOKEN_GITHUB_WORKFLOW_INCORRECT_PERMISSIONS` e cai no token que não existe mais.

Isso **não serve para o primeiro publish** de um nome novo: o trusted publisher se configura no pacote, que ainda não existe. A `0.1.0` saiu por token granular com o bypass marcado; da `0.1.1` em diante é OIDC.

**Como testar a configuração sem gastar uma versão:** dispare o workflow por `workflow_dispatch` com a versão ainda publicada. O npm recusa a versão duplicada, mas **só depois de autenticar** — então o erro responde a pergunta. `[E403] You cannot publish over the previously published versions` quer dizer que a credencial passou; `E401`, `ENEEDAUTH` ou o `ERR_PNPM_OTP_NON_INTERACTIVE` querem dizer que não. Nada é publicado nos dois casos.

No workflow, `--no-git-checks` é **obrigatório**: numa tag o checkout é detached, e o `publishBranch: develop` reprovaria. O `prepack` não aparece na lista de passos porque roda sozinho, pelo lifecycle do `pnpm publish`.

Três coisas nessa cadeia mordem, e nenhuma é óbvia.

### O `changelogen` **rebaixa** o bump enquanto a versão for `0.x`

Está no `bumpVersion` dele, e vale inclusive quando o tipo é passado na mão:

```js
if (currentVersion.startsWith("0.")) {
    if (type === "major") { type = "minor"; }
    else if (type === "minor") { type = "patch"; }
}
```

Ou seja, a partir de `0.0.0`: `--release` (que deduz `minor` dos `feat`) e `--release --minor` dão os dois **`0.0.1`**. Para sair em `0.1.0` é `--release --major`.

Depois de `0.1.0` a política de fato passa a ser a normal de pré-1.0, e é a que se quer: `feat` sobe patch, breaking change sobe minor. Só o primeiro release precisa do `--major` escrito.

Os commits deste repo levam gitmoji antes do tipo (`:sparkles: feat: …`) e o changelogen **os parseia certo** — conferido, os `feat` caem em *🚀 Enhancements*. Não há nada a ajustar aí.

### `typeCheck` do oxlint fica desligado, e é o que deixa o `lint` passar

`options.typeCheck` é experimental e despeja os diagnósticos crus do tsc. O tsgolint não tem o plugin do Vue, então **todo import de `.vue` volta como `TS2307: Cannot find module`** — 6 numa árvore limpa, e `pnpm run lint` saindo com 1. Como a primeira coisa que o `release` faz é `pnpm run lint`, a cadeia inteira abortava antes de começar.

Quem manda em tipo aqui é o `test:types`, que roda vue-tsc nos oito alvos e enxerga `.vue`. O `typeAware` continua ligado: as regras que ele habilita não passam por resolução de módulo.

### O `pnpm publish` checa a branch

Ver "`pnpm publish` checa o git", adiante. O `publishBranch: develop` no `pnpm-workspace.yaml` é o que resolve — o default é `main`/`master`, e este repo desenvolve em `develop`.

### O que vai no tarball

`files: ["dist"]`, mais o `README.md`, o `LICENSE` e o `package.json`, que o npm inclui sempre. Medido: 190 arquivos, 71 kB comprimidos, 310 kB descompactados — com o `dist/runtime/style.css` (que o `exports` publica como `nuxt-rform/style.css`) e o `dist/module.json`.

**Cuidado ao conferir depois de um `prepack`:** ele substitui o stub do `dist` pelo build de verdade, e aí os playgrounds param de refletir o `src/`. `pnpm exec nuxt-module-build build --stub` devolve o symlink.

## Comandos úteis

O gerenciador de pacotes é o **pnpm** (`pnpm-lock.yaml`, só na raiz). O runtime continua sendo o Node — `pnpm run` só orquestra; vitest, vue-tsc, nuxi e unbuild rodam em Node como sempre.

- `pnpm install` — instala **os seis** projetos de uma vez (ver workspace abaixo).
- `pnpm run docs` — sobe o site de documentação na porta 3000. O `run` **não é
  opcional**: `docs` é comando embutido do pnpm (abre a home de um pacote), então
  `pnpm docs` morre com `ERR_PNPM_MISSING_PACKAGE_NAME` sem nunca olhar os scripts.
- `pnpm play` / `play:basic` / `play:standalone` / `play:ui` — os quatro playgrounds, nas portas 3030 a 3033.
- `pnpm exec oxlint <arquivo>` — lint (config em `oxlint.config.ts`, plugin tailwind ativo).
- `pnpm test:types` — type-check dos sete apps mais o `server/` do docs (precisa dos sete `.nuxt` populados).
- A tabela de props e o `mcp.json` são regerados por `pnpm exec nuxi prepare docs`
  (ou por qualquer `dev`/`build`), pelos módulos de `docs/modules/`.
- `pnpm exec nuxi prepare test/fixtures/basic` — regenera os tipos da fixture depois de mexer no `module.ts` ou em `test/fixtures/basic/rform/`.

### O `pnpm-workspace.yaml` não é opcional

No pnpm 11 o campo `pnpm` do `package.json` **não é mais lido** (ele avisa e ignora), e `pnpm-workspace.yaml` é a casa de toda configuração. Só que criar esse arquivo torna o repo um workspace root — e aí `pnpm install` dentro de um subprojeto para de instalá-lo: ele resolve para a raiz e responde "Already up to date" sem criar o `node_modules` de lá, em 30ms e com exit 0. **Falha em silêncio.**

Por isso `docs` e `playgrounds/*` estão em `packages:`. Um `pnpm install` na raiz cobre os seis projetos, há um lockfile só, e o `postinstall` (`nuxi prepare`) de cada um roda junto.

`allowBuilds` no mesmo arquivo é o outro requisito, e a entrada é **obrigatória mesmo dizendo `false`**: o pnpm bloqueia build script de dependência por padrão e, num install do zero, **sai com código 1** (`ERR_PNPM_IGNORED_BUILDS`) até haver uma decisão explícita — apagar a entrada faz ele reescrever o arquivo com `esbuild: set this to true or false`. (Com `node_modules` já populado ele nem checa, então o erro só aparece em clone novo ou CI.) Escrever `onlyBuiltDependencies` não resolve no 11.

São três entradas hoje: `esbuild: false`, `better-sqlite3: true` — esta porque o `@nuxt/content` do `docs` precisa do binding nativo, e sem ela o site não sobe nem gera — e `core-js-pure: false`, que chega pelo `agents` (a dependência que o `@nuxtjs/mcp-toolkit` exige no preset da Cloudflare) e cujo postinstall é só o banner de financiamento.

`esbuild` está `false`: o binário chega pronto pelo optional dep de plataforma (`@esbuild/win32-x64` e irmãos, que estão no lockfile), e o postinstall dele não faz falta. Medido com `node_modules` apagado: install exit 0, suíte 29/297, e o `nuxi build` de um playground completo (client + SSR + Nitro).

### As três deps que o pnpm revelou

`@vitejs/plugin-vue` (no `vitest.config.ts`), `vue` e `vite` (em `src/`) eram importados **sem estar no `package.json`**. npm e bun achavam por hoisting acidental; o layout estrito do pnpm não acha. Sim, o Nuxt traz os três — mas traz para *dentro* de `.pnpm/nuxt@…/node_modules`, e nada disso é alcançável da raiz do repo.

Removê-los para conferir dá o tamanho do estrago: 3 arquivos de teste caem com `Cannot find package 'vue' imported from src/runtime/components/utils/Calendar.vue` (254 testes em vez de 297) e o `vue-tsc` despeja ~60 erros `Cannot find module 'vue'`/`'vite'`. Estão em `devDependencies`, não em `peerDependencies`, porque quem consome o módulo recebe tudo via Nuxt e mexer ali mudaria o contrato do pacote publicado.

Isso era bug latente, não invenção do pnpm: um `npm ci` com hoisting diferente quebraria igual.

**`nitropack` não entra na lista.** Ele aparece se você fizer `grep nitropack src/ test/`, mas todas as ocorrências estão em `.nuxt` **gerado** da fixture — o `src/` não importa nitropack em lugar nenhum, e os tsconfig gerados já mapeiam o caminho em `paths`. Grep para achar phantom dep precisa excluir `.nuxt/`, senão você declara dependência que ninguém usa.

### O `@nuxt/icon` é `dependencies`, e tem de ser

Ele está no `moduleDependencies` do `defineNuxtModule`, então o Nuxt o **instala** —
e resolve o pacote a partir do `nuxt-rform`. Como devDependency isso morria no
`installModules`, antes do `setup`, com `Could not resolve @nuxt/icon (specified as a
dependency of nuxt-rform)`: o app não subia nem em `prepare`.

Não aparecia no repo pelo motivo de sempre — aqui o `@nuxt/icon` está instalado como
devDep, e os playgrounds carregam o módulo por caminho relativo. Terceiro defeito da
issue #1, e o primeiro na ordem em que mordia.

### `pnpm publish` checa o git

Publica no npm normalmente (`📦 rform@0.0.0 → https://registry.npmjs.org/`), mas antes roda checagens que npm e bun não têm: **árvore limpa** (`ERR_PNPM_GIT_UNCLEAN`) e **branch** (default `main`/`master` — este repo desenvolve em `develop`). Na cadeia do `release` o `changelogen --release` commita e taggeia antes, então a árvore chega limpa; a branch é que pode barrar. `--no-git-checks` desliga, ou `publishBranch` no `pnpm-workspace.yaml` ajusta.

O `prepack` roda **duas vezes** no `release`: uma explícita na cadeia, outra pelo lifecycle do `pnpm publish`. É desperdício de segundos, não erro — e o segundo serve de guarda de que o `dist` bate com o fonte.

## Playgrounds

Quatro apps Nuxt de rascunho, um por eixo. Nenhum deles é documentação — isso é o
`docs/`, adiante.

| app | porta | eixo |
|---|---|---|
| `playgrounds/i18n` | 3030 | `@nuxtjs/i18n` em foco: troca de idioma, packs do usuário, `tr`/`trRule`, `RDate` reformatando ao trocar de locale |
| `playgrounds/basic` | 3031 | app comum **com** i18n: cadastro de ponta a ponta, `RDynamic` vindo de rota do Nitro, tela de edição/CRUD, e o upload de verdade contra `POST /api/uploads` |
| `playgrounds/standalone` | 3032 | **sem** `@nuxtjs/i18n`: o motor próprio, packs em `app/rform/locales`, a assimetria do `~~` |
| `playgrounds/ui` | 3033 | tokens `--rf-*`, `defineFieldDefaults`, `ui` por campo, `popover` do Dropdown |

A página `upload` do `basic` é a única prova ponta a ponta do `RFile` com API: três rotas Nitro (`POST /api/uploads`, `GET` e `DELETE /api/uploads/:id`) guardando bytes na memória do processo, e um `upload` escrito com `XMLHttpRequest` — `fetch` não reporta progresso de envio, então a barra só existe por ali. Um arquivo com `falha` no nome faz a rota devolver 502, que é como se exercita o retry sem derrubar o servidor.

`standalone` e `ui` **não podem** ganhar `@nuxtjs/i18n`, e por motivos diferentes:
o primeiro é o único lugar que exercita o motor próprio; o segundo ficaria ilegível,
porque com i18n toda label vira chave e chave é ruído quando o assunto é classe.

### O mínimo para reproduzir

Playground é **rascunho**, e a régua é essa: uma página é o formulário que
reproduz o cenário e o model ao lado. Sem parágrafo explicativo, sem `description`,
sem lista de bullets dizendo o que a página prova — isso é o `docs/`, e repetido
aqui só apodrece. Título de bloco tem 1 a 3 palavras (`"null apaga"`,
`"popover"`), nunca uma frase. Comentário `//` no `<script>` continua bem-vindo:
é rascunho de dev, não texto de leitor.

O chassi é o mesmo nos quatro: `Card` (caixa com título curto opcional), `Json` (a
saída) e `Scenario`, que é o par dos dois — grid de duas colunas a partir de
`lg`, formulário à esquerda, model `lg:sticky` à direita. Nenhuma página remonta
esse grid na mão. O layout é uma linha só: nome do app, as rotas derivadas de
`useRouter().getRoutes()` e os toggles.

```vue
<Scenario
    title="null apaga"
    :value="data"
>
    <RForm v-model="data"> … </RForm>
</Scenario>
```

`playgrounds/i18n` é o que era o `playground/`, com o histórico preservado — e
**carregou a documentação antiga junto até virar quatro playgrounds**: `DemoPage`,
`Demo`, `DemoCode`, `DemoUi`, o recorte por regex do fonte da página, um
highlighter próprio e treze páginas `campos/*.vue` de vitrine. Eram ~4.500 linhas
que o `docs/` já cobre com demos vivos e referência gerada do fonte; foram
apagadas. Sobraram cinco páginas: `index` (troca de idioma), `form` (o smoke test),
`traducao`, `customizados` e `dynamic`.

Junto com `DemoUi` foi-se o `playgrounds/i18n/app/utils/ui.ts` — a árvore de
camadas mora no `docs/`, que é onde ela se lê.

`playgrounds/i18n/app/pages/form.vue` é o smoke test visual de todos os
componentes. Cenários do `RSelect` cobrem: array primitivo, multi+modelFull,
single+modelFull com slot custom, e objeto `{key: label}`. Útil para validar
mudanças que afetem inferência de tipos do slot.

`playgrounds/i18n/app/pages/customizados.vue` cobre campo e util do usuário, com
`app/rform/fields/Rating.vue` e `app/rform/utils/Hint.vue`. São eles que dão
cobertura de type-check a um componente escrito **como usuário** — o `src/` não
exercita esse caminho. O `docs/` tem cópia dos dois, pelo mesmo motivo.

A fixture (`test/fixtures/basic/rform/`) tem os três casos de componente que os
testes cobrem — `fields/Rating.vue` (campo novo), `fields/Switch.vue` (substitui um
embutido via `#rform/builtin`) e `utils/Hint.vue` (util novo) — mais
`locales/pt-BR.ts`, um pack de usuário com uma chave sobrescrita. Ela fica **sem**
@nuxtjs/i18n de propósito: é ela que cobre o resolvedor próprio no teste.

## O site (`docs/`)

App Nuxt com `@nuxt/content`, `@nuxtjs/i18n`, e o módulo por caminho relativo. É o
produto para quem instala do npm — prosa, referência gerada e demos vivos.

### Duas collections espelhadas

`content.config.ts` declara `content_pt` e `content_en`, as duas com
`prefix: ""` — então o **caminho da página é o mesmo nos dois idiomas**
(`/fields/text`), e trocar de idioma é trocar o prefixo da rota. O
`app/pages/[...slug].vue` resolve a collection pelo `locale` e **cai no
`content_pt`** quando a página não existe no locale ativo: uma tradução faltando
mostra o texto em pt, não um 404.

Os slugs não traduzem de propósito — as duas árvores são espelho arquivo a
arquivo, e `test/unit/docs.test.ts` cobra isso.

O locale é `pt`, e não `pt-BR`: o `packFor` do `module.ts` escolhe o pack por code
exato e, na falta, **por língua** — então `pt` recebe o pack `pt-BR` do módulo sem
inventar code nenhum na lista de locales do site.

A ordem da sidebar sai dos prefixos numéricos dos arquivos, via
`queryCollectionNavigation()`; o título de cada seção vem do `.navigation.yml` do
diretório, um por idioma.

### O chassi: barra do topo, navegação, índice

Três colunas, no formato que uma doc de framework tem: `Header.vue` fixo no topo
(marca à esquerda, **busca no centro**, GitHub e os dois menus de ícone à
direita), `Sidebar.vue` grudada à esquerda, `Toc.vue` à direita a partir de `xl`
e `PageNav.vue` (anterior/próxima) no pé. O menu do mobile mora em `useState`,
porque quem o escreve é o cabeçalho e quem o lê é a barra lateral, do outro lado
do layout.

A marca é **`RForm`**, com as duas maiúsculas — no cabeçalho e no `<title>`. O
pacote no npm continua `rform`, e todo comando, import e specifier de instalação
continua minúsculo: é o nome do pacote, não a marca.

Tema e idioma são **menus de ícone**, os dois pelo mesmo `Menu.vue` — um botão de
40px que abre uma lista, fecha no `pointerdown` de fora, no `Escape` e na escolha.
O `pointerdown` do documento, e não um overlay: overlay engoliria o clique que
abre o menu vizinho.

**O índice só gruda se a coluna dele esticar.** O `aside` é filho de um flex com
`items-start`, então a altura dele é a do conteúdo — e um `sticky` *por dentro* não
tem por onde correr: o índice subia junto com a página, calado. Quem tem de ser
`sticky` é o próprio `aside`.

As duas cores do tema têm papéis separados, e é o que impede o site de ser azul de
ponta a ponta: **primary** é navegação e estado (item ativo da barra lateral, link,
foco, submit); **secondary** é saída e identidade (marcador do índice ativo, painel
de model, chip de tag, badge `util` da árvore de `ui`, marcador de lista, citação).

**A navegação é buscada num lugar só, e isso é obrigatório.** `useDocsNav()`
(`app/composables/nav.ts`) embrulha o `useAsyncData` da chave `nav-<locale>`. O
Nuxt compara chamadas de mesma chave pelo **fonte do handler** (`hashFunction`, em
`app/utils/hash`), e três arquivos com o mesmo `useAsyncData` escrito à mão davam
`NUXT_E3004 · different handler` a cada render.

**A página tem raiz única de propósito.** O `<NuxtPage>` embrulha a página num
`<Transition>`, e transição não anima fragmento — o `article` e o `aside` do índice
moram dentro de uma `div`.

O item ativo do índice sai de um `IntersectionObserver` sobre os próprios títulos,
com `rootMargin` recortando a faixa de leitura. Scrollspy por evento de scroll
refaz layout a cada quadro para responder a mesma pergunta.

### A busca procura no texto, não no menu

`Search.vue` no centro do cabeçalho, com `ctrl`/`cmd`+K. As seções vêm do
`queryCollectionSearchSections(collectionOf(locale))` — id com âncora, título,
trilha de títulos e o **conteúdo** de cada seção da collection do idioma ativo,
247 delas hoje. O `useLazyAsyncData` é `immediate: false` e só executa no primeiro
`open`: é payload que uma visita que nunca busca não paga.

Isso já foi um filtro da barra lateral, casando só título e tag — o que respondia
"em que página está o `superRefine`?" com nada.

Quem ordena é `searchDocs` (`app/utils/search.ts`, puro, testado): toda palavra do
termo tem de aparecer em algum lugar da seção, e o peso é **onde** ela apareceu —
título 10, começo do título +5, trilha 3, corpo 1.

O `fold` (minúsculas sem acento) troca **um caractere por um caractere**, com
tabela, em vez do `normalize("NFD")` habitual. NFD decompõe o acento em dois code
points e muda o comprimento da string — e aí o índice da ocorrência não serve mais
para recortar o trecho do texto **original**, que é o que a lista mostra.

O destino sai do `id`, que é caminho de collection (sem prefixo de idioma) mais
âncora. O `localePath` não engole a âncora, então ela é cortada antes e recolada
depois.

### O título da prosa é um link, e por isso saía azul e sublinhado

O `@nuxt/content` embrulha o texto de todo heading num `<a href="#id">` para a
âncora. Com `.prose a` pintando de `primary` e sublinhando, **todo `##` da
documentação renderizava como link** — que é exatamente o que um título não é.

`.prose :is(h2, h3, h4) a { color: inherit; text-decoration: none }` resolve, e sem
tocar em `font-weight`: o peso continua vindo do próprio heading, então `h2` segue
mais forte que `h3`.

Na mesma linha, `max-w-prose` saiu de `p`, `ul`, `ol`, `blockquote`, do
`description` da página e do cabeçalho do `<Demo>`: com barra lateral e índice já
estreitando a coluna, ele cortava o texto **duas vezes** — o parágrafo parava no
meio do container, e a caixa de aviso parecia meio vazia.

### O código é shiki, com o tema do editor

Prosa e demo pintam pelo mesmo [shiki](https://shiki.style) e pelo mesmo tema —
Shades of Purple (Super Dark), de Ahmad Awais (MIT), copiado do `.vsix` para
`docs/app/assets/shiki/shades-of-purple.json`. Do arquivo original ficaram o
`tokenColors` inteiro e **duas** chaves de `colors` (`editor.background` e
`editor.foreground`), que são as que o shiki lê; as outras 255 são cor de
chrome do editor e só pesariam no bundle.

`assets/shiki/index.ts` é quem dá tipo a ele. `ThemeRegistrationRaw` herda do
vscode-textmate um `settings` **obrigatório** — o nome antigo do que o VS Code
chama de `tokenColors` —, então o módulo declara os dois a partir do mesmo array.
Sem isso não há cast possível: falta uma chave obrigatória, e o TS recusa até o
`as` ("neither type sufficiently overlaps").

#### A prosa: um tema nas duas chaves

```ts
highlight: { theme: { default: shikiTheme, dark: shikiTheme } }
```

As duas apontam para o mesmo objeto **de propósito**. O `@nuxt/content` faz
`defu(markdown.highlight, mdcOptions.highlight, …)`, e o default do mdc é
`{ default: "github-light", dark: "github-dark" }` — passar só o `default`
deixaria o `dark` do mdc sobreviver ao merge, e metade dos tokens voltaria ao
github-dark.

O `@nuxtjs/mdc` chama o `codeToHast` com `defaultColor: false` **sempre**, então
o token nunca recebe um `color:` — só `--shiki-default` e `--shiki-dark`. A regra
que aplica essas variáveis não vem de lugar nenhum: sem `.prose pre.shiki span {
color: var(--shiki-dark) }` no `main.css`, todo bloco cercado da prosa renderiza
sem cor, e nada avisa.

Detalhe que confunde na hora de conferir: o `compress: true` (default do
`@nuxt/content`) tira o `style=` de cada token e o troca por uma classe curta
(`.szBVR`), com um `<style>` na própria página declarando os `--shiki-*` dela.
Procurar `--shiki-dark` **dentro do `<pre>`** do HTML gerado, então, não acha nada
— e não quer dizer que a cor sumiu.

**Bloco cercado sem linguagem não tem token para colorir**, e é o único que de fato
sai sem cor: são quatro na documentação (diagramas, a árvore do pack, uma saída de
console). Sem uma pele própria eles se leem como um bloco de código quebrado, então
`.prose pre.language-text` os marca como o que são — borda tracejada e texto mais
apagado. As linguagens de verdade (`ts`, `vue`, `css`, `json`, `js`, `bash`) o
shiki já cobre; nada a declarar em `nuxt.config`.

#### O demo: dois highlighters, e a divisa é quem pinta no browser

`app/utils/highlight.ts` monta dois, porque as duas metades do `DemoCode` têm
necessidades opostas:

| | gramática | motor | onde pinta |
|---|---|---|---|
| `json` | pré-compilada (`@shikijs/langs-precompiled`) | `raw` | browser, a cada tecla |
| `vue`, `ts` | normal (`shiki/langs/*`) | `javascript` (compila regex) | server |

O painel de model repinta a cada tecla, então a gramática dele **tem** de estar no
bundle: a pré-compilada roda no motor `raw`, que não carrega compilador de regex,
e o par custa ~6 kB. A de `vue` não serve para isso e nem funcionaria — a versão
pré-compilada dela marca `<RText` como `invalid.illegal`, medido token a token
contra o oniguruma. Vai de gramática normal, atrás de `import()`, e arrasta ts,
js, css e html junto: ~500 kB que só o server carrega.

O que faz isso funcionar no browser é o **payload**. O `DemoCode` embrulha o
realce num `useAsyncData(useId())`: o server pinta, o HTML viaja no payload, e o
client-side navigation de um site pré-renderizado lê de lá sem baixar gramática
nenhuma. Era o que o `Demo.vue` já fazia com o fonte do demo — sem isso o build
estático publicaria o bloco sem cor.

O motor `javascript` foi conferido, não escolhido no chute: com `forgiving: true`
ele produz **exatamente** o mesmo HTML que o oniguruma nos 109 demos, no `.ts` e
no `json` — daí não haver wasm em lugar nenhum do docs.

#### O recorte de template precisa dizer onde está

O fonte de um demo sem `<script>` é o **miolo** do `<template>`, e para a
gramática do shiki isso não é um SFC. Sem contexto ela casa o primeiro elemento
como se fosse o bloco de topo, e larga **todo o resto do arquivo sem escopo**: o
segundo campo do demo sai branco, e nada avisa.

`grammarContextCode: "<template>"` (o `context()` do `highlight.ts`) é o que a
gramática precisa ouvir — é o mesmo truque que o `@nuxtjs/mdc` usa para as
linguagens `vue-html` e `vue-template`.

O gatilho é **um atributo por linha**, que é como todo demo se escreve por causa
do `singleAttributePerLine`: um elemento numa linha só passa ileso, e foi por
isso que a comparação contra o oniguruma nos 109 arquivos não pegou nada — ela
comparava o `.vue` inteiro, que começa em `<template>` e portanto nunca é
recorte. Quem cobre isso agora é `test/unit/docs.test.ts`.

Na prosa o mesmo vale para um ````vue``` que seja recorte, e hoje os seis que
existem têm **um** elemento raiz só — que é o caso que passa ileso. Um segundo
elemento raiz num fence desses sai sem cor, e a saída é escrever o bloco inteiro,
com `<template>`.

`structure: "inline"` é o que deixa o `<pre>` ser do `DemoCode`: o shiki devolve
só os `<span>` dos tokens, com as linhas separadas por `<br>`, e o fundo, o
scroll e o cabeçalho continuam sendo do componente.

Trocar de aba no `::code-group` não pode ser um `code` novo no mesmo `DemoCode` —
isso refaria o realce **no browser**, que para `vue` é baixar a gramática inteira.
Por isso ele renderiza todos os blocos e mostra um: cada um tem o próprio payload.

São três dependências novas em `docs`, e as três explícitas: `shiki`,
`@shikijs/langs-precompiled` e `@shikijs/engine-javascript` — o último chega
pelo shiki, mas o layout do pnpm não o alcança da raiz de `docs`, e importar
`@shikijs/engine-javascript/raw` sem declarar é a mesma phantom dep que o
`vue`/`vite` do módulo já foram.

**Isso já foi um highlighter escrito à mão** — três gramáticas de regex e uma
paleta de classes `.tok-*` no `main.css`, porque string montada em runtime não
passa pelo scanner do Tailwind. Cobria o que o docs mostra, mas era uma segunda
definição de "como TypeScript se lê" convivendo com a do shiki na prosa, logo
acima. As duas metades da página agora leem a mesma.

### `TrInput` estreita lá dentro, e isso é a feature

O docs declara `langDir` com JSON real, então **todo literal solto numa prop de
texto é erro de `vue-tsc`**. É o comportamento documentado em "O mapa de chaves do
app", e aqui ele força cada demo a ter as duas traduções.

A convenção: chave `demo.<componente>.<coisa>` para texto que uma pessoa lê, e
`~~` quando o label *é* o código demonstrado (`~~:length="4"`, `~~brCpf`). São 172
chaves hoje, as mesmas nos dois packs.

Cada página de campo abre com um `::callout` dizendo isso, e linkando a página de
tradução — senão o leitor copia `label="demo.text.nome"` para um app sem i18n.

### Os demos são arquivos `.vue`

`docs/app/demos/<Componente>/<id>.vue`, montados por `::demo{src="Text/basico"}`.
Dois `import.meta.glob` sobre a mesma pasta dão o componente e o texto cru, então
o código na tela é literalmente o que rodou — e **passa por `vue-tsc`**, que é o
ganho sobre o recorte por regex do playground.

`demoSource()` (`app/utils/demos.ts`) tira o `<template>` externo e desindenta
quando o arquivo não tem `<script setup>` — o caso comum. Com script, mostra o
arquivo inteiro.

**Todo bloco com campo mostra o model ao lado.** O `RForm` e o painel são do
`<Demo>`, não do arquivo de demo — e `:form="false"` desliga só o `RForm`, para o
demo que monta o próprio (os três modos do `useRForm`, o `RDynamic`). Nesse caso o
painel lê o `defineExpose({ data })` do demo por `useTemplateRef`: é uma linha no
fim do `<script setup>`, e é o preço de o exemplo ser o dono do formulário.

**Demo que declara `rule` ganha os botões sozinho.** O `<Demo>` procura `rule=` no
fonte do arquivo e, achando, põe um `<DemoActions />` dentro do `RForm` dele — sem
submit, um bloco de validação não valida nada e o leitor fica olhando um campo que
nunca reclama. Quem já traz o próprio `DemoActions` (os que montam o formulário)
não ganha um segundo par: a mesma busca no fonte serve de guarda.

O par formulário↔model é **container query**, não breakpoint de viewport: o
`<Demo>` é um `@container` e vira duas colunas em `@2xl`. Quem decide é a largura
que sobra depois da barra lateral e do índice, que o `md:` do viewport não
enxerga — é por isso que os demos escrevem `@md:grid-cols-2` e não `md:grid-cols-2`.

**Um demo novo exige reiniciar o dev server.** O `import.meta.glob` é resolvido na
transformação, e um arquivo criado com o servidor no ar não entra nele — o sintoma
é o `<Demo>` renderizar o aviso de "não existe em app/demos".

**Todo bloco MDC precisa do `::` de fechamento.** Um `::props-table{…}` sem ele
engole o resto do documento: o MDC trata o bloco como aberto e o conteúdo seguinte
vira filho dele. A página termina cedo, sem erro nenhum.

### Os dois JSON gerados saem de módulos locais

`api.json` e `mcp.json` nascem de dois módulos em `docs/modules/`, então existem em
todo `dev`, `build` e `prepare` — não há passo a lembrar, e o artefato não tem como
ficar velho. Cada um é um par: `data.ts` puro (o gerador) e `index.ts` (o módulo). O
teste importa o `data.ts`, então não arrasta o `@nuxt/kit` para dentro do projeto
`unit` do vitest.

**Mora em `docs/modules/`, não em `docs/app/modules/`**, e isso não é óbvio num app
com `srcDir: "app"`: o `dir.modules` do schema resolve contra o **`rootDir`**, e o
`resolveModules` faz `resolve(config.srcDir, dir.modules)` sobre um caminho já
absoluto — o srcDir não entra. O glob de varredura é `*{ext}` e `*/index{ext}`, então
`modules/mcp/index.ts` é registrado e `modules/mcp/data.ts` **não** — é o que permite
colocar o gerador ao lado do módulo.

**O endereço é o alias `#docs`**, registrado em dois lugares pelos dois módulos, com
o mesmo valor: `nuxt.options.alias` (o Vite, para o `PropsTable.vue`) e
`nuxt.options.nitro.alias` (o nitro, para o `server/utils/mcpData.ts`). Registrar nos
dois módulos é de propósito — cada um fica autocontido e não há ordem entre eles a
manter.

**E os dois módulos fazem `mkdirSync` do diretório no `setup`.** Não é para poder
escrever depois — é porque o `path` do tsconfig depende disso. Tanto o kit quanto o
nitro decidem se emitem `#docs/*`, além de `#docs`, por um **`stat`** do alvo do
alias: só um diretório ganha a entrada com `/*`. Num `.nuxt` frio o `stat` falha,
sai só `#docs`, e `#docs/mcp.json` deixa de resolver — no `tsconfig.server.json`, que
é gerado antes dos templates, então o sintoma é o `vue-tsc` do `server/` reprovando
com `TS2307` **só em clone novo ou CI**, e passando na máquina de quem já rodou um
build. O `mkdir` no `setup` torna o `stat` determinístico nos dois lados.

**Todo call site casteia o JSON** (`api as ComponentMeta[]`). O tipo de um import de
`.json` vem do **conteúdo**, então um artefato vazio daria `never[]` e o `.find()` ao
lado pararia de compilar — e vazio é exatamente o que o `prepare` produz (adiante).
O cast é o que declara a forma independentemente do que o arquivo tem naquele
instante. O `mcpData.ts` já fazia assim antes.

#### O `buildDir` não é o mesmo em todo comando

Medido, e é a raiz de tudo o que vem a seguir:

| comando | `buildDir` | quando escreve o tsconfig |
|---|---|---|
| `nuxi prepare` | `<rootDir>/.nuxt` | `clearBuildDir` → `buildNuxt` → **`writeTypes`** |
| `nuxi build` | `<rootDir>/node_modules/.cache/nuxt/.nuxt` | `clearBuildDir` → **`writeTypes`** → `buildNuxt` |
| `nuxi dev` | `<rootDir>/.nuxt` | herda o do prepare anterior (escreve em paralelo) |

Consequência direta: **no `prepare` o `api.json` sai `[]`**, porque o checker precisa
do tsconfig e ele ainda não existe. Não faz falta — prepare só gera tipos, nada
renderiza — e é por isso que o aviso é suprimido quando `nuxt.options._prepare` é
verdadeiro: mandar "rode `nuxi prepare`" durante um `nuxi prepare` é ruído que não
diz nada. O `build`, que é o que publica o site, escreve os tipos **antes** e sai
completo.

#### O `api.json` não pode ser um `addTemplate`

O `mcp.json` é template e o `api.json` não, e a assimetria tem causa.

O `getContents` de um template roda **no meio do `generateApp`**. Os `.vue` do módulo
entram no programa do TypeScript pelo `components.d.ts` e pelos tipos `#rform/*` —
que são templates irmãos, ainda não escritos naquele instante. O checker então
falha com `'…/fields/Array.vue' is not part of the project`. Daí o `build:before`,
que roda depois de todos os templates e ainda **antes** do `builder.bundle()`, que é
o que importa: o Vite e o nitro resolvem `#docs/api.json` pelo arquivo já no disco.

O `mcp.json` fica template porque o gerador dele só lê arquivo do repositório — não
depende de nenhum irmão.

**O modo de falha era mudo, e é o que dói.** O Nuxt rebaixa falha de template a
warning (`NUXT_B1001 Could not compile template`), então o erro do checker não
aparece; o que aparece é o Vite morrendo depois com
`[UNLOADABLE_DEPENDENCY] Could not load …/docs/api.json`, apontando para o
`import` — o sintoma, não a causa. Para ver o motivo é preciso embrulhar o
`getContents` num try/catch e imprimir.

#### `@nuxt/kit` teve de ser declarado

`docs/package.json` ganhou `@nuxt/kit`. Ele chega pelo `nuxt`, mas para *dentro* de
`.pnpm/nuxt@…/node_modules`, que não é alcançável da raiz de `docs` — mesma classe
de phantom dep que o `vue`/`vite` do módulo já foram (`require.resolve` de
`@nuxt/kit` a partir de `docs/` dá `MODULE_NOT_FOUND` sem a declaração).

#### O teste não lê o artefato

`test/unit/mcp.test.ts` chama `buildMcp()` e compara com o disco: o que há para
testar é a **derivação**, porque o artefato em si nasce em todo build e não pode
divergir da fonte. O `describe` da api deriva as tags do layout de `components/`,
pelo mesmo motivo — nenhum dos dois depende de arquivo gerado.

### A tabela de props é gerada

`docs/modules/api/` roda `vue-component-meta` sobre
`src/runtime/components/{fields,utils}` mais `Form.vue` e `Dynamic.vue`, e escreve
`.nuxt/docs/api.json`. O gerador puro mora em `data.ts`, ao lado do `index.ts` que
é o módulo — e é o `data.ts` que o teste importa, sem arrastar o `@nuxt/kit`.

O checker roda contra o **tsconfig do buildDir**, não contra o
`tsconfig.check.json` da raiz: é ali que `#rform/*` resolve com os tipos gerados
daquele app.

Ele **aguenta o `RSelect`** — o caso difícil, com cinco parâmetros de tipo e o `Opts`
genérico, que é o mesmo lugar que já rendeu o "Union type too complex". 18 props, sem
erro, medido de novo depois que o generic passou a chegar ao model. O que muda na
tabela é o texto: `modelValue` e `default` saem como
`ModelOf<Opts, KeyValue, ModelFull, Multiple>` em vez de `unknown`, no mesmo espírito
do `options: Opts` e do `multiple: Multiple` que a tabela já mostrava.

Os tipos do módulo vêm de interseção, então o checker devolve a lista achatada e
completa mas **sem descrição** — não há JSDoc por prop pra ele ler. A divisão que
decorre disso é a certa: a tabela gerada é a verdade exaustiva
(nome/tipo/obrigatoriedade/default) e nunca desatualiza; a prosa ao lado explica as
props que precisam de explicação, e é opcional por prop.

O checker lista todo emit também como prop `onXxx`; o `data.ts` os move para
`events`, senão `onUpdate:modelValue` apareceria como prop escrevível.

O `ignorePatterns` do `oxfmt.config.ts` não precisa listar nenhum dos dois: em
`.nuxt/` eles já caem no `.gitignore`, que o oxfmt lê. Lá ficou só o tema do shiki,
que é copiado do `.vsix` e não escrito à mão.

**O `.prettierignore` era da mesma família** — o oxfmt o lê por padrão, junto com o
`.gitignore`. Um arquivo de config de uma ferramenta que o repo não usa, só para
o formatador que ele usa ler: o `ignorePatterns` diz a mesma coisa no arquivo
onde o resto da configuração do oxfmt já está.

### A árvore de camadas lê o `defaults` do módulo

`docs/app/utils/ui.ts` (portado do playground) lê `defaults.ui` por
`import.meta.glob` e parseia o template pra saber onde cada `RUtils` entra. Nenhum
build step.

**Ele esteve quebrado no playground desde o refactor para `fields/`/`utils/`**: a
busca era por `components/<Nome>.vue` e `components/Utils/<Nome>.vue`, caminhos que
não existem mais. A árvore vinha vazia, calada. Hoje há um `field()` que tenta
`fields/<Nome>.vue` e cai em `<Nome>.vue` — o segundo é o `Form` e o `Dynamic`, que
não são campos mas têm `ui` a mostrar. O arquivo do playground foi apagado junto
com o `DemoUi`; a árvore existe num lugar só.

**O desenho é recuo e linha, não caixa dentro de caixa.** `DemoUiLayer.vue` é uma
lista recursiva: chave, badge `util` quando for um, a classe ao lado, e as filhas
recuadas atrás de uma borda esquerda. Antes cada camada era uma caixa com borda
tracejada, fundo alternado por nível e um anel de foco — o `ui` do `RDate` virava
seis molduras aninhadas, e o que se lia era a moldura, não a hierarquia. Junto foi-se
o mecanismo de foco inteiro (o `uiFocusKey` provido pelo `UiTree`, o `state()` de
quatro estados e a caixa "camada em foco" grudada no topo): clicar para acender uma
camada é interação que ninguém pedia num diagrama que cabe na tela.

### As guardas

`test/unit/docs.test.ts`, projeto `unit`, sem app:

1. `demoSourceOf()` — desembrulha o `<template>`, preserva indentação relativa,
   devolve o arquivo inteiro quando há script, e não engole um `</template>` de
   slot no meio.
2. **Paridade** — todo `content/pt/**/*.md` tem irmão em `content/en/**`, e
   vice-versa, mais as seções.
3. **Demos resolvem** — todo `::demo{src}` aponta para um arquivo que existe, e
   todo demo é citado por alguma página. É o apodrecimento mais provável.
4. **`searchDocs`** — termo vazio não devolve nada, título vem antes de corpo, uma
   palavra que não casa zera o resultado, e o trecho sai do texto **com** acento
   (é o teste que pega uma volta ao `NFD`).
5. **Os dois packs do site concordam em toda chave** — `pt.json` e `en.json`
   comparados por caminho pontilhado. Uma chave nova num só idioma imprime o
   caminho cru na tela do outro, e o `vue-tsc` não vê isso.

O scanner tira bloco cercado e código inline antes de casar `::demo` — a própria
página de contribuição mostra a sintaxe como exemplo.

### O endpoint MCP (`/mcp`)

A mesma documentação, para agente de código. Quem mais erra o rform é agente, e
erra no que o site já sabe: a forma dos props (`Element<…> & Utils[…] &
TextProp<…>`, que não sai de nenhum `.d.ts` legível), a forma dos args de preset
(`{ name: "min", min: 3 }`, nunca `args: [3]`) e o fato de `label`/`error` serem
`TrInput` e não string. Consultar em vez de chutar é o ponto.

**As ferramentas não consultam o `@nuxt/content`, e o motivo não é que não daria.**
Daria: `queryCollection(event, …)` é o caminho normal de um server route. O que
decide é que **metade delas lê arquivo que não cabe em collection nenhuma** — o
`.vue` de um demo, o `.ts` de um preset, a saída do `vue-component-meta` —, então um
artefato de build existiria de qualquer jeito. As páginas vêm junto por duas razões
menores: markdown cru serve melhor a um agente que o AST do MDC (que é o que a query
devolve), e no Worker a query custaria um D1, porque o preset `cloudflare` do próprio
content **força** `{ type: "d1", bindingName: "DB" }` — no Worker não há filesystem
nem `better-sqlite3`. Um banco para 29 arquivos de markdown não se paga. Num alvo
Node isso não vale: ali a query não custa nada, e o corte seria só o dos três.

O preço aceito é a **granularidade de página** na busca: `queryCollectionSearchSections`
daria seção por seção, e é o que se ganharia com o D1. Ver a nota do
`search-documentation`, adiante.

É o mesmo padrão da tabela de props, com um segundo gerador ao lado.

```
docs/modules/mcp/data.ts        ← puro: páginas, demos, presets → McpData
docs/modules/mcp/index.ts       ← o módulo: template → .nuxt/docs/mcp.json
docs/app/utils/demoSource.ts    ← demoSourceOf, sem glob (o Node não importa o demos.ts)
docs/server/utils/mcpData.ts    ← o único lugar que conhece o endereço dos dois JSON
docs/server/mcp/tools/*.ts      ← as seis ferramentas
```

São seis, e o argumento opcional é o que funde list+get em vez de virarem dez:
`search-documentation`, `get-documentation-page`, `list-documentation`,
`get-component-api`, `get-demo`, `list-presets`.

**`demoSourceOf` teve de sair do `demos.ts`**: aquele arquivo abre com
`import.meta.glob`, transformação do Vite que o gerador, sendo Node puro, não
consegue importar.
Mora sozinho em `app/utils/demoSource.ts`, e o `Demo.vue` importa de lá — reexportar
pelo `demos.ts` daria **dois donos ao mesmo nome no auto-import**, e o Nuxt avisa a
cada prepare. Uma definição só, e o que o MCP entrega é byte a byte o que o site
mostra.

**A busca é em granularidade de página**, não de seção: sobre o JSON, fatiar por
âncora exigiria replicar a slugificação de heading do `@nuxt/content` — quem daria
isso de graça é o `queryCollectionSearchSections`, e o preço dele é o D1 (acima). E
um agente quer a página inteira de qualquer jeito. O preço é que toda página que
cita as palavras empata no corpo (peso 1) e o desempate vira a ordem da barra
lateral — `"mask cpf"` respondia com a home antes de `/concepts/presets`. Por isso
os `titles` de cada seção levam a trilha do caminho **e** os `headings` da página:
um título de seção volta a pesar o que pesa no site, sem replicar slug nenhum.

O `path` espelha a rota do `@nuxt/content` — cai o `en/`, cai o prefixo `NN.` de
cada segmento, `index` vira a raiz — e por isso vem **sem** prefixo de idioma: a
URL no site é `/en<path>`. Só `en`, por decisão.

### Deploy: um Worker, não Pages

`.github/workflows/docs.yml`: `pnpm install` → stub do módulo → `nuxi prepare docs`
→ `pnpm --filter rform-docs build` (que gera `api.json` e `mcp.json` por dentro,
pelos módulos de `docs/modules/`) → `cloudflare/wrangler-action` com `deploy` e
`docs` como cwd.

Precisa dos secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no
repositório. O worker se chama `rform` e é criado no primeiro deploy — não há
projeto a criar no painel, ao contrário do Pages.

**`build`, e não `generate`.** O `/mcp` é rota POST de runtime, e estático não a
serve — daí o `prerender` com `crawlLinks`, semeado em `/pt` e `/en` (a
`strategy: "prefix"` do i18n faz `/` ser redirect) e com `ignore: ["/mcp"]`, senão
o crawler tenta pré-renderizar o endpoint.

**`cloudflare_module`, e o que ele apaga.** Static assets do Worker atendem antes
de o worker acordar, então as 56 páginas pré-renderizadas continuam saindo do CDN
sem `_routes.json` nenhum — o arquivo que o preset de Pages gerava, com o limite de
100 regras e a lista de exclusão que crescia com o site, simplesmente não existe
mais. Só `/mcp` e o redirect de `/` chegam no worker. A saída é `docs/.output`
(`server/` + `public/`), não `docs/dist`.

**O `wrangler.json` é gerado, e é por isso que `deployConfig: true` está ligado.**
O preset escreve `.output/server/wrangler.json` com o entry, o binding `ASSETS`, o
`compatibility_date` (do `compatibilityDate` do Nuxt) e o `nodejs_compat` que o
`@nuxt/content` pede — tudo derivado do layout de saída, em vez de um segundo
arquivo à mão pra desatualizar. Do `nuxt.config` sai só o `name`. Junto vai
`docs/.wrangler/deploy/config.json`, que é como o `wrangler deploy` sem argumento
acha essa config; ele imprime `Using redirected Wrangler configuration` quando
achou. **A contrapartida**: com `deployConfig` ligado, config do painel da
Cloudflare (env var, binding) é descartada no deploy. Aqui não pesa — não há
nenhuma —, mas no dia que houver, ela tem de virar `cloudflare.wrangler`.

**`agents` é dependência obrigatória, não peer opcional.** O `@nuxtjs/mcp-toolkit`
troca de provider quando o preset contém `cloudflare`, e o provider de lá importa
`agents/mcp`. Num Worker não há external, então o build morre com
`Cannot resolve "agents/mcp" … and externals are not allowed!` — que não diz que a
saída é instalar o pacote. `h3` e `zod` são os peers não-opcionais do toolkit; o
`zod` já estava.

O `@nuxt/content` avisa `switching to D1 database with binding DB` no prepare e no
build. É só aviso: tudo é pré-renderizado e nada consulta conteúdo em runtime, então
o worker sobe sem binding nenhum — medido com `wrangler dev` sobre o build, onde
`/` redireciona pra `/pt`, `/en/fields/text` sai do asset store e `/mcp` responde
o `initialize` com as seis ferramentas.
