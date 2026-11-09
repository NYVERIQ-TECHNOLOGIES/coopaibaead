# Plano: aulas ao vivo, reuniões, notificações e campanha

Proposta sugerida (nada será alterado até você aprovar). Pode riscar ou mudar qualquer item.

## 1. Aulas ao vivo
- Cartão de cada aula mostra claramente: data/hora, situação (Agendada, Ao vivo, Encerrada) e botão "Entrar" que só aparece perto do horário.
- Novo campo ao criar a aula: "Avisar alunos" (lembretes de 1 dia, 1 hora e 15 minutos antes, marcados por padrão).
- Proteção do envio de avisos: hoje o envio dos lembretes aceita chamadas sem identificação; passa a aceitar só o agendador da plataforma ou um administrador/professor.

## 2. Reuniões
- Mesmos lembretes das aulas (1 dia, 1 hora, 15 minutos) para os convidados autorizados.
- Aviso imediato ao convidado quando for adicionado ou quando o pedido de entrada for aceito/recusado.
- Selos do cartão (Agendada, Em andamento, Encerrada, Google Meet) com o mesmo padrão visual das aulas ao vivo.

## 3. Notificações
- Sino no topo com contador de não lidas e lista agrupada: Aulas ao vivo, Reuniões, Campanhas, Cursos.
- Botão "Marcar todas como lidas" e clique abre direto a aula/reunião/campanha.
- Página "Minhas notificações" com preferências por tipo (ligar/desligar lembretes; avisos obrigatórios do administrador não podem ser desligados).
- WhatsApp continua opcional e só para quem tem telefone cadastrado.

## 4. Campanha
- Ao criar uma campanha, escolher público: todos, uma cooperativa, um curso ou um papel (aluno, cooperado, professor).
- Pré-visualização da mensagem e da quantidade de pessoas antes de enviar.
- Envio pela notificação da plataforma (e WhatsApp, se marcado), com relatório: enviadas, lidas e cliques.
- Atalho para divulgar uma aula ao vivo ou reunião como campanha.

## Detalhes técnicos
- Telas: `LiveClasses.tsx`, `Meetings.tsx`, `AdminCampanhas.tsx`, `AdminCampanhaDetalhe.tsx`, sino no `AppLayout`.
- `live-classes-notify`: exigir segredo do agendador ou usuário com papel admin/moderador/professor; estender janelas para `meetings` usando `meeting_participants`.
- Tabela `notification_preferences` (por usuário e tipo) com RLS do próprio usuário; campanhas registram entregas/leituras em tabela própria com leitura só para admin/moderador.
- Testes para: janelas de lembrete, bloqueio de chamada anônima e filtro de público da campanha.
