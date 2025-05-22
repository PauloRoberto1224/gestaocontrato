import { Routes } from '@angular/router';
import { ContratoFormComponent } from './contrato-form.component';
import { ContratoListComponent } from './contrato-list.component';

export const routes: Routes = [
  { path: '', component: ContratoFormComponent },
  { path: 'contratos', component: ContratoListComponent },
  { 
    path: 'editar/:id', 
    component: ContratoFormComponent,
    data: { isEdit: true }
  },
  { path: '**', redirectTo: '' }
];
