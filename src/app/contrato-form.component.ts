import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ContratoService } from './contrato.service';
import { Contrato } from './contrato.model';

@Component({
  selector: 'app-contrato-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './contrato-form.component.html',
  styleUrls: ['./contrato-form.component.scss']
})
export class ContratoFormComponent implements OnInit {
  contratoForm: FormGroup;
  submitted = false;
  loading = false;
  isEditMode = false;
  contratoId: number | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private contratoService: ContratoService
  ) {
    this.contratoForm = this.formBuilder.group({
      numeroContrato: ['', [Validators.required, Validators.pattern(/^CTR-\d{4}-\d{3}$/)]],
      dataInicio: ['', [Validators.required, this.dateValidator]],
      dataFim: ['', [Validators.required, this.dateValidator, this.endAfterStartValidator]],
      anexoContrato: [null],
      anexoPortaria: [null],
      nomeFiscal: ['', [Validators.required, Validators.minLength(3)]],
      nomeGestor: ['', [Validators.minLength(3)]],
      nomeEmpresa: ['', [Validators.required, Validators.minLength(3)]],
      cnpj: ['', [Validators.required, Validators.pattern(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}\-?\d{2}$/)]],
      matriculaFiscal: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      termoAditivo: ['contrato inicial', Validators.required],
      valorContrato: ['', [Validators.required, Validators.min(0)]],
      situacao: ['ativo', Validators.required],
      observacoes: ['']
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.isEditMode = true;
        this.contratoId = +id;
        this.carregarContrato(this.contratoId);
      }
    });
  }

  private carregarContrato(id: number): void {
    this.loading = true;
    this.contratoService.getContrato(id).subscribe({
      next: (contrato) => {
        if (contrato) {
          // Formata as datas para o input type="date"
          const contratoFormatado = {
            ...contrato,
            dataInicio: this.formatarDataParaInput(contrato.dataInicio),
            dataFim: this.formatarDataParaInput(contrato.dataFim)
          };
          this.contratoForm.patchValue(contratoFormatado);
        }
        this.loading = false;
      },
      error: () => {
        alert('Erro ao carregar contrato');
        this.router.navigate(['/contratos']);
      }
    });
  }

  private formatarDataParaInput(dataString: string): string {
    const data = new Date(dataString);
    return data.toISOString().split('T')[0];
  }

  get f() {
    return this.contratoForm.controls;
  }

  private dateValidator(control: any): { [key: string]: boolean } | null {
    const date = new Date(control.value);
    return isNaN(date.getTime()) ? { 'invalidDate': true } : null;
  }

  private endAfterStartValidator(control: any): { [key: string]: boolean } | null {
    if (control.parent) {
      const startDate = new Date(control.parent.get('dataInicio')?.value);
      const endDate = new Date(control.value);
      return endDate <= startDate ? { 'endBeforeStart': true } : null;
    }
    return null;
  }

  onFileChange(event: Event, type: 'contrato' | 'portaria'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file && file.size <= 5242880) { // 5MB
      const controlName = type === 'contrato' ? 'anexoContrato' : 'anexoPortaria';
      this.contratoForm.patchValue({ [controlName]: file });
    } else {
      alert('O arquivo deve ter no máximo 5MB');
    }
  }

  onCancel(): void {
    if (confirm('Tem certeza que deseja cancelar? As alterações não salvas serão perdidas.')) {
      this.router.navigate(['/contratos']);
    }
  }

  onSubmit(): void {
    console.log('=== INÍCIO DO ENVIO DO FORMULÁRIO ===');
    console.log('Formulário submetido');
    this.submitted = true;
    
    // Marca todos os campos como tocados para exibir erros de validação
    if (this.contratoForm.invalid) {
      console.log('❌ Formulário inválido. Erros:', this.contratoForm.errors);
      console.log('📋 Estado dos campos:');
      
      Object.keys(this.contratoForm.controls).forEach(key => {
        const control = this.contratoForm.get(key);
        control?.markAsTouched();
        console.log(`- ${key}:`, {
          valor: control?.value,
          valido: control?.valid,
          invalido: control?.invalid,
          erros: control?.errors
        });
      });
      
      console.log('=== FIM DO LOG DE ERROS ===');
      return;
    }
    
    console.log('✅ Formulário válido, preparando para salvar...');

    this.loading = true;
    console.log('🔍 Iniciando processo de salvamento...');
    
    const formData = this.contratoForm.value;
    console.log('📄 Dados do formulário:', JSON.stringify(formData, null, 2));
    
    // Prepara os dados do contrato
    const contratoData: Contrato = {
      ...formData,
      dataInicio: formData.dataInicio,
      dataFim: formData.dataFim
    };

    console.log('📤 Dados do contrato a serem enviados:', JSON.stringify(contratoData, null, 2));

    try {
      const saveAction = this.isEditMode && this.contratoId
        ? (() => {
            console.log('🔄 Modo de atualização - ID:', this.contratoId);
            return this.contratoService.atualizarContrato({...contratoData, id: this.contratoId});
          })()
        : (() => {
            console.log('➕ Modo de criação de novo contrato');
            return this.contratoService.adicionarContrato(contratoData);
          })();

      console.log('🚀 Chamando serviço de salvamento...');
      
      saveAction.subscribe({
        next: (result) => {
          console.log('✅ Operação de salvamento concluída com sucesso:', result);
          this.showSuccessAlert(
            this.isEditMode 
              ? 'Contrato atualizado com sucesso!'
              : 'Contrato cadastrado com sucesso!'
          );
          
          // Navega de volta para a lista após um pequeno atraso para o usuário ver a mensagem
          setTimeout(() => {
            console.log('🔄 Navegando de volta para a lista de contratos...');
            this.router.navigate(['/contratos']);
          }, 1000);
        },
        error: (error) => {
          console.error('❌ Erro ao salvar contrato:', error);
          console.error('Detalhes do erro:', {
            name: error.name,
            message: error.message,
            stack: error.stack
          });
          this.showErrorAlert(`Erro ao salvar contrato: ${error.message || 'Erro desconhecido'}`);
          this.loading = false;
        },
        complete: () => {
          console.log('🏁 Operação de salvamento finalizada');
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('❌ Erro inesperado ao tentar salvar:', error);
      this.showErrorAlert('Ocorreu um erro inesperado ao tentar salvar o contrato.');
      this.loading = false;
    }
  }
  
  private showSuccessAlert(message: string): void {
    // Aqui você pode implementar um toast ou modal de sucesso
    // Por enquanto, usaremos alert mesmo
    alert(message);
  }
  
  private showErrorAlert(message: string): void {
    // Aqui você pode implementar um toast ou modal de erro
    // Por enquanto, usaremos alert mesmo
    alert(`Erro: ${message}`);
  }
}
