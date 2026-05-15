# Coopaiba Presença Digital

Sistema completo de assinatura digital de listas de presença para cooperados, integrado ao app existente (mesma stack, mesmo design system verde institucional, mesmo Auth/Cloud).

## Escopo

Adicionar um novo módulo (`/presenca`) ao app autenticado, com fluxo público de assinatura via QR Code (`/p/:codigo`), sem exigir login do cooperado.

## Estrutura de dados (migration)

Novas tabelas em `public`:

- **presenca_eventos**
  - `id, codigo (text único curto), nome, tipo, descricao, data, horario, local, responsavel, expected_count, status ('aberto'|'encerrado'), created_by, created_at, updated_at`
- **presenca_assinaturas**
  - `id, evento_id (fk), cooperado_user_id (nullable), nome, cpf, matricula, assinatura_url (text), assinatura_tipo ('desenho'|'digitada'|'checkin'), horario timestamptz, ip, user_agent, created_at`
  - Unique parcial: `(evento_id, cpf)` quando cpf não nulo; `(evento_id, matricula)` quando matricula não nula.

RLS:
- `presenca_eventos`: admins gerenciam; leitura pública apenas via RPC `get_evento_publico(_codigo)` (security definer) que retorna apenas dados não sensíveis e somente se `status='aberto'`.
- `presenca_assinaturas`: SELECT só admin/moderador; INSERT via RPC `registrar_presenca(...)` (security definer) que valida duplicidade, status do evento, formato CPF/matrícula, e grava IP/UA.

Buckets storage:
- `assinaturas` (privado) — PNGs base64 das assinaturas, path `evento_id/uuid.png`. Acesso de leitura via signed URL para admin.

## Edge functions

- `registrar-presenca` (verify_jwt=false): recebe `{ codigo, nome, cpf, matricula, assinaturaBase64, tipo }`, valida com Zod, faz upload da assinatura, chama RPC `registrar_presenca`. Rate-limit por IP.
- `exportar-presencas` (admin): gera CSV/PDF da lista por evento.

## Frontend

Novas páginas:

- **Admin (autenticado, role admin/moderador)**
  - `/presenca` — dashboard: cards de eventos (status, contador em tempo real via realtime), busca, filtros.
  - `/presenca/novo` — formulário de criação do evento.
  - `/presenca/:id` — detalhes: QR Code (lib `qrcode.react`), link copiável, lista de assinaturas em tempo real (realtime na tabela), busca por nome, exportar PDF/Excel, encerrar evento.
  - `/presenca/relatorios` — histórico, frequência por cooperado, eventos mais participados (gráficos com `recharts` já no projeto).

- **Público (sem auth)**
  - `/p/:codigo` — tela mobile-first: dados do evento, formulário (nome, CPF com máscara, matrícula), canvas de assinatura touch (`react-signature-canvas`) com opções "desenhar" / "digitar" / "check-in", botão grande de confirmar. Após sucesso: tela de confirmação com horário.

Componentes novos:
- `SignaturePad` (wrapper do canvas com clear/undo).
- `EventoCard`, `PresencaTable`, `QRCodeDisplay`.

Sidebar: adicionar item "Presença Digital" (ícone `ClipboardCheck`) para admin/moderador.

Rota pública `/p/:codigo` registrada fora do `ProtectedRoute` em `App.tsx`.

## Bibliotecas a adicionar

- `qrcode.react` — geração de QR Code
- `react-signature-canvas` — canvas de assinatura
- `jspdf` + `jspdf-autotable` — export PDF
- `xlsx` — export Excel

## Detalhes técnicos

- Identidade visual: usar tokens existentes (verde institucional já no design system); cards `rounded-xl`, layout SaaS premium consistente com Dashboard atual.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.presenca_assinaturas;` para atualizar contador ao vivo.
- LGPD: CPF armazenado apenas com consentimento exibido no formulário; assinaturas em bucket privado.
- Validação CPF (algoritmo dos dígitos verificadores) tanto no client quanto na RPC.
- Código curto do evento: 6 caracteres alfanuméricos (gerado no insert via trigger).

## Não escopo

- App nativo (PWA install prompt fica para depois).
- Reconhecimento facial / biometria.
- Integração com sistema externo de cooperados além das tabelas atuais.

Confirma que posso seguir com essa implementação?