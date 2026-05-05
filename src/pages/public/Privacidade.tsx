import SEO from "@/components/SEO";

export default function Privacidade() {
  return (
    <>
      <SEO
        title="Política de Privacidade — Coopaiba EAD"
        description="Política de Privacidade da Coopaiba EAD em conformidade com a LGPD. Saiba como tratamos seus dados pessoais."
      />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="font-heading text-4xl font-bold text-foreground">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mt-2">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="mt-8 space-y-6 text-sm text-foreground leading-relaxed">
          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">1. Quem somos</h2>
            <p>Coopaiba EAD — plataforma de educação cooperativista. Somos a controladora dos dados pessoais coletados nesta plataforma, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">2. Dados coletados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cadastro: nome, e-mail, CPF, cooperativa (quando aplicável), foto de perfil (opcional).</li>
              <li>Uso: progresso em cursos, avaliações, certificados, registros de acesso.</li>
              <li>Técnicos: IP, navegador, dispositivo (para segurança e prevenção de fraudes).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">3. Bases legais</h2>
            <p>Tratamos dados com base em: execução de contrato (acesso ao serviço), consentimento (comunicações), cumprimento de obrigação legal e legítimo interesse (segurança, prevenção a fraudes).</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">4. Finalidades</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Autenticação e gestão da conta.</li>
              <li>Disponibilização e acompanhamento dos cursos.</li>
              <li>Emissão e validação de certificados.</li>
              <li>Segurança da plataforma e auditoria.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">5. Compartilhamento</h2>
            <p>Não vendemos dados. Compartilhamos apenas com prestadores de infraestrutura (hospedagem, autenticação, e-mail), sob obrigações de confidencialidade e segurança.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">6. Seus direitos (LGPD)</h2>
            <p>Você pode solicitar: confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação sobre compartilhamento e revogação do consentimento. Use o suporte interno após o login ou contate a administração da cooperativa.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">7. Retenção</h2>
            <p>Mantemos os dados enquanto a conta estiver ativa e pelo período necessário ao cumprimento de obrigações legais. A exclusão da conta pode ser solicitada pelo próprio usuário nas configurações.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">8. Segurança</h2>
            <p>Aplicamos criptografia, controle de acesso por papéis, registros de auditoria e proteção contra abuso (rate limiting). Ainda assim, nenhum sistema é 100% imune — em caso de incidente, comunicaremos os titulares e a ANPD conforme a lei.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">9. Cookies</h2>
            <p>Utilizamos apenas cookies essenciais para autenticação e funcionamento da plataforma.</p>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold mb-2">10. Contato</h2>
            <p>Para exercer direitos ou tirar dúvidas sobre privacidade, utilize o suporte interno após o login.</p>
          </section>
        </div>
      </section>
    </>
  );
}
