import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";

const plans = [
  {
    name: "Gratuito",
    price: "R$ 0",
    period: "para sempre",
    highlight: false,
    features: [
      "Acesso aos cursos públicos",
      "Fórum da comunidade",
      "Certificado nos cursos gratuitos",
      "Validação pública de certificado",
    ],
    cta: "Criar conta grátis",
    to: "/register",
  },
  {
    name: "Premium",
    price: "R$ 29",
    period: "/mês",
    highlight: true,
    features: [
      "Tudo do Gratuito",
      "Acesso a todos os cursos pagos",
      "Trilhas e materiais avançados",
      "Suporte prioritário",
      "Certificados ilimitados",
    ],
    cta: "Assinar Premium",
    to: "/register",
  },
  {
    name: "Cooperado",
    price: "Exclusivo",
    period: "para cooperados",
    highlight: false,
    features: [
      "Conteúdos exclusivos da cooperativa",
      "Trilhas de formação cooperativista",
      "Verificação por CPF e cooperativa",
      "Certificado oficial da Coopaiba",
    ],
    cta: "Solicitar acesso",
    to: "/register",
  },
];

export default function Planos() {
  return (
    <>
      <SEO
        title="Planos — Coopaiba EAD"
        description="Escolha o plano ideal: Gratuito, Premium ou Cooperado. Educação cooperativista com cursos, certificação e validação pública."
      />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <header className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Planos transparentes
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">
            Escolha o plano que combina com você
          </h1>
          <p className="mt-3 text-muted-foreground">
            Comece grátis e evolua quando quiser. Cancele a qualquer momento.
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 flex flex-col ${
                p.highlight
                  ? "border-primary bg-card shadow-elevated md:scale-[1.02]"
                  : "border-border bg-card shadow-card"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-primary-foreground text-xs font-semibold">
                  Mais popular
                </span>
              )}
              <h2 className="font-heading text-xl font-bold text-foreground">{p.name}</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-bold text-foreground">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to={p.to}
                className={`mt-7 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-medium transition-opacity ${
                  p.highlight
                    ? "gradient-primary text-primary-foreground hover:opacity-90"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                {p.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Os preços são ilustrativos durante a fase de lançamento. A cobrança será ativada em breve com pagamento seguro.
        </p>
      </section>
    </>
  );
}
