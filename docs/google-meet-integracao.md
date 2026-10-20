# Integração do Google Meet — Coopaiba EAD

Documento de entrega da integração oficial do Google Meet nos módulos **Reuniões** e **Aulas ao Vivo**, conforme o plano de execução (diagnóstico → plano → implementação → segurança → testes → entrega).

## 1. Mecanismo de integração

Integração **oficial Google** via:

- **OAuth 2.0** — App User Connector `google_calendar` (gateway Lovable `connector-gateway.lovable.dev`), já existente e em uso pelo módulo de Aulas ao Vivo. Escopos atuais: `userinfo.email`, `userinfo.profile`, `calendar.events`, `calendar.readonly`.
- **Google Calendar API** — `POST /calendar/v3/calendars/primary/events?conferenceDataVersion=1` com `conferenceData.createRequest.conferenceSolutionKey.type = "hangoutsMeet"`, que gera o link oficial do Google Meet.
- **Acesso à videoconferência** — o link real (`https://meet.google.com/...`) é aberto em **nova aba** no ambiente oficial do Google Meet. Não há iframes, proxies, scripts de DOM ou qualquer método não oficial de incorporação/ocultação da interface do Meet.

**Google Meet Embed SDK não foi adotado**: a modalidade de incorporação exige configuração própria no Google Workspace além dos escopos atuais do connector, e não está disponível para este projeto. A abertura em nova aba é o caminho oficialmente suportado e já utilizado pela plataforma.

## 2. O que foi implementado

### 2.1 Banco de dados — `drizzle/migrations/0004_meetings_google_meet.sql`

- `meetings.provider` (`nativo` | `google_meet`, default `nativo`): registros históricos permanecem como sala nativa; o formulário padroniza novas reuniões em `google_meet` quando a conta Google está conectada.
- Nova tabela **`meeting_google_links`** (PK `meeting_id`, `meet_url`, `meet_event_id`, `meet_conference_id`, `google_account_email`, `updated_at`):
  - `CHECK (meet_url ~ '^https://meet\.google\.com/')` — somente links reais do Meet.
  - **RLS `SELECT USING (meeting_can_enter(...))`**: o link privado só é legível por quem pode entrar (expedidor de solicitação pendente, banido ou sala bloqueada não enxerga o link), enquanto `meetings` segue visível a `meeting_can_view` apenas com o campo `provider`, que não é sensível.
  - Sem policies de INSERT/UPDATE/DELETE para `authenticated` (default deny) e `GRANT SELECT` apenas — somente o service role escreve.
- Nenhum dado existente foi alterado ou removido.

### 2.2 Edge Function — `supabase/functions/meeting-create-meet/index.ts`

Padrão idêntico ao `live-class-create-meet` (auth manual via `supabase.auth.getUser()`, `verify_jwt = false` em `config.toml`):

- **Autorização no servidor**: `meeting_is_manager(meetingId, auth.uid())` via service role (admin + responsáveis da reunião) — nada de checagem só no frontend.
- **`action: "create"` (padrão)** — idempotente: se já existe link, devolve o existente (evita duplicar eventos); senão cria o evento no Calendar com `hangoutsMeet`, grava `meeting_google_links` e seta `provider = 'google_meet'`.
- **`action: "update"`** — sincroniza título/descrição/horários do evento existente.
- **`action: "cancel"`** — cancela o evento no Calendar (usado ao cancelar/excluir reunião; falha é best-effort com aviso claro, nunca bloqueia a ação da plataforma).
- Chave de conexão buscada para `created_by` com fallback para o usuário chamador; token OAuth permanece cifrado server-side (`APP_USER_CONNECTION_KEY_SECRET`). Nenhum segredo no frontend.

### 2.3 Página de Reuniões — `src/pages/Meetings.tsx` (página existente, sem duplicação)

- `GoogleConnectCard` + `useGoogleStatus` no topo (admin, quem pode criar).
- Campo **Videoconferência** no formulário: `Google Meet` (padrão quando conectado) | `Sala da plataforma` (opção nativa preservada).
- Ao salvar com Google: cria a sala via `meeting-create-meet`; em falha, **aviso** ("Reunião salva, mas não foi possível criar a sala…") sem link fictício e com retentativa pela edição. Em edição com link existente, sincroniza o evento (`update`).
- Cartão: badge **Google Meet**; botão **"Entrar na reunião"** abre o `meet_url` real (buscado via RLS) em nova aba, ou `/reuniao/:token` no fluxo nativo; copiar link usa o link correto; "regenerar link" apenas no nativo.
- Cancelar/excluir reunião Google também cancela o evento no Calendar (best-effort).
- Diálogo de detalhes: indica a videoconferência e oferece "Abrir no Google Meet".
- Listagens, filtros, histórico, presenças, gravações locais, notificações e permissões existentes permanecem intactos.

### 2.4 Sala de reunião — `src/pages/MeetingRoom.tsx`

- Reuniões `google_meet`: painel com **"Entrar no Google Meet"** (nova aba), copiar link, criar sala (gestor, quando não criada), iniciar/encerrar pela RPC existente `meeting_set_state`. O link só é buscado após `meeting_link_info` retornar `allowed = true`.
- Reuniões nativas: sala WebRTC, moderação, gravação local e solicitação de acesso **inalteradas**.

### 2.5 Aulas ao Vivo (integração existente reforçada)

- `LiveClassDialog.tsx`: padrão passa a ser **Google Meet** quando há conta conectada (nativo, sala instantânea e link externo continuam disponíveis).
- `MyLiveClasses.tsx`: aluno em aula não-nativa agora usa a RPC `entrar_aula_ao_vivo` (valida matrícula/curso, joga para presença) e abre o `meet_url` em nova aba — antes ia para a sala nativa mesmo em aulas Google.
- `live-class-create-meet`, `GoogleConnectCard`, gravação (`live-class-recording`), presenças e histórico permanecem como estavam.

## 3. Configurações externas necessárias

Já existentes no projeto (nenhuma nova):

1. Conector App User `google_calendar` + segredos server-side: `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY`, `LOVABLE_API_KEY`, `APP_USER_CONNECTION_KEY_SECRET` (Supabase secrets).
2. Conexão por usuário via página → `GoogleConnectCard` → `google-connect-start/complete`.
3. Deploy da nova função: `supabase functions deploy meeting-create-meet` + aplicação da migração `drizzle/migrations/0004_meetings_google_meet.sql` no banco.

A conta Google conectada precisa de permissão para criar eventos no Google Agenda com Meet (Google Workspace ou conta pessoal conforme regras do connector).

## 4. Segurança e LGPD

- Tokens/segredos OAuth somente no servidor; frontend só chama `supabase.functions.invoke`.
- Autorização validada no backend (`meeting_is_manager`, `meeting_can_enter`, RPCs existentes); RLS existentes preservadas.
- Link do Meet restrito a quem pode entrar (`meeting_can_enter`) e aberto no ambiente oficial do Meet — a autorização da plataforma **não** substitui os controles de admissão/lobby do Google Meet.
- Nenhum dado pessoal novo coletado; gravações continuam locais no fluxo nativo; nada de gravação/transcrição armazenada pela integração.
- Nenhuma política RLS ou tabela existente foi removida.

## 5. Testes executados

- `tsc -p tsconfig.app.json --noEmit` — sem erros.
- `eslint` nos arquivos alterados — 0 erros (apenas warnings pré-existentes do repositório).
- `vite build` — sucesso.
- `vitest run` — 1/1 aprovado.
- Revisão manual de código dos fluxos: criação idempotente, caminhos de erro (sem conexão, falha do Google, sem link retornado), gate `meeting_can_enter` antes de expor o link.

**Pendente de validação em ambiente publicado** (requer deploy + credenciais reais, conforme regra de não declarar conclusão sem validação real): criar reunião de teste pelo Google, confirmar link `meet.google.com` real, entrada de gestor e aluno autorizado, edição/cancelamento sincronizando o evento do Calendar, comportamento das permissões por perfil e RLS com o link privado.

## 6. Limitações conhecidas

- Sem incorporação do Meet na plataforma (ver seção 1) — a videoconferência abre em nova aba.
- Reuniões Google: presença/plataforma (`meeting_sessions`), gravação local e bloqueio/sinalização WebRTC são recursos da sala nativa; no Meet valem os controles nativos do Google (lobby, gravação do organizador etc.).
- Cancelamento/atualização do evento do Calendar é best-effort: a ação da plataforma sempre ocorre; se o Google falhar, exibe aviso.
- Evento do Calendar pertence à conta Google conectada do organizador.
- Gravações do Google Meet de reuniões (modo Meet) não são baixadas para a plataforma; em aulas ao vivo o fluxo `live-class-recording` continua disponível.
