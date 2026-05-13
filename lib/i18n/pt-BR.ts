export const ptBR = {
  auth: {
    login: {
      title:            'Acesso ao Sistema',
      subtitle:         'Digite seu e-mail para receber o link de acesso',
      emailLabel:       'E-mail',
      emailPlaceholder: 'seu@email.com.br',
      submitButton:     'Receber link de acesso',
      submitting:       'Enviando...',
      successTitle:     'Link enviado!',
      successDesc:      'Verifique sua caixa de entrada e spam.',
      errorInvalidEmail:'E-mail inválido',
      errorSendFailed:  'Não foi possível enviar o link. Tente novamente.',
      callbackError:    'Erro ao processar o link de acesso. Tente novamente.',
    },
    terms: {
      title:         'Termos de Uso',
      subtitle:      'Para continuar, você precisa aceitar nossos Termos de Uso.',
      checkboxLabel: 'Li e aceito os',
      submitButton:  'Aceitar e Continuar',
      submitting:    'Salvando...',
      termsLink:     'Termos de Uso',
      privacyLink:   'Política de Privacidade',
      linksSeparator:' e a ',
    },
    signOut: 'Sair',
  },

  nav: {
    operator: {
      home:      'Início',
      receiving: 'Novo Recebimento',
      handling:  'Tratativas',
    },
    client: {
      home:    'Devoluções Pendentes',
      history: 'Histórico',
      profile: 'Meu Perfil',
    },
    manager: {
      dashboard:  'Dashboard',
      users:      'Usuários',
      depositors: 'Depositantes',
      returns:    'Devoluções',
    },
  },

  common: {
    loading:   'Carregando...',
    error:     'Ocorreu um erro',
    retry:     'Tentar novamente',
    cancel:    'Cancelar',
    confirm:   'Confirmar',
    save:      'Salvar',
    edit:      'Editar',
    back:      'Voltar',
    next:      'Próximo',
    finish:    'Concluir',
    search:    'Buscar',
    noResults: 'Nenhum resultado encontrado',
  },

  roles: {
    operator: 'Operador',
    client:   'Cliente',
    manager:  'Gerente',
  },

  returnStatus: {
    awaiting_decision: 'Aguardando Decisão',
    decided:           'Decidido',
    processed:         'Processado',
  },

  decisions: {
    return_to_stock:    'Voltar pro Estoque',
    store_for_handling: 'Armazenar p/ Tratativas',
    discard:            'Descarte',
    repackage:          'Reembalagem',
  },

  identifierTypes: {
    access_key:  'Chave de Acesso',
    postal_code: 'Código Postal',
    illegible:   'Ilegível',
  },

  client: {
    pending: {
      title:           'Devoluções Pendentes',
      banner:          'Devoluções sem decisão em 72h são automaticamente armazenadas para tratativas.',
      emptyState:      'Nenhuma devolução pendente.',
      filterDepositor: 'Depositante',
      filterAll:       'Todos',
      filterFrom:      'De',
      filterTo:        'Até',
      colDate:         'Data',
      colIdentifier:   'Identificador',
      colNF:           'NF',
      colRv:           'RV',
      colItems:        'Itens',
      colBoxPhotos:    'Fotos Caixa',
      colItemPhotos:   'Fotos Itens',
      colDecision:     'Decisão',
      colTime:         'Tempo Restante',
      downloadXml:     'XML',
    },
    decision: {
      modalTitle:        'Confirmar Decisão',
      irreversible:      'Esta decisão é irreversível.',
      returnSummary:     'Resumo da Devolução',
      xmlUploadLabel:    'XML da NF de Devolução (obrigatório)',
      xmlUploadHint:     'Arquivo .xml',
      confirming:        'Confirmando...',
      successMsg:        'Decisão registrada com sucesso.',
    },
    history: {
      title:       'Histórico de Decisões',
      emptyState:  'Nenhuma decisão registrada.',
      colDecision: 'Decisão',
      colDecidedAt:'Decidido em',
      colAuto:     'Auto',
    },
    countdown: {
      expired: 'Expirado',
    },
  },
} as const

export type Messages = typeof ptBR
