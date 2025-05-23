import { Routes } from '@angular/router';
import { ContratoFormComponent } from './contrato-form.component';
import { ContratoListComponent } from './contrato-list.component';
import { ContratoDetalhesComponent } from './contrato-detalhes/contrato-detalhes-modal.component';

export const routes: Routes = [
  { path: '', component: ContratoFormComponent },
  { path: 'contratos', component: ContratoListComponent },
  { 
    path: 'editar/:id', 
    component: ContratoFormComponent,
    data: { isEdit: true }
  },
  {
    path: 'contratos/:id/detalhes',
    component: ContratoDetalhesComponent,
    data: { isDetailView: true }
  },
  { path: '**', redirectTo: '' }
];
