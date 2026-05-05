import SEO from "@/components/SEO";

export default function Termos() {
  return (
    <>
      <SEO
        title="Termos de Uso — Coopaiba EAD"
        description="Termos de Uso da plataforma Coopaiba EAD: regras, direitos e responsabilidades de uso."
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="font-heading text-4xl font-bold text-foreground">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mt-2">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="mt-8 space-y-6 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">1. Aceitação</h2>
            <p>Ao criar uma conta na Coopaiba EAD, você concorda integralmente com estes Termos de Uso e com a Política de Privacidade.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">2. Cadastro</h2>
            <p>O usuário deve fornecer informações verdadeiras, completas e atualizadas. O acesso é pessoal e intransferível. Cadastros de cooperados passam por aprovação manual.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">3. Conteúdo</h2>
            <p>Todo o conteúdo (textos, vídeos, materiais e marcas) é protegido por direitos autorais e destinado exclusivamente ao uso pessoal e educacional do usuário cadastrado. É proibida a redistribuição.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">4. Conduta</h2>
            <p>É vedado: tentar burlar mecanismos de segurança, compartilhar credenciais, publicar conteúdo ofensivo no fórum, automatizar acessos ou utilizar a plataforma para fins ilícitos.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">5. Certificados</h2>
            <p>Os certificados são emitidos após cumprimento dos requisitos de cada curso, com código único e QR para validação pública. A Coopaiba pode revogar certificados em caso de fraude.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">6. Suspensão</h2>
            <p>A Coopaiba pode suspender ou encerrar contas que violem estes Termos, sem aviso prévio em casos graves.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">7. Alterações</h2>
            <p>Estes Termos podem ser atualizados. A continuidade de uso após a publicação implica concordância com a nova versão.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">8. Contato</h2>
            <p>Dúvidas: utilize o canal de suporte da plataforma após o login.</p>
          </section>
        </div>
      </section>
    </>
  );
}
