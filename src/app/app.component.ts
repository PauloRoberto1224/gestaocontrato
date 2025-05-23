import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NotificacaoAlertaComponent } from './components/notificacao-alerta/notificacao-alerta.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive, 
    NotificacaoAlertaComponent
  ],
  providers: [DatePipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  currentYear = new Date().getFullYear();
}
