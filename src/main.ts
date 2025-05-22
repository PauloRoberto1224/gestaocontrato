import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

console.log('Iniciando aplicativo...');

bootstrapApplication(AppComponent, appConfig)
  .then(() => console.log('Aplicativo iniciado com sucesso!'))
  .catch((err) => console.error('Erro ao iniciar o aplicativo:', err));
