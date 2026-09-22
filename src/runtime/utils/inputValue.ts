/**
 * O `value` do `<input>`/`<textarea>` que disparou o evento. É o par de `:value` que
 * substitui o `v-model` no elemento nativo: o `mounted` do `vModelText` é post-render
 * effect, e um Suspense pendente o represa até reaplicar o valor da montagem por cima
 * do que chegou no meio — ver "O elemento nativo liga por `:value` + `@input`" no
 * `.claude/CLAUDE.md`.
 *
 * @example <input :value="model" @input="model = inputValue($event)" />
 */
export const inputValue = (event: Event) => (event.target as HTMLInputElement).value;

/**
 * O `checked` do checkbox que disparou o evento; o par de `:checked` pelo mesmo motivo
 * de `inputValue`.
 *
 * @example <input type="checkbox" :checked="model" @change="model = inputChecked($event)" />
 */
export const inputChecked = (event: Event) => (event.target as HTMLInputElement).checked;