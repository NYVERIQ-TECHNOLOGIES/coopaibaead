import { Target, Heart, Users, Globe } from "lucide-react";
import SEO from "@/components/SEO";

export default function Sobre() {
  return (
    <>
      <SEO
        title="Sobre — Coopaiba EAD"
        description="Conheça a Coopaiba EAD: missão, valores e atuação na educação cooperativista para cooperados, jovens, mulheres e comunidade."
      />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">Sobre a Coopaiba EAD</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Somos uma plataforma de educação cooperativista criada para fortalecer pessoas, cooperativas e
          comunidades através do conhecimento. Acreditamos que cooperação e educação caminham juntas para
          gerar desenvolvimento real.
        </p>

        <div className="grid sm:grid-cols-2 gap-6 mt-12">
          {[
            { icon: Target, title: "Missão", desc: "Democratizar o acesso à educação cooperativista de qualidade, com tecnologia e propósito." },
            { icon: Heart, title: "Valores", desc: "Cooperação, transparência, respeito, compromisso com o desenvolvimento humano." },
            { icon: Users, title: "Para quem", desc: "Cooperados, jovens, mulheres e qualquer pessoa interessada em aprender e crescer." },
            { icon: Globe, title: "Alcance", desc: "Conteúdo 100% online, acessível de qualquer lugar, no seu ritmo." },
          ].map((b) => (
            <div key={b.title} className="bg-card border border-border rounded-xl p-6 shadow-card">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <b.icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-heading font-semibold text-foreground">{b.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 prose prose-sm max-w-none">
          <h2 className="font-heading text-2xl font-bold text-foreground">Como funciona</h2>
          <p className="text-muted-foreground mt-3">
            Você se cadastra, escolhe um curso, assiste às aulas e realiza as avaliações. Ao concluir, recebe
            um certificado oficial com código único e QR Code, que pode ser validado publicamente em nossa
            página de validação. Cooperados verificados têm ainda acesso a conteúdos exclusivos.
          </p>
        </div>
      </section>
    </>
  );
}
