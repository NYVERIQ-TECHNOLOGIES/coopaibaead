# Atualização do Sistema de Certificados — Coopaíba EAD

Mantém 100% do modelo, layout, código, QR Code e informações atuais do certificado. Apenas adiciona regras, status, controles e telas administrativas em volta do fluxo existente.

## 1. Banco de dados (migração)

Adicionar à tabela `certificates`:
- `delivery_mode` text — `download` (Aluno) ou `retirada` (Cooperado / Cooperado Eventual). Definido na geração com base no role do usuário.
- `reissue_count` int default 0 — quantidade de reemissões.
- `last_reissued_at` timestamptz — última reemissão.
- `last_reissued_by` uuid — quem fez a última reemissão.
- `error_message` text — preenchido quando status = `erro`.

Status já existentes continuam: `pendente`, `emitido`, `disponivel_retirada`, `retirado`, `cancelado`. Adicionar suporte ao status `erro`.

Trigger `certificates_protect_issuance`:
- Impede alteração de `code`, `issued_at` e `created_at` após emissão (somente service_role / admin via função pode contornar em casos extremos — neste fluxo, ninguém altera).

Novas funções SQL (SECURITY DEFINER):
- `reissue_certificate(_certificate_id uuid)` — regenera o PDF mantendo code/issued_at/QR, incrementa `reissue_count`, grava `last_reissued_at` + `last_reissued_by`, escreve log `reemitido` em `certificate_audit_log`.
- `auto_issue_certificate_on_completion(_course_id uuid)` — chamada pelo cliente quando o aluno conclui o curso (progress=100). Cria o certificado se ainda não existir e dispara a edge function de PDF.
  - Se role = `aluno` (sem ser cooperado) → `delivery_mode = 'download'`, status final `emitido`.
  - Se role = `cooperado` OU acesso via campanha eventual → `delivery_mode = 'retirada'`, status final `disponivel_retirada` + notificação automática.

## 2. Edge functions

- **`generate-certificate`** (existente): ajustar para
  - Detectar perfil (aluno vs cooperado/eventual) e setar `delivery_mode` + status final correto.
  - Em caso de falha, gravar status `erro` + `error_message` e log de auditoria.
- **`reissue-certificate`** (nova): regera o PDF para um certificado existente preservando `code`, `issued_at` e QR Code. Incrementa contador. Apenas admin.
- **`download-certificate`** (existente): bloquear download quando `delivery_mode = 'retirada'` e usuário não for staff (cooperado deve retirar presencialmente).

## 3. Frontend — Aluno (`/certificates` e `/certificates/:code/...`)

- Card por certificado mostrando o status com mensagem automática:
  - `pendente` → "Seu certificado está sendo emitido. Atualize a página em instantes."
  - `emitido` (aluno) → "Seu certificado já está disponível para download." + botões **Visualizar** e **Baixar PDF**.
  - `disponivel_retirada` (cooperado) → "Disponível para retirada na cooperativa..." + botão **Ver instruções de retirada** (página já existe).
  - `retirado` → confirmação com data.
  - `erro` → "Ocorreu um erro na emissão... Entre em contato."
- Botão **Reemitir** disponível para o próprio aluno apenas quando `delivery_mode = 'download'` e status final.

## 4. Frontend — Admin (`/admin/certificates` ou seção em Certificates para staff)

Tabela administrativa com colunas:
Nome, CPF, Perfil, Curso, Status, Data de conclusão, Data de emissão, Última reemissão, Nº de reemissões, Emitido por.

Ações por linha:
- **Emitir Certificado** (quando ainda não existe / status `erro`)
- **Reemitir Certificado**
- **Visualizar Certificado** (abre PDF inline)
- **Baixar PDF**
- **Confirmar Retirada** (apenas para `disponivel_retirada`, abre o dialog já existente de pickup)
- **Visualizar Histórico** (abre `CertificateAuditDialog` existente; agora também lista `reemitido`)

Filtros por status, perfil e curso. Busca por nome/CPF/código.

## 5. Auditoria e segurança

- Cada emissão, reemissão, disponibilização e retirada grava em `certificate_audit_log` (já existente). Adicionar ação `reemitido` ao mapa de labels do `CertificateAuditDialog`.
- QR Code do PDF continua apontando para `/validate/:code` (já existente, `validate_certificate` RPC).
- Trigger protege `code` e `issued_at` contra alteração.
- RLS mantida: aluno vê só seu certificado; admin/moderador veem tudo.

## 6. O que NÃO muda

- Template visual do certificado (HTML/PDF gerado pela função `generate-certificate`).
- Código de emissão (`CERT-xxxxxxxx`).
- QR Code e URL de validação.
- Tabela `certificates` (apenas adições de colunas, nenhuma remoção).
- Páginas públicas de validação e de retirada.

---

## Detalhes técnicos resumidos

Arquivos a criar:
- `supabase/migrations/<ts>_certificates_reissue_and_delivery.sql`
- `supabase/functions/reissue-certificate/index.ts`
- `src/pages/admin/AdminCertificates.tsx` (ou ampliar `src/pages/Certificates.tsx` quando staff)

Arquivos a editar:
- `supabase/functions/generate-certificate/index.ts` — delivery_mode + tratamento de erro.
- `supabase/functions/download-certificate/index.ts` — bloqueio para `retirada`.
- `src/pages/Certificates.tsx` — mensagens automáticas por status + botão reemitir aluno.
- `src/components/CertificateAuditDialog.tsx` — label `reemitido` já existe; sem mudança real.
- `src/App.tsx` — rota admin se for página separada.

Posso seguir com a implementação?