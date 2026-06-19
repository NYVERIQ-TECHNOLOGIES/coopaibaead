import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, KeyRound, Database, FileCheck2, Mail } from "lucide-react";

export default function Seguranca() {
  return (
    <>
      <SEO
        title="Segurança e Privacidade — Coopaiba EAD"
        description="Como a Coopaiba EAD protege seus dados: autenticação, controles de acesso, criptografia em trânsito, retenção e canal de contato."
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground border border-border rounded-full px-3 py-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Página mantida pela Coopaiba
          </div>
          <h1 className="font-heading text-4xl font-bold text-foreground">
            Segurança & Privacidade
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta página é mantida pela administração da Coopaiba para responder dúvidas comuns
            sobre segurança e privacidade na plataforma Coopaiba EAD. Não é uma certificação
            independente.
          </p>
        </header>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Autenticação e contas</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            O acesso à plataforma exige login com e-mail e senha. Senhas nunca são armazenadas
            em texto plano. Disponibilizamos autenticação em duas etapas (2FA) para reforçar a
            proteção das contas. Cadastros de cooperados passam por aprovação manual da
            administração.
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Controles de acesso por papel</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Cada funcionalidade respeita o papel do usuário (aluno, cooperado, moderador,
            administrador). As regras de acesso são aplicadas no banco de dados via Row Level
            Security, e não dependem apenas do código do navegador.
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Criptografia em trânsito</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Todo o tráfego entre o navegador e a plataforma é feito sobre HTTPS/TLS. Conteúdos
            sensíveis, como assinaturas de presença, são servidos por URLs assinadas de curta
            duração.
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Dados que coletamos</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Coletamos apenas os dados necessários para operar a plataforma: cadastro do usuário,
            progresso nos cursos, certificados emitidos e registros técnicos de acesso para
            segurança. Detalhes completos estão na nossa{" "}
            <Link to="/privacidade" className="text-primary underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Certificados e auditoria</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Cada certificado recebe um código único validável em{" "}
            <Link to="/validar-certificado" className="text-primary underline">
              /validar-certificado
            </Link>
            . Reemissão, cancelamento e retirada presencial geram registros de auditoria
            permanentes.
          </p>
        </article>

        <article className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-heading text-xl font-semibold">Reportar um problema de segurança</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Se você acredita ter encontrado uma vulnerabilidade, utilize o canal de{" "}
            <Link to="/contato" className="text-primary underline">contato</Link> ou o suporte
            interno após o login. Pedimos que não divulgue publicamente até nossa equipe ter a
            chance de avaliar e corrigir.
          </p>
        </article>

        <p className="text-xs text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}.
        </p>
      </section>
    </>
  );
}
