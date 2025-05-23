import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Contrato } from './contrato.model';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';
import { ContratoService } from './contrato.service';
import { AlertaService } from './services/alerta.service';
import { Subject, of } from 'rxjs';
import { NgbModal, NgbModalRef, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { takeUntil, tap, catchError, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-contrato-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    NgbModule
  ],
  providers: [DatePipe],
  templateUrl: './contrato-list.component.html',
  styleUrls: ['./contrato-list.component.scss']
})
export class ContratoListComponent implements OnInit, OnDestroy {
  contratos: Contrato[] = [];
  carregando = false;
  totalContratos = 0;
  totalValorContratos = 0;
  alertaVisual = false;
  filtroStatus: 'todos' | 'ativos' | 'expirados' = 'todos';
  termoBusca = '';
  ordenacao: { campo: keyof Contrato; direcao: 'asc' | 'desc' } = { campo: 'dataFim', direcao: 'asc' };
  private destroy$ = new Subject<void>();
  private modalRef: NgbModalRef | null = null;

  constructor(
    private contratoService: ContratoService,
    private alertaService: AlertaService,
    private router: Router,
    private modalService: NgbModal,
    private datePipe: DatePipe,
    private cdRef: ChangeDetectorRef
  ) {
    console.log('NgbModal injetado:', !!modalService);
  }

  ngOnInit(): void {
    this.carregarContratos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.modalRef) {
      this.modalRef.dismiss();
    }
  }

  carregarContratos(): void {
    console.log('Iniciando carregamento de contratos...');
    this.carregando = true;

    // Limpa a lista atual
    this.contratos = [];
    this.cdRef.detectChanges();

    // Primeira assinatura para carregamento inicial
    this.contratoService.getContratos()
      .pipe(
        takeUntil(this.destroy$),
        tap((contratos: Contrato[]) => {
          console.log('Dados brutos recebidos do serviço (inicial):', contratos);
          console.log('Tipo dos dados recebidos:', typeof contratos);
          console.log('É array?', Array.isArray(contratos));

          if (contratos && Array.isArray(contratos)) {
            console.log(`Recebidos ${contratos.length} contratos do serviço.`);

            // Log detalhado dos primeiros 5 contratos para depuração
            const contratosDebug = contratos.slice(0, 5).map((c, index) => ({
              indice: index,
              id: c.id,
              idTipo: typeof c.id,
              idValido: !!c.id,
              numeroContrato: c.numeroContrato,
              temNumero: !!c.numeroContrato,
              dataFim: c.dataFim,
              situacao: c.situacao
            }));

            console.log('Detalhes dos primeiros 5 contratos:', contratosDebug);

            // Verifica se há contratos sem ID
            const contratosSemId = contratos.filter(c => !c.id);
            if (contratosSemId.length > 0) {
              console.warn(`ATENÇÃO: ${contratosSemId.length} contratos sem ID válido encontrados.`);
              console.log('Exemplo de contrato sem ID:', JSON.stringify(contratosSemId[0], null, 2));
            }
          } else {
            console.error('ERRO: Dados recebidos não são um array:', contratos);
            throw new Error('Dados recebidos não são válidos');
          }
        }),
        catchError(error => {
          console.error('Erro ao processar os contratos:', error);
          this.alertaService.adicionarMensagem(
            'Erro ao processar os dados dos contratos. Por favor, recarregue a página.',
            'erro'
          );
          return of([]);
        })
      )
      .subscribe({
        next: (contratos: Contrato[]) => {
          try {
            if (!contratos || !Array.isArray(contratos)) {
              console.error('Dados inválidos recebidos do serviço:', contratos);
              throw new Error('Formato de dados inválido');
            }

            console.log(`Processando ${contratos.length} contratos...`);

            // Processa os contratos, garantindo que os IDs sejam números válidos
            this.contratos = contratos
              .filter(contrato => {
                const idValido = contrato.id != null && !isNaN(Number(contrato.id));
                if (!idValido) {
                  console.warn('Contrato com ID inválido ignorado:', contrato);
                }
                return idValido;
              })
              .map(contrato => ({
                ...contrato,
                id: Number(contrato.id) // Garante que o ID seja um número
              }));

            console.log(`${this.contratos.length} contratos processados com sucesso.`);

            // Aplica filtros, ordenação e atualiza a UI
            this.aplicarFiltrosEOrdenacao();
            this.calcularTotais();
            this.verificarAlertas();

            // Força a detecção de mudanças
            this.cdRef.detectChanges();

            // Notifica o usuário se não houver contratos
            if (this.contratos.length === 0) {
              this.alertaService.adicionarMensagem('Nenhum contrato encontrado.', 'info');
            }
          } catch (error) {
            console.error('Erro ao processar contratos:', error);
            this.alertaService.adicionarMensagem(
              'Erro ao processar os contratos. Tente novamente.',
              'erro'
            );
          } finally {
            this.carregando = false;
            console.log('Carregamento de contratos concluído.');
          }
        },
        error: (error: any) => {
          console.error('Erro ao carregar contratos:', error);
          this.carregando = false;
          this.alertaService.adicionarMensagem(
            'Erro ao carregar os contratos. Tente novamente mais tarde.',
            'erro'
          );
        },
        complete: () => console.log('Assinatura inicial do getContratos concluída')
      });

    // Segunda assinatura para atualizações futuras (opcional, dependendo da necessidade)
    const updateSubscription = this.contratoService.getContratos()
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((prev, curr) =>
          JSON.stringify(prev) === JSON.stringify(curr)
        )
      )
      .subscribe({
        next: (contratos: Contrato[]) => {
          console.log('Atualização recebida. Total de contratos:', contratos?.length || 0);

          if (contratos && Array.isArray(contratos)) {
            try {
              // Atualiza apenas se houver diferenças
              if (JSON.stringify(this.contratos) !== JSON.stringify(contratos)) {
                console.log('Atualizando lista de contratos com dados mais recentes...');
                this.contratos = contratos
                  .filter(c => c.id != null && !isNaN(Number(c.id)))
                  .map(c => ({ ...c, id: Number(c.id) }));

                this.aplicarFiltrosEOrdenacao();
                this.cdRef.detectChanges();
              }
            } catch (error) {
              console.error('Erro ao processar atualização de contratos:', error);
            }
          }
        },
        error: (error) => {
          console.error('Erro na assinatura de atualização de contratos:', error);
        }
      });

    // Adiciona a assinatura ao gerenciador de assinaturas
    this.destroy$.subscribe(() => {
      if (updateSubscription) {
        updateSubscription.unsubscribe();
      }
    });
  }

  get contratosFiltrados(): Contrato[] {
    let contratos = [...this.contratos];

    // Aplicar filtro de status
    if (this.filtroStatus === 'ativos') {
      contratos = contratos.filter(contrato => this.estaAtivo(contrato));
    } else if (this.filtroStatus === 'expirados') {
      contratos = contratos.filter(contrato => !this.estaAtivo(contrato));
    }

    // Aplicar busca
    if (this.termoBusca.trim()) {
      const termo = this.termoBusca.toLowerCase().trim();
      contratos = contratos.filter(contrato =>
        (contrato.numeroContrato && contrato.numeroContrato.toLowerCase().includes(termo)) ||
        (contrato.objetoContrato && contrato.objetoContrato.toLowerCase().includes(termo)) ||
        (contrato.contratada && contrato.contratada.nome.toLowerCase().includes(termo)) ||
        (contrato.situacao && contrato.situacao.toLowerCase().includes(termo))
      );
    }

    // Aplicar ordenação
    return contratos.sort((a, b) => {
      const campo = this.ordenacao.campo;
      const direcao = this.ordenacao.direcao === 'asc' ? 1 : -1;

      // Caso algum dos valores seja nulo/indefinido, coloca no final
      if (!a[campo] && b[campo]) return direcao;
      if (a[campo] && !b[campo]) return -direcao;
      if (!a[campo] && !b[campo]) return 0;

      // Converte para string para comparação
      const valorA = String(a[campo]).toLowerCase();
      const valorB = String(b[campo]).toLowerCase();

      // Ordenação numérica para campos numéricos
      if (campo === 'valorContrato') {
        return direcao * (Number(valorA) - Number(valorB));
      }

      // Ordenação por data para campos de data
      if (campo === 'dataInicio' || campo === 'dataFim') {
        const dataA = new Date(valorA).getTime();
        const dataB = new Date(valorB).getTime();
        return direcao * (dataA - dataB);
      }

      // Ordenação alfabética padrão para outros campos
      if (valorA < valorB) return -direcao;
      if (valorA > valorB) return direcao;
      return 0;
    });
  }

  aplicarFiltrosEOrdenacao(): void {
    console.log('Aplicando filtros e ordenação...');
    console.log('Total de contratos antes de aplicar filtros:', this.contratos.length);
    console.log('Total de contratos após filtros:', this.contratosFiltrados.length);
    console.log('Contratos filtrados:', this.contratosFiltrados);
  }

  ordenarPor(campo: keyof Contrato): void {
    if (this.ordenacao.campo === campo) {
      // Inverte a direção se clicar no mesmo campo
      this.ordenacao.direcao = this.ordenacao.direcao === 'asc' ? 'desc' : 'asc';
    } else {
      // Define o novo campo e a direção padrão como 'asc'
      this.ordenacao.campo = campo;
      this.ordenacao.direcao = 'asc';
    }
    this.aplicarFiltrosEOrdenacao();
  }

  limparFiltros(): void {
    this.filtroStatus = 'todos';
    this.termoBusca = '';
    this.aplicarFiltrosEOrdenacao();
  }

  editarContrato(id: number): void {
    this.router.navigate(['/editar', id]);
  }

  visualizarContrato(contrato: Contrato, event?: MouseEvent): void {
    // Previne o comportamento padrão do link/clique se necessário
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!contrato?.id) {
      console.error('Não é possível visualizar: contrato ou ID inválido', contrato);
      this.alertaService.adicionarMensagem('Não foi possível abrir os detalhes do contrato.', 'erro');
      return;
    }

    console.log('Abrindo detalhes do contrato ID:', contrato.id, 'em uma nova aba');
    
    // Abre uma nova aba com a rota de visualização do contrato
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/contratos', contrato.id, 'detalhes'])
    );
    
    window.open(url, '_blank');
  }

  confirmarExclusao(contrato: Contrato, event: Event): void {
    console.log('Botão de exclusão clicado para o contrato:', contrato);
    event.stopPropagation();

    console.log('Abrindo modal de confirmação...');
    const modalRef = this.modalService.open(ConfirmModalComponent, { centered: true });
    modalRef.componentInstance.mensagem = `Tem certeza que deseja excluir o contrato ${contrato.numeroContrato}?`;

    modalRef.result.then(
      (result) => {
        console.log('Resultado do modal:', result);
        if (result === 'confirmar') {
          console.log('Confirmada a exclusão do contrato ID:', contrato.id);
          this.excluirContrato(contrato.id!);
        }
      },
      (reason) => {
        console.log('Modal fechado com razão:', reason);
        // Usuário cancelou a exclusão
      }
    ).catch(error => {
      console.error('Erro no modal de confirmação:', error);
    });
  }

  private excluirContrato(id: number): void {
    console.log(`Iniciando exclusão do contrato ID: ${id}`);

    if (!id) {
      console.error('ID de contrato inválido para exclusão');
      this.alertaService.adicionarMensagem('ID de contrato inválido', 'erro');
      return;
    }

    this.contratoService.removerContrato(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sucesso) => {
          console.log(`Resposta da exclusão do contrato ID ${id}:`, sucesso);

          if (sucesso) {
            // Atualiza a lista de contratos
            this.carregarContratos();

            // Exibir mensagem de sucesso
            this.alertaService.adicionarMensagem('Contrato excluído com sucesso!', 'sucesso');

            // Força a detecção de mudanças
            this.cdRef.detectChanges();
          } else {
            console.warn(`Falha ao excluir o contrato ID: ${id}`);
            this.alertaService.adicionarMensagem('Não foi possível excluir o contrato. Tente novamente.', 'erro');
          }
        },
        error: (error) => {
          console.error('Erro ao excluir contrato:', error);
          let mensagemErro = 'Ocorreu um erro ao tentar excluir o contrato.';

          if (error?.message) {
            mensagemErro += ` Detalhes: ${error.message}`;
          }

          this.alertaService.adicionarMensagem(mensagemErro, 'erro');
        }
      });
  }

  estaAtivo(contrato: Contrato): boolean {
    if (!contrato.dataFim) return false;
    const dataFim = new Date(contrato.dataFim);
    const hoje = new Date();
    return dataFim >= hoje;
  }

  getStatusContrato(contrato: Contrato): { texto: string; classe: string } {
    if (this.estaAtivo(contrato)) {
      return { texto: 'Ativo', classe: 'status-ativo' };
    } else {
      return { texto: 'Expirado', classe: 'status-expirado' };
    }
  }

  formatarData(data: string): string {
    return this.datePipe.transform(data, 'dd/MM/yyyy') || '';
  }

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

  calcularTotais(): void {
    const contratosFiltrados = this.contratosFiltrados;
    this.totalContratos = contratosFiltrados.length;
    this.totalValorContratos = contratosFiltrados.reduce(
      (total, contrato) => total + (contrato.valorContrato || 0),
      0
    );
  }

  verificarAlertas(): void {
    this.alertaVisual = this.contratos.some(contrato => {
      const dias = this.diasParaVencer(contrato);
      return dias > 0 && dias <= 30;
    });
  }

  diasParaVencer(contrato: Contrato): number {
    try {
      const fim = new Date(contrato.dataFim);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const diferenca = fim.getTime() - hoje.getTime();
      const dias = Math.ceil(diferenca / (1000 * 60 * 60 * 24));

      return dias >= 0 ? dias : 0;
    } catch (error) {
      console.error('Erro ao calcular dias para vencer:', error);
      return 0;
    }
  }

  // Método para depuração
  debugContrato(contrato: any): string {
    if (!contrato) return 'Contrato é nulo/indefinido';

    try {
      const contratoCopy = { ...contrato };
      // Remove campos muito grandes para facilitar a leitura
      delete contratoCopy.anexos;
      delete contratoCopy.historicoAlteracoes;

      return JSON.stringify(contratoCopy, null, 2);
    } catch (error) {
      return `Erro ao formatar contrato: ${error}`;
    }
  }
}
