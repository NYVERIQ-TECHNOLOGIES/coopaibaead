# Aulas ao Vivo (Google Meet) + Gravação → Aula do curso

Sistema completo de aulas ao vivo integrado a cursos/módulos/aulas, com Google Meet real, presença, notificações e publicação da gravação como aula.

## Limitações reais do Google (importante)

Antes de tudo, o que a API do Google permite de fato:

- **Criar reunião**: totalmente possível. Criamos o evento no Google Calendar com `conferenceData` e recebemos link do Meet, `eventId` e `conferenceId`. Real, automático.
- **Ligar a gravação por API**: **não é possível**. O Google não expõe API para forçar gravação. A gravação precisa do plano Workspace (Business Standard ou superior) e é iniciada pelo organizador no Meet, ou automaticamente via política do Workspace Admin ("gravar automaticamente" por tipo de reunião).
- **Recuperar a gravação**: possível via **Google Meet REST API** (`conferenceRecords` → `recordings`), que devolve o arquivo no Drive do organizador. Aí sim o sistema baixa e reprocessa.

Portanto a arquitetura fica: criamos a reunião, monitoramos o fim da conferência, buscamos a gravação pela Meet API, **baixamos o arquivo para o storage da plataforma** e publicamos como aula. Se a conta não tiver gravação disponível, o sistema mostra estado claro e permite upload manual do vídeo — sem botões falsos.

## Autenticação Google por professor

Cada professor conecta a própria conta Google (App User Connector do Google Calendar/Meet). Tokens ficam só no servidor; nunca no navegador, nunca senha.

## Banco de dados

- `live_classes` — curso, módulo (opcional, "decidir depois"), professor, título, descrição, `scheduled_at`, duração, `status` (agendada / ao_vivo / encerrada / processando / pronta / publicada / erro), `recording_enabled`, `provider` (google_meet | platform | zoom…), `meet_url`, `meet_event_id`, `meet_conference_id`, `google_account_email`, `recording_status`, `error_message`, `open_minutes_before`.
- `live_recordings` — vínculo com a aula ao vivo, curso, módulo, título, descrição, `storage_path`, thumbnail, duração, tamanho, status, `published_lesson_id`, `published_at`.
- `live_attendance` — aluno, entrada, saída, duração; registrada quando o aluno abre a aula pela plataforma.
- Bucket privado `gravacoes` com URLs assinadas de curta duração — nunca URL pública.
- RLS: admin acesso total; professor só as próprias aulas; aluno só aulas de cursos em que está matriculado (reaproveitando `can_access_course`).

## Backend (edge functions)

- `google-meet-connect` / status da conexão do professor.
- `live-class-create-meet` — cria evento + Meet, salva ids e link.
- `live-class-join` — valida matrícula, registra presença, devolve o link (o link nunca vai para o cliente sem essa checagem).
- `live-class-poll-recording` — detecta fim da conferência, busca a gravação na Meet API, baixa para o storage, gera thumbnail, marca "pronta para publicação"; com retry e log de erro.
- `live-class-publish` — cria a aula no módulo escolhido (ou cria o módulo), aponta para a gravação e notifica os alunos.
- Notificações in-app (tabela `notifications` já existente): 1 dia antes, 1 hora, 15 minutos, ao vivo, gravação pronta, aula publicada. Estrutura pronta para e-mail/WhatsApp depois.

## Interface

**Professor/admin** — nova aba "Aulas ao Vivo" no hub de Ensino:
- Dashboard com cards (próximas, realizadas, processando, gravadas) e tabela com status e ações (editar, entrar, copiar link, ver/editar gravação, publicar, excluir).
- Assistente "Criar Aula ao Vivo": curso → módulo (ou "+ criar módulo" / "decidir depois") → título, descrição, data, hora, duração → gravar automaticamente → conectar Google e criar Meet, ou usar link existente.
- Tela de confirmação com copiar link, adicionar ao Calendar, convidar alunos.
- Tela "Revisar Aula Gravada": player, thumbnail, título, descrição, módulo, ordem, rascunho ou publicar.

**Aluno** — seção "Aulas ao Vivo" na página do curso:
- Card da próxima aula com contagem regressiva (dias/horas/minutos → "começa em 15 minutos" → 🔴 AO VIVO), professor, data, status e botão "Entrar na aula" liberado conforme a janela definida pelo admin.
- Aviso de que a aula será gravada e ficará disponível no curso.
- Depois de publicada, a gravação vira aula normal do módulo, entra no progresso e é assistida no player da plataforma.

**Player próprio**: play/pause, barra de progresso, volume, tela cheia, velocidades 0.5x–2x, legendas quando houver, retomar de onde parou, marcar como concluída.

Tudo responsivo, com o visual atual (cards, badges, modais, toasts, skeletons, estados vazios).

## Ordem de execução

1. Migração do banco + bucket + RLS.
2. Conexão Google do professor e criação real do Meet.
3. Painel do professor e assistente de criação.
4. Área do aluno, contagem regressiva e entrada controlada com presença.
5. Captura/processamento da gravação e publicação como aula.
6. Player e integração com o progresso.
7. Notificações.
8. Teste ponta a ponta e correções.

## O que precisarei de você

- Uma conta Google (de preferência Workspace) para conectar e validar o fluxo real.
- Confirmar se o Workspace tem gravação habilitada; sem isso, o fluxo funciona até a transmissão e a publicação usa upload do vídeo.
