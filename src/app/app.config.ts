import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { routes } from './app.routes';
import { IndexedDbService } from './services/indexed-db.service';
import { AlertaService } from './services/alerta.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    importProvidersFrom(NgbModule),
    { provide: 'BASE_URL', useValue: 'http://localhost:8000' },
    IndexedDbService,
    AlertaService
  ]
};
