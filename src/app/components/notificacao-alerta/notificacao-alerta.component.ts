import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { AnimationEvent } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { trigger, state, style, animate, transition, keyframes } from '@angular/animations';
import { AlertaService, AlertaContrato } from '../../services/alerta.service';
import { ContratoService } from '../../contrato.service';
import { Subscription, fromEvent } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';

@Component({
  selector: 'app-notificacao-alerta',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificacao-alerta.component.html',
  styleUrls: ['./notificacao-alerta.component.scss'],
  animations: [
    trigger('fadeInOut', [
      state('in', style({ opacity: 1, height: '*', transform: 'translateY(0)' })),
      transition(':enter', [
        style({ opacity: 0, height: '0', transform: 'translateY(-10px)' }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)')
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)', style({ 
          opacity: 0, 
          height: '0',
          transform: 'translateY(-10px)',
          margin: 0,
          paddingTop: 0,
          paddingBottom: 0,
          border: 'none'
        }))
      ])
    ]),
    trigger('slideInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms ease-out', style({ 
          opacity: 1, 
          transform: 'translateY(0)' 
        }))
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ 
          opacity: 0, 
          transform: 'translateY(-20px)' 
        }))
      ])
    ]),
    trigger('pulse', [
      transition('* => *', [
        animate('1.5s', 
          keyframes([
            style({ transform: 'scale(1)', offset: 0 }),
            style({ transform: 'scale(1.05)', offset: 0.5 }),
            style({ transform: 'scale(1)', offset: 1.0 })
          ])
        )
      ])
    ])
  ]
})
export class NotificacaoAlertaComponent implements OnInit, OnDestroy {
  @ViewChild('alertasDropdown', { static: false }) alertasDropdown!: ElementRef<HTMLElement>;
  @ViewChild('alertasContent', { static: false }) alertasContent!: ElementRef<HTMLElement>;
  
  alertas: AlertaContrato[] = [];
  mostrarAlertas = false;
  private subscription: Subscription = new Subscription();
  private clickOutsideSubscription: Subscription | null = null;
  private target: EventTarget | null = null;

  // Expor o serviço para o template
  constructor(
    public alertaService: AlertaService,
    private contratoService: ContratoService
  ) {}

  ngOnInit(): void {
    this.carregarAlertas();
    
    // Atualiza os alertas a cada minuto
    const intervalId = setInterval(() => this.carregarAlertas(), 60000);
    this.subscription.add({ unsubscribe: () => clearInterval(intervalId) });
    
    // Inscreve-se nas mudanças nos contratos
    this.subscription.add(
      this.contratoService.getContratos().subscribe()
    );
    
    // Inscreve-se nas mudanças nos alertas ativos
    this.subscription.add(
      this.alertaService.getAlertasAtivos().subscribe(alertas => {
        this.alertas = alertas;
        // Se não houver mais alertas, fecha o painel
        if (alertas.length === 0) {
          this.mostrarAlertas = false;
        }
      })
    );
    
    // Configura o clique fora para fechar o dropdown
    this.setupClickOutsideListener();
  }
  
  ngOnDestroy(): void {
    // Remove o listener ao destruir o componente
    document.removeEventListener('click', this.onDocumentClick.bind(this));
    
    // Cancela todas as subscrições
    this.subscription.unsubscribe();
    if (this.clickOutsideSubscription) {
      this.clickOutsideSubscription.unsubscribe();
    }
  }
  
  onDocumentClick(event: MouseEvent): void {
    // Fecha o dropdown se o clique foi fora do componente
    const target = event.target as HTMLElement;
    if (this.mostrarAlertas && 
        this.alertasDropdown && 
        !this.alertasDropdown.nativeElement.contains(target) &&
        this.alertasContent && 
        !this.alertasContent.nativeElement.contains(target)) {
      this.mostrarAlertas = false;
    }
  }

  private carregarAlertas(): void {
    this.subscription.add(
      this.contratoService.getContratos().subscribe(contratos => {
        this.alertas = this.alertaService.verificarVencimentoContratos(contratos);
      })
    );
  }
  
  private setupClickOutsideListener(): void {
    // Remove a assinatura anterior se existir
    if (this.clickOutsideSubscription) {
      this.clickOutsideSubscription.unsubscribe();
    }
    
    // Adiciona um atraso para garantir que o DOM foi atualizado
    setTimeout(() => {
      this.clickOutsideSubscription = fromEvent<MouseEvent>(document, 'click')
        .pipe(
          filter((event: MouseEvent) => {
            if (!this.mostrarAlertas || !this.alertasDropdown?.nativeElement || !this.alertasContent?.nativeElement) {
              return false;
            }
            
            const target = event.target as HTMLElement;
            const isClickInside = this.alertasDropdown.nativeElement.contains(target) || 
                                 target.closest('.btn-notificacao') !== null ||
                                 target.closest('.btn-pausar-alerta') !== null;
            return !isClickInside;
          }),
          debounceTime(50)
        )
        .subscribe(() => {
          this.mostrarAlertas = false;
        });
    }, 0);
  }
  
  getAlertasPorNivel(nivel: 'alto' | 'medio' | 'baixo'): AlertaContrato[] {
    return this.alertas.filter(a => a.nivelAlerta === nivel);
  }
  
  getClasseAlerta(nivel: 'alto' | 'medio' | 'baixo'): string {
    switch (nivel) {
      case 'alto': return 'alert-danger';
      case 'medio': return 'alert-warning';
      case 'baixo':
      default: return 'alert-info';
    }
  }
  
  getIconeAlerta(nivel: 'alto' | 'medio' | 'baixo'): string {
    switch (nivel) {
      case 'alto': return 'exclamation-triangle';
      case 'medio': return 'exclamation-circle';
      case 'baixo':
      default: return 'info-circle';
    }
  }

  toggleAlertas(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    this.mostrarAlertas = !this.mostrarAlertas;
    
    if (this.mostrarAlertas && this.alertas.length > 0) {
      // Para o áudio quando o usuário abrir o painel de notificações
      this.alertaService.pararAlertaSonoro();
      
      // Marca os alertas como visualizados
      this.alertaService.marcarComoVisualizado();
      
      // Foca no conteúdo do dropdown para melhor acessibilidade
      setTimeout(() => {
        if (this.alertasContent) {
          this.alertasContent.nativeElement.focus();
        }
      }, 100);
    }
  }

  fecharAlerta(index: number, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (index >= 0 && index < this.alertas.length) {
      const alerta = this.alertas[index];
      
      // Adiciona animação de saída
      const elementos = document.querySelectorAll('.alert-item');
      if (elementos.length > 0 && index < elementos.length) {
        const elemento = elementos[index];
        elemento.classList.add('fade-out');
        
        // Remove o alerta após a animação
        setTimeout(() => {
          this.alertaService.removerAlerta(alerta);
          
          // Se não houver mais alertas, fecha o painel
          if (this.alertas.length === 0) {
            this.mostrarAlertas = false;
          }
        }, 300);
      } else {
        this.alertaService.removerAlerta(alerta);
      }
    }
  }

  fecharAlertas(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    // Adiciona animação de saída para todos os alertas
    const alertas = document.querySelectorAll('.alert-item');
    if (alertas.length > 0) {
      alertas.forEach((alerta, index) => {
        setTimeout(() => {
          (alerta as HTMLElement).classList.add('fade-out');
        }, index * 50);
      });
      
      // Remove os alertas após a animação
      setTimeout(() => {
        this.alertas.forEach(alerta => this.alertaService.removerAlerta(alerta));
        this.mostrarAlertas = false;
      }, alertas.length * 50 + 300);
    } else {
      this.mostrarAlertas = false;
    }
  }

  alternarPausaAlerta(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    const estaPausado = this.alertaService.isAlertaPausado();
    this.alertaService.pausarAlerta(!estaPausado);
    
    // Força a detecção de mudanças para atualizar a UI imediatamente
    if (event) {
      const target = event.target as HTMLElement;
      target.blur(); // Remove o foco do botão
    }
  }

  getIconePausa(): string {
    return this.alertaService.isAlertaPausado() ? 'play' : 'pause';
  }

  getTextoPausa(): string {
    if (!this.alertaService.temAlertasAtivos()) {
      return 'Nenhum alerta ativo';
    }
    return this.alertaService.isAlertaPausado() ? 'Retomar alertas' : 'Pausar alertas';
  }

  isBotaoPausaDesabilitado(): boolean {
    return !this.alertaService.temAlertasAtivos();
  }

  isAlerta31Dias(alerta: AlertaContrato): boolean {
    return alerta.diasParaVencer === 31;
  }
  


  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.target as HTMLElement).click();
    } else if (event.key === 'Escape' && this.mostrarAlertas) {
      this.mostrarAlertas = false;
    }
  }
  
  /**
   * Manipulador de evento chamado quando uma animação é concluída
   * @param event O evento de animação
   * @param alerta O alerta relacionado à animação
   * @param index O índice do alerta no array
   * @param nivel O nível de alerta (alto, médio, baixo)
   */
  onAnimationDone(event: AnimationEvent, alerta: AlertaContrato, index: number, nivel: 'alto' | 'medio' | 'baixo'): void {
    // Lógica para quando a animação terminar
    if (event.toState === 'void') {
      // A animação de saída foi concluída
      console.log(`Alerta removido: ${alerta.contrato.numeroContrato} (${nivel})`);
      
      // Força a atualização da UI após a animação
      this.alertas = [...this.alertas];
    } else {
      // A animação de entrada foi concluída
      console.log(`Animação de entrada concluída para o alerta: ${alerta.contrato.numeroContrato}`);
    }
  }
}
