# Coopaiba Ead

Atue como um arquiteto de software sênior e desenvolvedor full stack especialista em plataformas educacionais (EAD). Crie uma plataforma EAD completa, moderna, escalável, segura e responsiva, com arquitetura profissional, separação de camadas (front-end, back-end e banco de dados) e foco em performance, usabilidade e conformidade com a LGPD. A plataforma será voltada para educação cooperativista e deve suportar dois tipos de alunos: - Aluno comum - Aluno cooperado Também deve conter um painel administrativo completo. ======================== 🏗️ ARQUITETURA DO SISTEMA ======================== - Frontend: React (Next.js) ou Vue (Nuxt) - Backend: Node.js (NestJS) ou Laravel - Banco: PostgreSQL - Autenticação: JWT + Refresh Token + 2FA - Storage: S3 ou equivalente - API: REST ou GraphQL - Deploy: Cloud (AWS, Vercel ou similar) Estrutura: - /frontend - /backend - /database - /docs ======================== 👥 TIPOS DE USUÁRIOS ======================== 1. ADMINISTRADOR 2. ALUNO 3. ALUNO COOPERADO ======================== 🎯 FUNCIONALIDADES PRINCIPAIS ======================== 📊 DASHBOARD - Métricas: alunos, cooperados, cursos, conclusão, frequência, certificados - Gráficos interativos - Alertas de evasão - Ranking de cursos - Calendário acadêmico 📚 CURSOS - CRUD completo - Trilhas de aprendizagem - Módulos e aulas - Tipos de conteúdo: vídeo, PDF, áudio, texto - Liberação progressiva - Cursos exclusivos para cooperados 📍 PRESENÇA - Registro manual e automático - Presença por tempo assistido - QR Code para eventos presenciais - Relatórios por aluno e cooperado - Regras de aprovação por frequência 📈 PROGRESSO - Barra de progresso - Tempo de estudo - Último acesso - Status (andamento, concluído, reprovado) - Dashboard exclusivo para cooperados 📝 ATIVIDADES - Objetivas e discursivas - Upload de arquivos - Correção automática/manual - Feedback do tutor 📊 AVALIAÇÕES - Provas online com temporizador - Banco de questões - Embaralhamento - Relatórios de desempenho 📖 BIBLIOTECA - Conteúdos online e offline - Busca avançada - Organização por categoria - Biblioteca exclusiva para cooperados - Histórico de leitura 🎓 CERTIFICADOS - Geração automática (PDF) - Baseado em template - QR Code de validação - Código único - Diferenciação entre aluno e cooperado 🔐 LGPD E SEGURANÇA - Consentimento de dados - Política de privacidade - Criptografia de senha - Controle de acesso (RBAC) - Logs de auditoria - Solicitação de dados pelo usuário: - acesso - correção - exclusão - Sessões seguras - 2FA 💬 OUTROS - Fórum - Chat aluno/tutor - Notificações - Gamificação - FAQ - Suporte interno - Integração com WhatsApp - API pública ======================== 📊 BANCO DE DADOS (MODELO) ======================== Crie tabelas para: - users - roles - cooperatives - courses - modules - lessons - enrollments - attendance - progress - activities - submissions - exams - questions - answers - grades - library - files - certificates - certificate_templates - notifications - logs - lgpd_consents - data_requests - support_tickets ======================== 📱 INTERFACE ======================== - Design moderno (UI/UX profissional) - Responsivo (mobile-first) - Tema claro/escuro - Navegação lateral - Dashboards separados por perfil ======================== 📦 ENTREGÁVEIS ======================== 1. Estrutura de pastas 2. Modelagem do banco (SQL) 3. Diagrama do sistema 4. Mapa de telas 5. Fluxo do usuário 6. Regras de negócio 7. Código inicial (frontend + backend) 8. APIs documentadas 9. Painel admin funcional 10. Área do aluno 11. Área do aluno cooperado 12. Sistema de certificados 13. Biblioteca digital 14. Controle de presença 15. Documentação técnica completa ======================== ⚙️ DIFERENCIAL (IMPORTANTÍSSIMO) ======================== - Sistema multi-cooperativa - Segmentação por comunidade/região - Dashboard exclusivo para cooperativismo - Indicadores: - participação - engajamento - assiduidade - impacto social ======================== 🎯 OBJETIVO FINAL ======================== Gerar uma base real de sistema pronto para produção, com código limpo, escalável e preparado para expansão futura.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://coopaibaead.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e31127c3-135d-408d-bc68-803e74fb3989).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
