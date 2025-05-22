import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule, NgbModule],
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{ titulo || 'Confirmação' }}</h4>
      <button type="button" class="btn-close" (click)="activeModal.dismiss('cancel')" aria-label="Fechar"></button>
    </div>
    <div class="modal-body">
      <p>{{ mensagem || 'Tem certeza que deseja continuar?' }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="activeModal.dismiss('cancel')">
        Cancelar
      </button>
      <button type="button" class="btn btn-danger" (click)="confirmar()">
        Confirmar
      </button>
    </div>
  `,
  styles: [`
    .modal-header {
      background-color: #2c3e50;
      color: white;
    }
    .btn-close {
      filter: invert(1) grayscale(100%) brightness(200%);
    }
  `]
})
export class ConfirmModalComponent {
  @Input() titulo: string = 'Confirmação';
  @Input() mensagem: string = 'Tem certeza que deseja continuar?';
  
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  constructor(public activeModal: NgbActiveModal) {}

  confirmar(): void {
    this.confirm.emit();
    this.activeModal.close('confirmar');
  }

  cancelar(): void {
    this.cancel.emit();
    this.activeModal.dismiss('cancel');
  }
}
