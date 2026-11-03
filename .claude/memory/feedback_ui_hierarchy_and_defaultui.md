---
name: feedback-ui-hierarchy-and-defaultui
description: Convenção do `ui` dos componentes — agrupar chaves de forma hierárquica (não achatar com prefixo) e derivar o tipo de um `defaultUi` via `DeepPartial<typeof defaultUi>`
metadata:
  type: feedback
---

Ao definir o objeto `ui` (classes Tailwind) de um componente, o usuário exige duas coisas:

1. **Hierarquia, não prefixo achatado.** Chaves relacionadas viram objetos aninhados. Em vez de `dayToday`, `dayOutside`, `daySelected`, `monthCell`, `titleButton` + `titleButtonActive`, usar `day: { container, today, outside, selected }`, `months: { grid, cell }`, `title: { container, button: { container, active } }`. A chave base do grupo é `container`.

2. **Fonte única de verdade via `defaultUi`.** Nos componentes `Utils/*` que escrevem `Props` manualmente (usam `useUtil<Props>()`), NÃO duplicar a forma do `ui` no tipo. Extrair um `export const defaultUi = { ... }`, tipar `ui?: DeepPartial<typeof defaultUi>` e declarar `export const defaults: Props = { ui: defaultUi, ...outros }`. Importar `DeepPartial` de `#rform/types`.

**Why:** O `ui` do `Utils/Calendar.vue` estava achatado (`dayToday`, etc.) e o tipo `Props.ui` reescrevia toda a estrutura à mão, duplicando o `defaults`. O usuário pediu hierarquia e depois a extração do `defaultUi` para eliminar a duplicação tipo↔valor.

**How to apply:**

- Componentes regulares que usam `Element<typeof defaults>` já ganham `ui?: DeepPartial<OBJ["ui"]>` de graça (ver `src/runtime/type.d.ts`) e já são hierárquicos — não precisam do `defaultUi`.
- O padrão `defaultUi` só vale para os `Utils/*` (Label, Error, Loading, Dropdown, Length, Placeholder, Calendar) que definem `Props` na mão.
- Cuidado com tipos abertos: em `Length`, `percentages` deve continuar `Record<number, string>` (anotar o valor com `as Record<number, string>` no `defaultUi`) para não travar as chaves em `60/80/100`.
- `mergerUI` faz merge recursivo, então overrides parciais aninhados (ex.: `ui.day.today`) continuam funcionando. Ver [[feedback-preserve-consumer-typing]].