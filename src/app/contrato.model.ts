export interface Contratada {
  id?: number;
  nome: string;
  // Adicione outros campos da contratada conforme necessário
}

export interface Contrato {
  id?: number;
  numeroContrato: string;
  objetoContrato?: string;
  dataInicio: string;
  dataFim: string;
  anexoContrato?: string;
  anexoPortaria?: string;
  nomeFiscal: string;
  nomeFiscalSuplente: string;
  matriculaFiscalSuplente: string;
  nomeGestor: string;
  nomeEmpresa: string;
  cnpj?: string;
  matriculaFiscal: string;
  termoAditivo: 'contrato inicial' | 'primeiro termo aditivo' | 'segundo termo aditivo' | 'terceiro termo aditivo' | 'quarto termo aditivo';
  valorContrato?: number;
  situacao?: 'ativo' | 'inativo' | 'encerrado';
  observacoes?: string;
  contratada?: Contratada;
}
