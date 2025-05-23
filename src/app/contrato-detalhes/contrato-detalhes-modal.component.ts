import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Contrato } from '../contrato.model';
import { ContratoService } from '../contrato.service';
import { AlertaService } from '../services/alerta.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-contrato-detalhes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './contrato-detalhes-modal.component.html',
  styleUrls: ['./contrato-detalhes-modal.component.scss']
})
export class ContratoDetalhesComponent implements OnInit {
  contrato: Contrato | null = null;
  carregando = true;
  diasParaVencer: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalService: NgbModal,
    private contratoService: ContratoService,
    private alertaService: AlertaService
  ) {}

  ngOnInit(): void {
    this.carregarContrato();
  }

  getSituacaoFormatada(): string {
    if (!this.contrato?.situacao) {
      return 'Não informado';
    }
    return this.contrato.situacao.charAt(0).toUpperCase() + this.contrato.situacao.slice(1);
  }

  private carregarContrato(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (!id) {
      this.alertaService.adicionarMensagem('ID do contrato não fornecido.', 'erro');
      this.router.navigate(['/contratos']);
      return;
    }

    this.carregando = true;
    
    // Converter o ID para número
    const idNumero = parseInt(id, 10);
    
    if (isNaN(idNumero)) {
      this.alertaService.adicionarMensagem('ID do contrato inválido.', 'erro');
      this.router.navigate(['/contratos']);
      return;
    }
    
    this.contratoService.getContratoPorId(idNumero).subscribe({
      next: (contrato: Contrato) => {
        this.contrato = contrato;
        this.calcularDiasParaVencer();
        this.carregando = false;
      },
      error: (erro: any) => {
        console.error('Erro ao carregar contrato:', erro);
        this.alertaService.adicionarMensagem('Erro ao carregar os detalhes do contrato.', 'erro');
        this.router.navigate(['/contratos']);
        this.carregando = false;
      }
    });
  }

  private calcularDiasParaVencer(): void {
    if (!this.contrato?.dataFim) {
      this.diasParaVencer = 0;
      return;
    }
    
    const hoje = new Date();
    const dataFim = new Date(this.contrato.dataFim);
    const diffTime = dataFim.getTime() - hoje.getTime();
    this.diasParaVencer = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  editarContrato(): void {
    if (this.contrato?.id) {
      this.router.navigate(['/contratos', this.contrato.id, 'editar']);
    }
  }

  voltar(): void {
    this.router.navigate(['/contratos']);
  }
}
