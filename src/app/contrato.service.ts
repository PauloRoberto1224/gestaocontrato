import { Injectable, OnDestroy } from '@angular/core';
import { Contrato } from './contrato.model';
import { BehaviorSubject, Observable, of, throwError, Subscription } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { IndexedDbService } from './services/indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class ContratoService implements OnDestroy {
  private contratosSubject = new BehaviorSubject<Contrato[]>([]);
  private dbSubscription: Subscription | null = null;
  private isInitialized = false;
  public contratoId: number | null = null;

  constructor(private dbService: IndexedDbService) {
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.dbSubscription = this.dbService.isReady().subscribe(isReady => {
      if (isReady && !this.isInitialized) {
        this.isInitialized = true;
        this.carregarContratosIniciais();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.dbSubscription) {
      this.dbSubscription.unsubscribe();
    }
  }

  private carregarContratosIniciais(): void {
    this.getContratos().subscribe({
      next: (contratos) => {
        this.contratosSubject.next(contratos);
      },
      error: (err) => {
        console.error('Erro ao carregar contratos iniciais:', err);
      }
    });
  }

  /**
   * Obtém a lista de todos os contratos
   */
  getContratos(): Observable<Contrato[]> {
    if (!this.isInitialized) {
      return this.dbService.isReady().pipe(
        switchMap(() => this.dbService.getContratos()),
        tap(contratos => {
          this.contratosSubject.next(contratos);
        }),
        catchError(err => {
          console.error('Erro ao buscar contratos:', err);
          return of([]);
        })
      );
    }
    
    return this.dbService.getContratos().pipe(
      tap(contratos => {
        this.contratosSubject.next(contratos);
      }),
      catchError(err => {
        console.error('Erro ao buscar contratos:', err);
        return of([]);
      })
    );
  }

  /**
   * Obtém um contrato pelo ID
   * @param id O ID do contrato a ser encontrado
   */
  getContratoPorId(id: number): Observable<Contrato | undefined> {
    return this.dbService.getContrato(id).pipe(
      catchError(err => {
        console.error('Erro ao buscar contrato:', err);
        return of(undefined);
      })
    );
  }

  /**
   * Verifica se um número de contrato já existe
   */
  verificarNumeroContratoExistente(numeroContrato: string, excludeId?: number): Observable<boolean> {
    return this.getContratos().pipe(
      map(contratos => {
        return contratos.some(c => 
          c.numeroContrato === numeroContrato && 
          (excludeId === undefined || c.id !== excludeId)
        );
      })
    );
  }

  /**
   * Verifica se um número de contrato já existe (versão síncrona para validação de formulário)
   */
  verificarNumeroContratoUnico(control: any): Promise<any> | Observable<any> {
    if (!control.value) {
      return of(null);
    }
    
    return this.verificarNumeroContratoExistente(control.value, this.contratoId || undefined).pipe(
      map(existe => {
        console.log('Verificando número de contrato:', control.value, 'Já existe?', existe);
        return existe ? { numeroContratoExistente: true } : null;
      }),
      catchError((error) => {
        console.error('Erro ao verificar número de contrato:', error);
        return of(null);
      })
    );
  }

  /**
   * Adiciona um novo contrato
   * @param contrato O contrato a ser adicionado
   */
  adicionarContrato(contrato: Contrato): Observable<Contrato> {
    return this.dbService.salvarContrato(contrato).pipe(
      tap(novoContrato => {
        // Atualiza a lista de contratos após adicionar
        this.getContratos().subscribe();
      }),
      catchError(err => {
        console.error('Erro ao adicionar contrato:', err);
        return throwError(() => new Error('Erro ao adicionar contrato'));
      })
    );
  }

  /**
   * Atualiza um contrato existente
   * @param contrato O contrato com as atualizações
   */
  atualizarContrato(contrato: Contrato): Observable<Contrato> {
    if (!contrato.id) {
      return throwError(() => new Error('ID do contrato é obrigatório para atualização'));
    }
    
    return this.dbService.salvarContrato(contrato).pipe(
      tap(() => {
        // Atualiza a lista de contratos após atualizar
        this.getContratos().subscribe();
      }),
      catchError(err => {
        console.error('Erro ao atualizar contrato:', err);
        return throwError(() => new Error('Erro ao atualizar contrato'));
      })
    );
  }

  /**
   * Remove um contrato pelo ID
   * @param id O ID do contrato a ser removido
   */
  removerContrato(id: number): Observable<boolean> {
    return this.dbService.removerContrato(id).pipe(
      tap(sucesso => {
        if (sucesso) {
          // Atualiza a lista de contratos após remover
          this.getContratos().subscribe();
        }
      }),
      catchError(err => {
        console.error('Erro ao remover contrato:', err);
        return throwError(() => new Error('Erro ao remover contrato'));
      })
    );
  }

  /**
   * Manipulador genérico de erros
   */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} falhou:`, error);
      return of(result as T);
    };
  }
}
