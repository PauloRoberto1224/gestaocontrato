import { Injectable, Inject } from '@angular/core';
import { Contrato } from '../contrato.model';
import { ContratoService } from '../contrato.service';
import { BehaviorSubject } from 'rxjs';

// Estilos para as notificações
const estilosNotificacao = `
  .notificacao {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 15px 25px;
    border-radius: 4px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1050;
    opacity: 0.95;
    transform: translateY(100px);
    transition: transform 0.3s ease-out, opacity 0.5s ease-out;
  }
  
  .notificacao.sucesso {
    background-color: #28a745; /* Verde */
  }
  
  .notificacao.erro {
    background-color: #dc3545; /* Vermelho */
  }
  
  .notificacao.info {
    background-color: #17a2b8; /* Azul claro */
  }
  
  .notificacao.alerta {
    background-color: #ffc107; /* Amarelo */
    color: #212529; /* Texto escuro para melhor contraste */
  }
  
  .notificacao.fade-out {
    opacity: 0;
    transform: translateY(100px);
  }
  
  @media (max-width: 576px) {
    .notificacao {
      left: 10px;
      right: 10px;
      bottom: 10px;
      text-align: center;
    }
  }
`;

// Adiciona os estilos ao documento
const styleElement = document.createElement('style');
styleElement.textContent = estilosNotificacao;
document.head.appendChild(styleElement);

export interface AlertaContrato {
  contrato: Contrato;
  diasParaVencer: number;
  nivelAlerta: 'baixo' | 'medio' | 'alto';
  mensagem: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlertaService {
  private alertasAtivos = new BehaviorSubject<AlertaContrato[]>([]);
  private audioAlerta = new Audio('assets/sounds/alerta.mp3');
  private alertaAtivo = false;
  private alertaPausado = false;
  private maxTocadas = 3; // Número máximo de vezes que o alerta toca
  private tocadasAtual = 0;
  private intervaloToque: any = null;
  private intervaloVerificacao: any = null;

  constructor(
    @Inject(ContratoService) private contratoService: ContratoService
  ) {
    // Configura o áudio para tocar em loop enquanto houver alertas
    this.audioAlerta.loop = true;
    
    // Inicia a verificação periódica a cada hora
    this.iniciarVerificacaoPeriodica();
  }

  private iniciarVerificacaoPeriodica() {
    // Verifica os contratos imediatamente
    this.verificarContratosParaAlerta();
    
    // Configura a verificação a cada hora
    this.intervaloVerificacao = setInterval(() => {
      this.verificarContratosParaAlerta();
    }, 60 * 60 * 1000); // 1 hora
  }

  private verificarContratosParaAlerta() {
    this.contratoService.getContratos().subscribe((contratos: Contrato[]) => {
      // Se houver alertas altos, toca o alerta
      const alertas = this.verificarVencimentoContratos(contratos);
      const temAlertaAlto = alertas.some((a: AlertaContrato) => a.nivelAlerta === 'alto');
      
      if (temAlertaAlto && !this.alertaAtivo) {
        this.tocarAlerta();
      } else if (!temAlertaAlto && this.alertaAtivo) {
        this.pararAlerta();
      }
    });
  }

  verificarVencimentoContratos(contratos: Contrato[]): AlertaContrato[] {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const alertas: AlertaContrato[] = [];

    contratos.forEach(contrato => {
      if (contrato.situacao !== 'ativo') return;
      
      const dataFim = new Date(contrato.dataFim);
      dataFim.setHours(0, 0, 0, 0);
      
      const diffTime = dataFim.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && diffDays <= 90) { // Verifica apenas os que vencem em até 3 meses
        let nivelAlerta: 'baixo' | 'medio' | 'alto' = 'baixo';
        let mensagem = '';

        if (diffDays <= 30) {
          nivelAlerta = 'alto';
          mensagem = `Contrato ${contrato.numeroContrato} vence em ${diffDays} dia(s)!`;
        } else if (diffDays <= 60) {
          nivelAlerta = 'medio';
          mensagem = `Contrato ${contrato.numeroContrato} vence em aproximadamente ${Math.floor(diffDays/30)} mês(es)!`;
        } else {
          mensagem = `Contrato ${contrato.numeroContrato} vence em aproximadamente ${Math.floor(diffDays/30)} meses.`;
        }

        alertas.push({
          contrato,
          diasParaVencer: diffDays,
          nivelAlerta,
          mensagem
        });
      }
    });

    this.alertasAtivos.next(alertas);
    this.gerenciarAlertaSonoro(alertas);
    return alertas;
  }
  
  /**
   * Para o alerta sonoro
   */
  pararAlertaSonoro(): void {
    if (this.alertaAtivo) {
      this.audioAlerta.pause();
      this.audioAlerta.currentTime = 0;
      this.alertaAtivo = false;
      this.tocadasAtual = 0;
      
      if (this.intervaloToque) {
        clearInterval(this.intervaloToque);
        this.intervaloToque = null;
      }
    }
  }
  
  /**
   * Marca os alertas como visualizados
   */
  marcarComoVisualizado(): void {
    // Aqui você pode implementar a lógica para marcar os alertas como visualizados
    // Por enquanto, apenas para o som
    this.pararAlertaSonoro();
  }
  
  /**
   * Remove um alerta específico da lista de alertas ativos
   * @param alerta O alerta a ser removido
   */
  removerAlerta(alerta: AlertaContrato): void {
    const alertasAtuais = this.alertasAtivos.value;
    const indice = alertasAtuais.findIndex(a => 
      a.contrato.id === alerta.contrato.id && 
      a.nivelAlerta === alerta.nivelAlerta
    );
    
    if (indice !== -1) {
      const novosAlertas = [...alertasAtuais];
      novosAlertas.splice(indice, 1);
      this.alertasAtivos.next(novosAlertas);
      
      // Se não houver mais alertas altos, para o áudio
      if (alerta.nivelAlerta === 'alto' && !this.temAlertasAltosAtivos()) {
        this.pararAlerta();
      }
    }
  }
  
  /**
   * Verifica se existem alertas ativos
   * @returns true se houver pelo menos um alerta ativo, false caso contrário
   */
  temAlertasAtivos(): boolean {
    return this.alertasAtivos.value.length > 0;
  }
  
  /**
   * Verifica se o alerta está pausado
   * @returns true se os alertas estiverem pausados, false caso contrário
   */
  isAlertaPausado(): boolean {
    return this.alertaPausado;
  }
  
  /**
   * Alterna o estado de pausa do alerta
   */
  togglePausaAlerta(): void {
    this.alertaPausado = !this.alertaPausado;
    
    if (this.alertaPausado) {
      this.pararAlertaSonoro();
    } else if (this.temAlertasAtivos()) {
      this.tocarAlerta();
    }
  }

  getAlertasAtivos() {
    return this.alertasAtivos.asObservable();
  }

  private gerenciarAlertaSonoro(alertas: AlertaContrato[]) {
    const temAlertaAlto = alertas.some(a => a.nivelAlerta === 'alto');
    
    if (temAlertaAlto && !this.alertaAtivo) {
      this.tocarAlerta();
    } else if (!temAlertaAlto && this.alertaAtivo) {
      this.pararAlerta();
    }
  }

  tocarAlerta() {
    if (this.alertaPausado) return;
    
    // Limpa qualquer timeout anterior
    if (this.intervaloToque) {
      clearTimeout(this.intervaloToque);
    }
    
    if (this.tocadasAtual >= this.maxTocadas) {
      this.pararAlerta();
      return;
    }

    this.audioAlerta.play().then(() => {
      this.alertaAtivo = true;
      this.tocadasAtual++;
      
      // Se ainda não atingiu o máximo, agenda a próxima toque
      if (this.tocadasAtual < this.maxTocadas) {
        this.intervaloToque = setTimeout(() => this.tocarAlerta(), 5000); // Toca novamente após 5 segundos
      }
    }).catch(error => {
      console.error('Erro ao reproduzir áudio:', error);
    });
  }

  pararAlerta() {
    this.audioAlerta.pause();
    this.audioAlerta.currentTime = 0;
    this.alertaAtivo = false;
    this.tocadasAtual = 0; // Reseta o contador de toques
  }

  /**
   * Pausa ou retoma os alertas sonoros
   * @param pausar true para pausar, false para retomar
   * @returns true se a operação foi bem-sucedida
   */
  pausarAlerta(pausar: boolean): boolean {
    if (this.alertaPausado === pausar) {
      return false; // Já está no estado solicitado
    }
    
    this.alertaPausado = pausar;
    
    if (pausar) {
      this.pararAlerta();
    } else if (this.temAlertasAtivos()) {
      this.tocadasAtual = 0; // Reseta o contador para tocar novamente
      this.tocarAlerta();
    }
    
    return true;
  }

  /**
   * Verifica se existem alertas altos ativos
   * @returns true se houver pelo menos um alerta alto ativo, false caso contrário
   */
  temAlertasAltosAtivos(): boolean {
    return this.alertasAtivos.value.some(a => a.nivelAlerta === 'alto');
  }

  /**
   * Limpa todos os intervalos e recursos do serviço
   * Deve ser chamado quando o serviço não for mais necessário
   */
  limparRecursos(): void {
    // Limpa os intervalos
    if (this.intervaloToque) {
      clearTimeout(this.intervaloToque);
      this.intervaloToque = null;
    }
    
    if (this.intervaloVerificacao) {
      clearInterval(this.intervaloVerificacao);
      this.intervaloVerificacao = null;
    }
    
    // Para o áudio se estiver tocando
    this.pararAlerta();
    
    // Limpa os alertas ativos
    this.alertasAtivos.next([]);
  }

  // Método para enviar e-mail (implementação básica - deve ser integrada com um serviço de e-mail)
  async enviarEmailAlerta(alerta: AlertaContrato, emailDestino: string) {
    // Implementação de exemplo - substitua por uma chamada real para um serviço de e-mail
    console.log(`Enviando e-mail para ${emailDestino}: ${alerta.mensagem}`);
    // Exemplo de integração com um serviço de e-mail:
    // return this.http.post('sua-api-de-email', {
    //   to: emailDestino,
    //   subject: `Alerta de Vencimento: ${alerta.contrato.numeroContrato}`,
    //   text: alerta.mensagem
    // }).toPromise();
  }

  /**
   * Adiciona uma mensagem de feedback para o usuário
   * @param mensagem O texto da mensagem a ser exibida
   * @param tipo O tipo de mensagem ('sucesso', 'erro', 'info', 'alerta')
   */
  adicionarMensagem(mensagem: string, tipo: 'sucesso' | 'erro' | 'info' | 'alerta' = 'info'): void {
    // Cria um elemento de notificação
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao ${tipo}`;
    notificacao.textContent = mensagem;
    
    // Adiciona a notificação ao corpo do documento
    document.body.appendChild(notificacao);
    
    // Remove a notificação após 5 segundos
    setTimeout(() => {
      notificacao.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(notificacao);
      }, 500);
    }, 5000);
  }
}
