import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Award, Users, ShieldCheck, GraduationCap, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { session, role, loading } = useAuth();
  if (!loading && session && role) {
    const dest = role === "admin" || role === "moderador" ? "/app" : "/student";
    return <Navigate to={dest} replace />;
  }
  return (
    <>
      <SEO
        title="Coopaiba EAD — Educação Cooperativista Online"
        description="Plataforma de educação cooperativista com cursos, certificação e validação pública. Formação para cooperados, jovens, mulheres e comunidade."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "Coopaiba EAD",
          description: "Plataforma de educação cooperativista online",
          url: typeof window !== "undefined" ? window.location.origin : "",
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-[0.04]" aria-hidden />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Plataforma EAD Cooperativista
            </div>
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Conhecimento que <span className="text-primary">transforma</span> cooperativas
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              Cursos, trilhas e certificados pensados para cooperados, jovens, mulheres e a comunidade.
              Aprenda no seu ritmo, com qualidade e segurança.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Começar agora <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/cursos"
                className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg font-medium text-foreground hover:bg-muted transition-colors"
              >
                Ver cursos
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <div className="aspect-[4/3] rounded-2xl gradient-primary p-1 shadow-elevated">
              <div className="w-full h-full rounded-xl bg-card flex items-center justify-center">
                <GraduationCap className="w-32 h-32 text-primary/30" strokeWidth={1.2} />
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-xl px-4 py-3 shadow-card flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Certificados</p>
                <p className="text-sm font-bold text-foreground">com QR validável</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              Educação séria, cooperativismo na prática
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para aprender, evoluir e comprovar suas conquistas.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: BookOpen, title: "Cursos completos", desc: "Aulas em vídeo, materiais, fórum e avaliações por módulo." },
              { icon: Award, title: "Certificação oficial", desc: "Certificados com código único e QR para validação pública." },
              { icon: ShieldCheck, title: "Seguro e confiável", desc: "Autenticação protegida, dados em conformidade com a LGPD." },
              { icon: Users, title: "Comunidade ativa", desc: "Fórum, suporte e acompanhamento direto pela administração." },
              { icon: GraduationCap, title: "Trilhas para todos", desc: "Conteúdos para cooperados, jovens, mulheres e comunidade." },
              { icon: Sparkles, title: "Acesso exclusivo", desc: "Cursos especiais para cooperados verificados." },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-6 shadow-card">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              Quem aprende com a gente
            </h2>
            <p className="mt-3 text-muted-foreground">Histórias reais de cooperados e alunos.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Maria S.",
                role: "Cooperada",
                quote: "Os cursos me ajudaram a entender melhor o cooperativismo e participar mais ativamente.",
              },
              {
                name: "João P.",
                role: "Jovem aprendiz",
                quote: "Plataforma simples, com aulas objetivas e certificado que vale de verdade.",
              },
              {
                name: "Ana L.",
                role: "Educadora",
                quote: "Conteúdo cuidadoso e acessível. Recomendo para qualquer cooperativa.",
              },
            ].map((t) => (
              <figure key={t.name} className="bg-card border border-border rounded-xl p-6 shadow-card">
                <blockquote className="text-foreground text-sm leading-relaxed">"{t.quote}"</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Prévia de planos */}
      <section className="py-16 md:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground">
              Planos para todo perfil
            </h2>
            <p className="mt-3 text-muted-foreground">Comece grátis. Evolua quando quiser.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { name: "Gratuito", price: "R$ 0", desc: "Cursos públicos e fórum." },
              { name: "Premium", price: "R$ 29/mês", desc: "Todos os cursos pagos e trilhas.", highlight: true },
              { name: "Cooperado", price: "Exclusivo", desc: "Conteúdos da cooperativa." },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-xl p-6 border ${
                  p.highlight ? "border-primary bg-card shadow-elevated" : "border-border bg-card shadow-card"
                }`}
              >
                <p className="font-heading font-semibold text-foreground">{p.name}</p>
                <p className="font-heading text-2xl font-bold text-foreground mt-1">{p.price}</p>
                <p className="text-sm text-muted-foreground mt-2">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              to="/planos"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted"
            >
              Comparar planos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl gradient-primary p-10 md:p-14 text-center text-primary-foreground shadow-elevated">
            <h2 className="font-heading text-3xl md:text-4xl font-bold">Pronto para começar?</h2>
            <p className="mt-3 opacity-90 max-w-xl mx-auto">
              Crie sua conta gratuita e tenha acesso aos cursos públicos da plataforma.
            </p>
            <Link
              to="/register"
              className="mt-7 inline-flex items-center gap-2 px-6 py-3 bg-card text-primary rounded-lg font-medium hover:opacity-95 transition-opacity"
            >
              Criar minha conta <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
