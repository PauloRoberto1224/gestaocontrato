import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Contrato } from './contrato.model';
import { ContratoService } from './contrato.service';
import { Subject, takeUntil } from 'rxjs';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmModalComponent } from './confirm-modal/confirm-modal.component';
import { tap, map } from 'rxjs/operators';

@Component({
  selector: 'app-contrato-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule
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
    private router: Router,
    private modalService: NgbModal,
    private datePipe: DatePipe
  ) {}

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
          } else {
            console.warn('Dados recebidos não são um array:', contratos);
          }
        })
      )
      .subscribe({
        next: (contratos: Contrato[]) => {
          if (!contratos || !Array.isArray(contratos)) {
            console.error('Dados inválidos recebidos do serviço:', contratos);
            this.contratos = [];
          } else {
            console.log(`Recebidos ${contratos.length} contratos do serviço.`);
            this.contratos = [...contratos]; // Cria uma nova referência do array
            console.log('Contratos atribuídos ao componente:', this.contratos.length);

            // Aplica filtros e ordenação
            this.aplicarFiltrosEOrdenacao();

            // Atualiza totais e alertas
            this.calcularTotais();
            this.verificarAlertas();
          }

          this.carregando = false;
          console.log('Carregamento de contratos concluído com sucesso.');
        },
        error: (error: any) => {
          console.error('Erro ao carregar contratos:', error);
          this.carregando = false;
          // Aqui você pode adicionar um toast de erro para o usuário
        },
        complete: () => console.log('Assinatura inicial do getContratos concluída')
      });

    // Segunda assinatura para atualizações futuras
    this.contratoService.getContratos()
      .pipe(takeUntil(this.destroy$))
      .subscribe((contratos: Contrato[]) => {
        console.log('Atualização recebida via BehaviorSubject. Total de contratos:', contratos.length);
        if (contratos && Array.isArray(contratos) &&
            JSON.stringify(this.contratos) !== JSON.stringify(contratos)) {
          console.log('Atualizando lista de contratos com dados mais recentes...');
          this.contratos = [...contratos];
          this.aplicarFiltrosEOrdenacao();
        }
      });
  }

  get contratosFiltrados(): Contrato[] {
    console.log('Aplicando filtros e ordenação...');
    console.log(`Filtro: status=${this.filtroStatus}, busca="${this.termoBusca}"`);
    console.log(`Ordenação: campo=${this.ordenacao.campo}, direção=${this.ordenacao.direcao}`);

    // Filtra os contratos
    const contratosFiltrados = this.contratos.filter(contrato => {
      // Filtro por status
      if (this.filtroStatus === 'ativos' && !this.estaAtivo(contrato)) {
        return false;
      }
      if (this.filtroStatus === 'expirados' && this.estaAtivo(contrato)) {
        return false;
      }

      // Filtro por termo de busca
      if (this.termoBusca) {
        const termo = this.termoBusca.toLowerCase();
        return (
          (contrato.numeroContrato?.toLowerCase().includes(termo) || false) ||
          (contrato.nomeEmpresa?.toLowerCase().includes(termo) || false) ||
          (contrato.nomeFiscal?.toLowerCase().includes(termo) || false) ||
          (contrato.termoAditivo?.toLowerCase().includes(termo) || false) ||
          (contrato.cnpj?.toLowerCase().includes(termo) || false) ||
          (contrato.matriculaFiscal?.toLowerCase().includes(termo) || false)
        );
      }

      return true;
    });

    console.log(`Contratos após filtragem: ${contratosFiltrados.length} de ${this.contratos.length}`);

    // Ordena os contratos
    return [...contratosFiltrados].sort((a, b) => {
      let valorA: any = a[this.ordenacao.campo as keyof Contrato];
      let valorB: any = b[this.ordenacao.campo as keyof Contrato];

      // Trata valores nulos/undefined
      if (valorA == null) valorA = '';
      if (valorB == null) valorB = '';

      // Converte para string para comparação segura
      const strA = String(valorA).toLowerCase();
      const strB = String(valorB).toLowerCase();

      // Ordenação numérica para campos específicos
      if (this.ordenacao.campo === 'valorContrato' ||
          this.ordenacao.campo === 'id') {
        return this.ordenacao.direcao === 'asc'
          ? Number(valorA) - Number(valorB)
          : Number(valorB) - Number(valorA);
      }

      // Ordenação por data para campos de data
      if (this.ordenacao.campo === 'dataInicio' ||
          this.ordenacao.campo === 'dataFim') {
        const dateA = new Date(valorA).getTime();
        const dateB = new Date(valorB).getTime();
        return this.ordenacao.direcao === 'asc'
          ? dateA - dateB
          : dateB - dateA;
      }

      // Ordenação alfabética padrão para outros campos
      if (strA < strB) {
        return this.ordenacao.direcao === 'asc' ? -1 : 1;
      }
      if (strA > strB) {
        return this.ordenacao.direcao === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  aplicarFiltrosEOrdenacao(): void {
    console.log('Aplicando filtros e ordenação...');
    console.log('Total de contratos antes de aplicar filtros:', this.contratos.length);

    // Força a detecção de mudanças
    this.contratos = [...this.contratos];

    // Atualiza os totais
    this.calcularTotais();

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
  }

  limparFiltros(): void {
    this.filtroStatus = 'todos';
    this.termoBusca = '';
    this.aplicarFiltrosEOrdenacao();
  }

  editarContrato(id: number): void {
    this.router.navigate(['/editar', id]);
  }

  visualizarContrato(id: number): void {
    this.router.navigate(['/visualizar', id]);
  }

  confirmarExclusao(contrato: Contrato, event: Event): void {
    event.stopPropagation();

    this.modalRef = this.modalService.open(ConfirmModalComponent, {
      centered: true,
      backdrop: 'static'
    });

    this.modalRef.componentInstance.titulo = 'Confirmar Exclusão';
    this.modalRef.componentInstance.mensagem = `Tem certeza que deseja excluir o contrato ${contrato.numeroContrato}?`;

    this.modalRef.result.then(
      (result) => {
        if (result === 'confirmar') {
          this.excluirContrato(contrato.id!);
        }
      },
      () => {}
    );
  }

  private excluirContrato(id: number): void {
    this.contratoService.removerContrato(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.carregarContratos();
          // Aqui você pode adicionar um toast de sucesso
        },
        error: (error) => {
          console.error('Erro ao excluir contrato:', error);
          // Aqui você pode adicionar um toast de erro
        }
      });
  }

  estaAtivo(contrato: Contrato): boolean {
    const hoje = new Date();
    const dataFim = new Date(contrato.dataFim);
    return dataFim >= hoje;
  }

  getStatusContrato(contrato: Contrato): { texto: string; classe: string } {
    const dias = this.diasParaVencer(contrato);

    if (dias <= 0) {
      return { texto: 'Expirado', classe: 'expirado' };
    } else if (dias <= 30) {
      return { texto: 'Próximo do vencimento', classe: 'alerta' };
    } else {
      return { texto: 'Ativo', classe: 'ativo' };
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
      console.error('Erro ao calcular dias para vencer:', error, contrato);
      return 0;
    }
  }
}
