
# Plano: Módulo "Cooperados Eventuais"

Funcionalidade nova e isolada para gerenciar campanhas de vagas pagas/gratuitas em cursos. Não altera matrículas, cursos ou fluxos atuais — apenas adiciona uma camada de inscrição que libera acesso aos cursos vinculados.

## Banco de dados (migration)

Três tabelas novas no schema `public`:

**`cooperados_eventuais_campanhas`**
- `id` uuid PK, `nome` text, `descricao` text
- `data_inicio` date, `data_fim` date
- `limite_vagas` int, `vagas_ocupadas` int default 0
- `status` text check in (`ativa`, `encerrada`, `arquivada`) default `ativa`
- `manter_acesso_cursos` boolean default true
- `aprovacao_automatica` boolean default true
- `created_by` uuid, `created_at`, `updated_at`

**`cooperados_eventuais_cursos`** (vinculação N:N campanha↔curso)
- `id`, `campanha_id` (FK), `curso_id` (FK courses), unique(campanha_id, curso_id)

**`cooperados_eventuais_inscricoes`**
- `id`, `protocolo` text unique (formato `CPB-YYYY-NNNNNN`)
- `campanha_id`, `usuario_id` (uuid, ref auth.users, null se anônimo — mas neste fluxo sempre logado)
- `nome_completo`, `cpf`, `rg`, `email`, `telefone`, `cidade`, `estado` (UF)
- `status` text (`pendente`, `aprovada`, `cancelada`) default `aprovada`
- `data_inscricao` timestamptz default now()
- `data_aprovacao`, `aprovado_por` uuid
- `motivo_cancelamento` text, `cancelado_por`, `cancelado_em`
- `created_at`, `updated_at`
- Unique(campanha_id, cpf) — bloqueia duplicidade na mesma campanha

**RLS**
- Campanhas: SELECT autenticados (apenas `ativa`/`encerrada`); admin manage all
- Cursos vinculados: SELECT autenticados; admin manage
- Inscrições: usuário vê as próprias; admin/moderador veem todas; INSERT via RPC `inscrever_cooperado_eventual` (SECURITY DEFINER) que valida vagas/CPF/datas e gera protocolo de forma atômica

**Função `usuario_tem_acesso_curso_eventual(_user_id, _course_id)`** — retorna true se há inscrição aprovada em campanha ativa vinculada ao curso (ou encerrada com `manter_acesso_cursos=true`). Usada para estender `can_access_course` (via OR adicional em policies de leitura de curso/módulos/lições) — implementado atualizando a função `can_access_course` para considerar também o acesso eventual.

**Trigger** em inscrições para incrementar/decrementar `vagas_ocupadas` na campanha.

**Realtime** habilitado em `cooperados_eventuais_campanhas` e `cooperados_eventuais_inscricoes` para a barra de progresso ao vivo.

## Frontend

**Rotas novas** em `src/App.tsx`:
- `/cooperados-eventuais` (aluno/cooperado/admin/moderador) — lista campanhas ativas + inscrição
- `/cooperados-eventuais/:id` — detalhe da campanha + formulário
- `/admin/cooperados-eventuais` (admin) — lista/CRUD campanhas
- `/admin/cooperados-eventuais/:id` (admin) — gestão de uma campanha (cursos vinculados, inscritos, dashboard)

**Hub** (`src/pages/Hub.tsx`): novo card "Cooperados Eventuais" visível a admin/moderador/aluno/cooperado.

**Páginas**:
- `CooperadosEventuaisList.tsx` — banner + lista de campanhas ativas com painel de vagas (total/inscritos/disponíveis) e barra de progresso realtime.
- `CooperadosEventuaisDetalhe.tsx` — banner, painel de vagas, formulário (zod + react-hook-form): nome, CPF (mask + `isValidCPF`), RG, email, telefone (mask), cidade, UF (select com 27 estados), checkbox termo. Submete via RPC; mostra protocolo e botão "Acessar Cursos Disponíveis". Se vagas=0 ou status≠ativa: exibe "Inscrições Encerradas".
- `AdminCampanhas.tsx` — tabela de campanhas com criar/editar/arquivar/reabrir.
- `AdminCampanhaDetalhe.tsx` — abas: Inscritos (tabela com filtros/ordenação/paginação/cancelar, exportações CSV/Excel/PDF usando libs já existentes), Cursos vinculados (multi-select de `courses`), Dashboard (gráficos Recharts: inscrições/dia, por cidade, por estado, ocupação), Configurações (manter_acesso_cursos, aprovação automática, datas, vagas).

**Liberação de cursos**: a página `/courses` continua usando RLS; com `can_access_course` estendida, os cursos vinculados aparecem automaticamente para inscritos. Em `CooperadosEventuaisDetalhe` também há atalho listando os cursos vinculados após inscrição.

## Detalhes técnicos

- Protocolo: sequência por ano via função plpgsql que conta inscrições do ano + 1, formato `CPB-{YYYY}-{NNNNNN}`.
- Encerramento automático: função/trigger que marca `status='encerrada'` quando `vagas_ocupadas >= limite_vagas` ou `data_fim < CURRENT_DATE` (verificado no SELECT via view ou na RPC de inscrição).
- Cancelamento: RPC `cancelar_inscricao_eventual(_id, _motivo)` admin-only, decrementa vagas, grava auditoria.
- Exportações: CSV nativo, Excel via `xlsx` (já no projeto), PDF via `jspdf` (já no projeto para certificados).
- Estados brasileiros: array constante.
- LGPD: dados sensíveis (CPF/RG) só legíveis pelo próprio usuário e admin/moderador via RLS.

## Arquivos a criar/editar

Criar:
- `supabase/migrations/<novo>.sql` (tabelas, RLS, RPCs, triggers, realtime, extensão de `can_access_course`)
- `src/pages/CooperadosEventuaisList.tsx`
- `src/pages/CooperadosEventuaisDetalhe.tsx`
- `src/pages/admin/AdminCampanhas.tsx`
- `src/pages/admin/AdminCampanhaDetalhe.tsx`
- `src/lib/estados-br.ts`

Editar:
- `src/App.tsx` (rotas)
- `src/pages/Hub.tsx` (card)
- `src/components/AppSidebar.tsx` (item de menu para aluno e admin)

## Confirmação

Posso aplicar o plano? Após aprovação, executo a migration e implemento as páginas em sequência.
