/**
 * Uma prop-função depois do opt-out: `false` escrito no call site desliga o que o
 * `defineFieldDefaults` padronizou para o app inteiro.
 *
 * O `raw` é a prop **crua**, e tem de ser: o `merger` pula quando o resultado já é
 * truthy e o valor novo é falsy (a regra "não apaga"), então um `false` mesclado
 * nunca chegaria aqui. É a mesma parede que o `focusError` do `RForm` encontra.
 *
 * O `typeof === "function"` sobre o valor mesclado cobre o outro lado: com `Boolean`
 * na lista de tipos que o SFC compila, um `<RFile upload>` sem valor vira `true`, e
 * chamar `true(file)` seria o erro.
 *
 * @example fnProp<UploadFn>(_props.upload, props.value.upload)
 * @example fnProp<ResolveFn>(_props.resolve, props.value.resolve)
 */
export default <T>(raw: unknown, merged: unknown): T | undefined => {
    if (raw === false) {
        return undefined;
    }

    return typeof merged === "function" ? (merged as T) : undefined;
};