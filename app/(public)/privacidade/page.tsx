export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Política de Privacidade
        </h1>
        <p className="text-muted-foreground mb-8 text-sm">
          Logvale Devoluções — versão 1.0 · vigência a partir de 14/05/2025
        </p>

        <div className="prose max-w-none text-foreground space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">1. Identificação do Controlador</h2>
            <p>
              O tratamento dos seus dados pessoais é realizado pela <strong>Logvale Soluções Logísticas Ltda.</strong>,
              inscrita no CNPJ sob o nº 00.000.000/0001-00, com sede na Av. das Américas, 1000, Sala 200,
              Rio de Janeiro/RJ, CEP 22640-100 (&ldquo;Logvale&rdquo; ou &ldquo;nós&rdquo;).
            </p>
            <p>
              Para questões relacionadas à privacidade, entre em contato pelo e-mail{' '}
              <a href="mailto:privacidade@logvale.com.br" className="text-primary underline">
                privacidade@logvale.com.br
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">2. Dados Pessoais Coletados</h2>
            <p>Coletamos os seguintes dados pessoais em razão da prestação dos nossos serviços:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Dados de identificação:</strong> nome completo, endereço de e-mail e telefone.</li>
              <li><strong>Dados operacionais:</strong> chaves de acesso fiscal (NF-e / DANFE), CEP de origem, número de RV (devolução).</li>
              <li><strong>Dados de imagem:</strong> fotografias de embalagens e itens devolvidos, vinculadas a cada registro de devolução.</li>
              <li><strong>Dados de acesso:</strong> endereço IP, data e hora de login e das ações realizadas no sistema.</li>
              <li><strong>Dados de consentimento:</strong> data e hora de aceite dos Termos de Uso e desta Política.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">3. Finalidades e Bases Legais</h2>
            <table className="w-full border-collapse text-xs mt-2">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="px-3 py-2 border border-border font-medium">Finalidade</th>
                  <th className="px-3 py-2 border border-border font-medium">Base Legal (LGPD)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-border">Gestão do fluxo de devoluções logísticas</td>
                  <td className="px-3 py-2 border border-border">Execução de contrato (art. 7º, V)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-border">Envio de notificações e alertas de prazo</td>
                  <td className="px-3 py-2 border border-border">Execução de contrato (art. 7º, V)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-border">Manutenção de registros fiscais e de auditoria</td>
                  <td className="px-3 py-2 border border-border">Obrigação legal (art. 7º, II)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-border">Segurança do sistema e prevenção a fraudes</td>
                  <td className="px-3 py-2 border border-border">Legítimo interesse (art. 7º, IX)</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-border">Criação de conta e envio de link de acesso</td>
                  <td className="px-3 py-2 border border-border">Consentimento e execução de contrato (art. 7º, I e V)</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">4. Compartilhamento de Dados</h2>
            <p>Seus dados podem ser compartilhados com os seguintes fornecedores de tecnologia que atuam como operadores:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Supabase Inc.</strong> — infraestrutura de banco de dados e autenticação, servidores localizados nos EUA, com cláusulas contratuais padrão da UE.</li>
              <li><strong>Google LLC (Google Workspace)</strong> — serviço de envio de e-mails transacionais via SMTP, servidores localizados nos EUA, com cláusulas contratuais padrão da UE.</li>
            </ul>
            <p className="mt-2">
              <strong>Não vendemos, alugamos ou cedemos seus dados pessoais a terceiros</strong> para fins de marketing ou outros fins não relacionados à prestação do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">5. Prazos de Retenção</h2>
            <table className="w-full border-collapse text-xs mt-2">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="px-3 py-2 border border-border font-medium">Tipo de dado</th>
                  <th className="px-3 py-2 border border-border font-medium">Prazo</th>
                  <th className="px-3 py-2 border border-border font-medium">Fundamento</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-border">Dados de devolução (RV, datas, decisões)</td>
                  <td className="px-3 py-2 border border-border">5 anos após processamento</td>
                  <td className="px-3 py-2 border border-border">Obrigação fiscal / LGPD art. 16</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-border">Fotografias de embalagens e itens</td>
                  <td className="px-3 py-2 border border-border">1 ano após processamento</td>
                  <td className="px-3 py-2 border border-border">Necessidade operacional</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-border">Dados de perfil (nome, e-mail, telefone)</td>
                  <td className="px-3 py-2 border border-border">Enquanto ativo; anonimizados após encerramento</td>
                  <td className="px-3 py-2 border border-border">Execução contratual</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-border">Registros de acesso (logs)</td>
                  <td className="px-3 py-2 border border-border">6 meses</td>
                  <td className="px-3 py-2 border border-border">Marco Civil da Internet (art. 15)</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">6. Seus Direitos como Titular</h2>
            <p>Nos termos da LGPD (art. 18), você tem os seguintes direitos:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Acesso:</strong> confirmar a existência de tratamento e obter cópia dos seus dados.</li>
              <li><strong>Correção:</strong> solicitar a atualização de dados incompletos ou desatualizados.</li>
              <li><strong>Portabilidade:</strong> exportar seus dados em formato estruturado (JSON) diretamente pelo sistema, por meio do botão &ldquo;Exportar dados&rdquo; disponível ao seu gerente.</li>
              <li><strong>Anonimização:</strong> solicitar ao seu gerente a anonimização dos seus dados identificadores quando encerrar o uso do sistema.</li>
              <li><strong>Revogação do consentimento:</strong> revogar o aceite dos termos a qualquer momento — isso implicará no encerramento do acesso ao sistema.</li>
              <li><strong>Reclamação à ANPD:</strong> apresentar reclamação à Autoridade Nacional de Proteção de Dados (anpd.gov.br).</li>
            </ul>
            <p className="mt-2">
              Para exercer seus direitos, entre em contato pelo e-mail{' '}
              <a href="mailto:privacidade@logvale.com.br" className="text-primary underline">
                privacidade@logvale.com.br
              </a>{' '}
              com o assunto &ldquo;Direitos LGPD&rdquo;. Responderemos em até 15 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">7. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais contra acesso não
              autorizado, perda, destruição ou divulgação indevida, incluindo criptografia em trânsito (TLS) e em repouso,
              controle de acesso baseado em funções (RBAC) e autenticação por link mágico (sem senhas armazenadas).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">8. Atualizações desta Política</h2>
            <p>
              Esta política pode ser atualizada periodicamente. Alterações relevantes serão comunicadas por e-mail
              com antecedência mínima de 10 dias. A continuidade do uso do sistema após essa data implica o aceite
              da versão atualizada.
            </p>
            <p className="mt-2 text-muted-foreground text-xs">Versão 1.0 — vigência a partir de 14/05/2025</p>
          </section>

        </div>
      </div>
    </div>
  )
}
