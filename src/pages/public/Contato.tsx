import { useState } from "react";
import { Mail, MessageSquare, Send, Loader2, MapPin } from "lucide-react";
import { z } from "zod";
import SEO from "@/components/SEO";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  subject: z.string().trim().min(3, "Informe um assunto").max(150),
  message: z.string().trim().min(10, "Mensagem muito curta").max(2000),
});

export default function Contato() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast({ title: "Verifique os campos", description: first || "Dados inválidos", variant: "destructive" });
      return;
    }
    setLoading(true);
    // Sem backend de e-mail ainda — abre o cliente de e-mail do usuário
    const body = `Nome: ${parsed.data.name}\nE-mail: ${parsed.data.email}\n\n${parsed.data.message}`;
    window.location.href = `mailto:contato@coopaiba.com.br?subject=${encodeURIComponent(
      parsed.data.subject
    )}&body=${encodeURIComponent(body)}`;
    setTimeout(() => {
      toast({ title: "Abrindo seu cliente de e-mail", description: "Caso não abra, escreva para contato@coopaiba.com.br" });
      setLoading(false);
    }, 600);
  };

  return (
    <>
      <SEO
        title="Contato — Coopaiba EAD"
        description="Fale com a Coopaiba EAD. Tire dúvidas, sugira cursos ou solicite informações sobre cooperativas e educação."
      />

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-20 grid md:grid-cols-2 gap-10">
        <div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground">Fale com a gente</h1>
          <p className="mt-4 text-muted-foreground">
            Tem uma dúvida, sugestão ou quer entender como sua cooperativa pode usar a Coopaiba EAD? Envie uma
            mensagem — respondemos rapidamente.
          </p>

          <div className="mt-8 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">E-mail</p>
                <a href="mailto:contato@coopaiba.com.br" className="text-sm text-muted-foreground hover:text-primary">
                  contato@coopaiba.com.br
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Suporte</p>
                <p className="text-sm text-muted-foreground">Após o login, use o canal interno de suporte.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Atendimento</p>
                <p className="text-sm text-muted-foreground">Online, de segunda a sexta, 9h às 18h.</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card space-y-4">
          <div>
            <label htmlFor="contato-nome" className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
            <input
              id="contato-nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={100}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label htmlFor="contato-email" className="text-sm font-medium text-foreground mb-1.5 block">E-mail</label>
            <input
              id="contato-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label htmlFor="contato-assunto" className="text-sm font-medium text-foreground mb-1.5 block">Assunto</label>
            <input
              id="contato-assunto"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              maxLength={150}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Como podemos ajudar?"
            />
          </div>
          <div>
            <label htmlFor="contato-mensagem" className="text-sm font-medium text-foreground mb-1.5 block">Mensagem</label>
            <textarea
              id="contato-mensagem"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              maxLength={2000}
              rows={5}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Escreva sua mensagem..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 gradient-primary text-primary-foreground font-medium py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar mensagem
          </button>
        </form>
      </section>
    </>
  );
}
