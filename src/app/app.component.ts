import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule, ViewportScroller } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NotificacaoAlertaComponent } from './components/notificacao-alerta/notificacao-alerta.component';
import { filter } from 'rxjs/operators';

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
export class AppComponent implements OnInit {
  currentYear = new Date().getFullYear();
  isMobileMenuOpen = false;
  isMobileView = false;
  private readonly MOBILE_BREAKPOINT = 992;

  constructor(
    private router: Router,
    private viewportScroller: ViewportScroller
  ) {}

  ngOnInit() {
    this.checkViewport();
    
    // Fechar o menu ao navegar
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.isMobileView) {
        this.closeSidebar();
      }
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkViewport();
  }

  private checkViewport() {
    this.isMobileView = window.innerWidth < this.MOBILE_BREAKPOINT;
    if (!this.isMobileView) {
      this.isMobileMenuOpen = false;
    }
  }

  toggleSidebar() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
  }

  closeSidebar() {
    this.isMobileMenuOpen = false;
    document.body.style.overflow = '';
  }

  // Fechar o menu ao clicar fora (para dispositivos móveis)
  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isClickInside = this.isClickInsideSidebarOrButton(target);
    
    if (this.isMobileView && this.isMobileMenuOpen && !isClickInside) {
      this.closeSidebar();
    }
  }

  private isClickInsideSidebarOrButton(target: HTMLElement): boolean {
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    const menuButton = document.querySelector('.mobile-menu-toggle') as HTMLElement;
    
    return (sidebar && sidebar.contains(target)) || 
           (menuButton && menuButton.contains(target));
  }
}
