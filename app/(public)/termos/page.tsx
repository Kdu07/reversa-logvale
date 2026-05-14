export default function TermosPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Termos de Uso
        </h1>
        <p className="text-muted-foreground mb-8 text-sm">
          Logvale Devoluções — versão 1.0 · vigência a partir de 14/05/2025
        </p>

        <div className="prose max-w-none text-foreground space-y-8 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">1. Objeto</h2>
            <p>
              Estes Termos de Uso (&ldquo;Termos&rdquo;) regulam o acesso e a utilização da plataforma <strong>Logvale</strong>,
              sistema B2B de gestão de devoluções logísticas operado pela{' '}
              <strong>Logvale Soluções Logísticas Ltda.</strong>, CNPJ 00.000.000/0001-00 (&ldquo;Logvale&rdquo;).
            </p>
            <p>
              Ao aceitar estes Termos, você declara ter lido, compreendido e concordado com todas as condições aqui
              estabelecidas.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">2. Acesso ao Sistema</h2>
            <p>
              O acesso ao sistema é restrito a usuários cadastrados por um gerente da Logvale. Não há auto-cadastro.
              A autenticação é realizada por <strong>link mágico</strong> enviado ao e-mail institucional do usuário —
              não há senhas tradicionais.
            </p>
            <p className="mt-2">
              Suas credenciais de acesso são <strong>pessoais e intransferíveis</strong>. O compartilhamento de
              credenciais ou link de acesso com terceiros é expressamente vedado e pode resultar no encerramento
              imediato do acesso.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">3. Obrigações do Usuário</h2>
            <p>Ao utilizar o sistema, você se compromete a:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Utilizar o sistema exclusivamente para fins relacionados à gestão de devoluções logísticas autorizadas.</li>
              <li>Fornecer informações verdadeiras, completas e atualizadas ao registrar devoluções.</li>
              <li>Manter seu e-mail de acesso atualizado junto ao gerente responsável.</li>
              <li>Notificar imediatamente o gerente em caso de suspeita de uso não autorizado de sua conta.</li>
              <li>Respeitar os prazos de decisão estabelecidos pelo sistema (72 horas após o recebimento).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">4. Condutas Proibidas</h2>
            <p>É expressamente vedado:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Tentar acessar áreas do sistema para as quais não possui autorização.</li>
              <li>Realizar engenharia reversa, descompilar ou modificar qualquer parte do sistema.</li>
              <li>Realizar ataques de negação de serviço (DoS/DDoS) ou qualquer ação que prejudique a disponibilidade do sistema.</li>
              <li>Fazer upload de conteúdo ilícito, ofensivo, malicioso ou que viole direitos de terceiros.</li>
              <li>Utilizar ferramentas automatizadas (bots, scrapers) para acessar ou extrair dados do sistema.</li>
              <li>Falsificar informações de devoluções ou registros fiscais.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">5. Dados Pessoais e Privacidade</h2>
            <p>
              O tratamento dos seus dados pessoais é realizado em conformidade com a Lei Geral de Proteção de Dados
              (LGPD — Lei 13.709/2018) e detalhado em nossa{' '}
              <a href="/privacidade" className="text-primary underline">Política de Privacidade</a>,
              que integra estes Termos por referência.
            </p>
            <p className="mt-2">
              Ao aceitar estes Termos, você também consente com o tratamento dos seus dados conforme descrito na
              Política de Privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">6. Disponibilidade e Limitação de Responsabilidade</h2>
            <p>
              O sistema é fornecido &ldquo;no estado em que se encontra&rdquo; (<em>as-is</em>). A Logvale envidarará
              melhores esforços para manter o sistema disponível, mas <strong>não garante disponibilidade ininterrupta</strong> —
              podem ocorrer indisponibilidades para manutenção, atualizações ou por fatores fora do nosso controle.
            </p>
            <p className="mt-2">
              A Logvale não se responsabiliza por danos indiretos, lucros cessantes ou perdas decorrentes de
              indisponibilidade do sistema, desde que não causadas por dolo ou culpa grave da Logvale.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">7. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo do sistema — incluindo software, design, textos, logotipos e interfaces — é de
              propriedade exclusiva da Logvale ou de seus licenciadores. O uso do sistema não transfere ao usuário
              qualquer direito de propriedade intelectual sobre esses elementos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">8. Vigência e Rescisão</h2>
            <p>
              Estes Termos vigoram pelo período em que sua conta estiver ativa. O gerente pode desativar ou remover
              sua conta a qualquer momento, encerrando imediatamente seu acesso ao sistema.
            </p>
            <p className="mt-2">
              Você pode solicitar o encerramento da sua conta a qualquer momento por e-mail para{' '}
              <a href="mailto:privacidade@logvale.com.br" className="text-primary underline">
                privacidade@logvale.com.br
              </a>.
              O encerramento não afeta registros de devoluções anteriores, que são mantidos conforme a Política de
              Privacidade por obrigações legais.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">9. Alterações nos Termos</h2>
            <p>
              A Logvale pode atualizar estes Termos a qualquer momento. Alterações relevantes serão comunicadas
              por e-mail com antecedência mínima de 10 dias. Caso não concorde com as alterações, você deve
              solicitar o encerramento de sua conta antes da data de vigência. A continuidade do uso após essa
              data implica aceite da versão atualizada.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-primary mb-2">10. Legislação Aplicável e Foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca
              do Rio de Janeiro/RJ para dirimir quaisquer controvérsias decorrentes destes Termos, com renúncia
              expressa a qualquer outro, por mais privilegiado que seja.
            </p>
            <p className="mt-2 text-muted-foreground text-xs">Versão 1.0 — vigência a partir de 14/05/2025</p>
          </section>

        </div>
      </div>
    </div>
  )
}
