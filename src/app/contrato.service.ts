import { Injectable } from '@angular/core';
import { Contrato } from './contrato.model';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ContratoService {
  private contratos: Contrato[] = [
    {
      id: 1,
      numeroContrato: 'CTR-2023-001',
      dataInicio: '2023-01-01',
      dataFim: '2023-12-31',
      nomeFiscal: 'João Silva',
      nomeGestor: 'Maria Santos',
      nomeEmpresa: 'Empresa Exemplo',
      cnpj: '12.345.678/0001-90',
      matriculaFiscal: '12345',
      termoAditivo: 'contrato inicial',
      valorContrato: 150000,
      situacao: 'ativo',
      observacoes: 'Contrato de serviço de consultoria'
    },
    {
      id: 2,
      numeroContrato: 'CTR-2023-002',
      dataInicio: '2023-02-01',
      dataFim: '2023-11-30',
      nomeFiscal: 'Ana Costa',
      nomeGestor: 'Carlos Souza',
      nomeEmpresa: 'Outra Empresa',
      cnpj: '98.765.432/0001-81',
      matriculaFiscal: '54321',
      termoAditivo: 'primeiro termo aditivo',
      valorContrato: 200000,
      situacao: 'ativo',
      observacoes: 'Contrato de manutenção'
    }
  ];

  private contratosSubject = new BehaviorSubject<Contrato[]>(this.contratos);

  /**
   * Obtém a lista de todos os contratos
   */
  getContratos(): Observable<Contrato[]> {
    return this.contratosSubject.asObservable();
  }

  /**
   * Obtém um contrato pelo ID
   */
  getContrato(id: number): Observable<Contrato | undefined> {
    const contrato = this.contratos.find(c => c.id === id);
    return of(contrato);
  }

  /**
   * Verifica se um número de contrato já existe
   */
  verificarNumeroContratoExistente(numeroContrato: string, excludeId?: number): Observable<boolean> {
    const contratoExistente = this.contratos.find(
      c => c.numeroContrato === numeroContrato && c.id !== excludeId
    );
    return of(!!contratoExistente);
  }

  /**
   * Adiciona um novo contrato
   */
  adicionarContrato(contrato: Omit<Contrato, 'id'>): Observable<Contrato> {
    // Gera um ID único para o novo contrato
    const novoId = Math.max(0, ...this.contratos.map(c => c.id || 0)) + 1;
    
    // Valida o número do contrato
    return this.verificarNumeroContratoExistente(contrato.numeroContrato).pipe(
      switchMap(numeroExiste => {
        if (numeroExiste) {
          return throwError(() => new Error('Já existe um contrato com este número.'));
        }
        
        const novoContrato: Contrato = {
          ...contrato,
          id: novoId
        };
        
        this.contratos = [...this.contratos, novoContrato];
        this.contratosSubject.next([...this.contratos]);
        
        return of(novoContrato);
      })
    );
  }

  /**
   * Atualiza um contrato existente
   */
  atualizarContrato(contratoAtualizado: Contrato): Observable<Contrato> {
    if (!contratoAtualizado.id) {
      return throwError(() => new Error('ID do contrato não fornecido'));
    }

    return this.getContrato(contratoAtualizado.id).pipe(
      switchMap(contratoExistente => {
        if (!contratoExistente) {
          return throwError(() => new Error('Contrato não encontrado'));
        }

        // Verifica se o número do contrato foi alterado e se já existe
        if (contratoAtualizado.numeroContrato && 
            contratoAtualizado.numeroContrato !== contratoExistente.numeroContrato) {
          return this.verificarNumeroContratoExistente(
            contratoAtualizado.numeroContrato, 
            contratoAtualizado.id
          ).pipe(
            switchMap(numeroExiste => {
              if (numeroExiste) {
                return throwError(() => new Error('Já existe um contrato com este número.'));
              }
              return this.salvarContratoAtualizado(contratoAtualizado);
            })
          );
        }
        return this.salvarContratoAtualizado(contratoAtualizado);
      })
    );
  }

  private salvarContratoAtualizado(contrato: Contrato): Observable<Contrato> {
    const index = this.contratos.findIndex(c => c.id === contrato.id);
    if (index === -1) {
      return throwError(() => new Error('Contrato não encontrado para atualização'));
    }
    
    this.contratos = [
      ...this.contratos.slice(0, index),
      contrato,
      ...this.contratos.slice(index + 1)
    ];
    
    this.contratosSubject.next([...this.contratos]);
    return of(contrato);
  }

  /**
   * Remove um contrato pelo ID
   */
  removerContrato(id: number): Observable<boolean> {
    const index = this.contratos.findIndex(c => c.id === id);
    if (index === -1) {
      return of(false);
    }
    
    this.contratos = [
      ...this.contratos.slice(0, index),
      ...this.contratos.slice(index + 1)
    ];
    
    this.contratosSubject.next([...this.contratos]);
    return of(true);
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
