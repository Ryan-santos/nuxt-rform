---
name: commit
description: Cria um commit semântico no padrão do projeto (gitmoji + tipo + descrição no gerúndio em pt-br)
disable-model-invocation: true
allowed-tools: Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git add *), Bash(git commit *)
---

# Commit semântico

Execute **imediatamente** quando invocado — sem perguntar se pode começar.

## Fluxo

1. `git status` + `git diff --staged`. Se não houver nada staged, veja `git diff` e faça stage **somente dos arquivos da tarefa atual** — pode haver mudanças de outros agentes/tarefas no working tree; nunca `git add -A` às cegas.
2. Analise as mudanças e determine o(s) tipo(s) da tabela abaixo.
3. Monte **3 sugestões** de mensagem (variações úteis: níveis de detalhe ou tipos alternativos quando ambíguo — nunca a mesma mensagem 3x).
4. Apresente as 3 via `AskUserQuestion` (cada mensagem é o `label` de uma opção; "Other" permite texto customizado).
5. `git commit -m "<escolhida>"` — só o título, sem corpo.
6. Se o usuário pediu "por partes", repita o ciclo agrupando arquivos por assunto.

## Formato

```
:emoji: tipo: descrição curta em português
```

- **emoji**: código textual (`:sparkles:`, `:bug:`...); **tipo**: identificador (feat, fix, refactor...)
- **descrição**: no **gerúndio** (`adicionando`, `corrigindo`), pt-br com acentuação correta, sem ponto final
- **sem escopo** `(...)`, **sem corpo**, máximo **50 caracteres** no total

## Tipos

| Quando usar                       | Código                                                                           | Tipo     |
| --------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Novo recurso/funcionalidade       | `:sparkles:`                                                                     | feat     |
| Correção de bug                   | `:bug:`                                                                          | fix      |
| Refatoração sem mudança funcional | `:recycle:`                                                                      | refactor |
| Melhorias por code review         | `:ok_hand:`                                                                      | review   |
| Formatação/estilo de código       | `:art:`                                                                          | style    |
| UI/estilo visual                  | `:lipstick:`                                                                     | style    |
| Responsividade                    | `:iphone:`                                                                       | style    |
| Performance                       | `:zap:`                                                                          | perf     |
| Documentação                      | `:books:`                                                                        | docs     |
| Comentários no código             | `:bulb:`                                                                         | docs     |
| Conteúdo textual/i18n             | `:pencil:`                                                                       | text     |
| Testes (suite/alterações)         | `:test_tube:`                                                                    | test     |
| Novos testes                      | `:white_check_mark:`                                                             | test     |
| Teste aprovado/validação          | `:heavy_check_mark:`                                                             | test     |
| Configuração                      | `:wrench:`                                                                       | chore    |
| Infra/CI-CD                       | `:bricks:`                                                                       | ci       |
| Dependências (add/remove/up/down) | `:package:` `:heavy_plus_sign:` `:heavy_minus_sign:` `:arrow_up:` `:arrow_down:` | build    |
| Mover/renomear arquivos           | `:truck:`                                                                        | chore    |
| Limpeza de código                 | `:broom:`                                                                        | cleanup  |
| Remover código/arquivos obsoletos | `:wastebasket:`                                                                  | remove   |
| Reverter mudanças                 | `:boom:`                                                                         | revert   |
| Trabalho em progresso             | `:construction:`                                                                 | wip      |
| Lista de ideias/planejamento      | `:soon:`                                                                         | chore    |
| Commit inicial                    | `:tada:`                                                                         | init     |
| SEO                               | `:mag:`                                                                          | seo      |
| Tipagem                           | `:label:`                                                                        | feat/fix |
| Tratamento de erros               | `:goal_net:`                                                                     | fix      |
| Segurança                         | `:lock:`                                                                         | fix      |
| Acessibilidade                    | `:wheelchair:`                                                                   | feat     |
| Animações/transições              | `:dizzy:`                                                                        | style    |
| Release/tag                       | `:bookmark:`                                                                     | release  |
| Deploy                            | `:rocket:`                                                                       | deploy   |
| Dados/arquivos raw                | `:card_file_box:`                                                                | chore    |

## Exemplos

```
:sparkles: feat: adicionando badge de não lidas
:bug: fix: corrigindo refresh de token
:recycle: refactor: padronizando text-current
:broom: cleanup: removendo código morto
:lipstick: style: ajustando espaçamento do card
```