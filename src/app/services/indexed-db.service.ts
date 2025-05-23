import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap, filter, take, timeout } from 'rxjs/operators';
import { Contrato } from '../contrato.model';

const DB_NAME = 'gestaoContratosDB';
const STORE_NAME = 'contratos';
const DB_VERSION = 1;

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private db: IDBDatabase | null = null;
  private dbReady = new BehaviorSubject<boolean>(false);

  // Verifica se o banco de dados está pronto para uso
  isReady(): Observable<boolean> {
    return this.dbReady.asObservable().pipe(
      filter((isReady: boolean) => isReady),
      take(1),
      timeout(5000), // Timeout de 5 segundos
      catchError((error: any) => {
        console.error('Erro ao verificar se o banco de dados está pronto:', error);
        return of(false);
      })
    );
  }

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): void {
    console.log('Iniciando abertura do IndexedDB...');
    
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        const error = (event.target as IDBRequest).error;
        console.error('Erro ao abrir o banco de dados:', error);
        this.dbReady.error(error);
      };

      request.onsuccess = (event) => {
        try {
          this.db = (event.target as IDBOpenDBRequest).result;
          console.log('Banco de dados aberto com sucesso:', this.db);

          // Adiciona tratamento de erros para a conexão
          this.db.onerror = (event) => {
            console.error('Erro na conexão com o banco de dados:', event);
          };

          this.db.onversionchange = () => {
            this.db?.close();
            console.log('Banco de dados está desatualizado. Recarregando...');
            window.location.reload();
          };

          this.dbReady.next(true);
        } catch (error) {
          console.error('Erro ao configurar o banco de dados:', error);
          this.dbReady.error(error);
        }
      };

      request.onupgradeneeded = (event) => {
        try {
          console.log('Atualização do banco de dados necessária');
          const db = (event.target as IDBOpenDBRequest).result;

          // Cria o objeto de armazenamento (tabela) se não existir
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.log('Criando objeto de armazenamento...');
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });

            // Cria índices para consultas rápidas
            store.createIndex('numeroContrato', 'numeroContrato', { unique: true });
            store.createIndex('dataFim', 'dataFim', { unique: false });
            store.createIndex('situacao', 'situacao', { unique: false });

            console.log('Objeto de armazenamento criado com sucesso');
          } else {
            console.log('Objeto de armazenamento já existe');
          }
        } catch (error) {
          console.error('Erro durante a atualização do banco de dados:', error);
          // Se houver erro na atualização, fecha a conexão
          const db = (event.target as IDBOpenDBRequest).result;
          if (db) {
            db.close();
          }
          throw error;
        }
      };
    } catch (error) {
      console.error('Falha crítica ao inicializar o banco de dados:', error);
      this.dbReady.error(error);
    }
  }

  private withStore<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T> | void
  ): Observable<T> {
    if (!this.db) {
      return this.dbReady.pipe(
        switchMap(() => this.withStore(mode, callback))
      );
    }

    return new Observable<T>((subscriber) => {
      const transaction = this.db!.transaction([STORE_NAME], mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = callback(store);

      if (request) {
        request.onsuccess = () => {
          subscriber.next(request.result);
          subscriber.complete();
        };

        request.onerror = () => {
          subscriber.error(request.error);
        };
      } else {
        transaction.oncomplete = () => {
          subscriber.complete();
        };

        transaction.onerror = () => {
          subscriber.error(transaction.error);
        };
      }
    });
  }

  // Salva ou atualiza um contrato
  salvarContrato(contrato: Contrato): Observable<Contrato> {
    console.log('Salvando contrato no IndexedDB:', contrato);

    // Garante que estamos trabalhando com uma cópia do objeto
    const contratoParaSalvar = { ...contrato };

    return new Observable<Contrato>((subscriber) => {
      if (!this.db) {
        console.error('Banco de dados não inicializado');
        subscriber.error(new Error('Banco de dados não inicializado'));
        return;
      }

      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Prepara o objeto para salvar
        const contratoRequest = store.put(contratoParaSalvar);

        contratoRequest.onsuccess = () => {
          console.log('Contrato salvo com sucesso, ID:', contratoRequest.result);
          // Atualiza o ID do contrato com o valor retornado pelo banco de dados
          const contratoSalvo = {
            ...contratoParaSalvar,
            id: contratoRequest.result as number
          };
          subscriber.next(contratoSalvo);
          subscriber.complete();
        };

        contratoRequest.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Erro ao salvar contrato:', error);
          subscriber.error(error || new Error('Erro ao salvar contrato'));
        };

        transaction.oncomplete = () => {
          console.log('Transação de salvamento concluída');
        };

        transaction.onerror = (event) => {
          console.error('Erro na transação:', (event.target as IDBRequest).error);
        };

      } catch (error) {
        console.error('Erro ao processar transação:', error);
        subscriber.error(error);
      }
    }).pipe(
      catchError(error => {
        console.error('Erro ao salvar contrato:', error);
        return throwError(() => error);
      })
    );
  }

  // Obtém todos os contratos
  getContratos(): Observable<Contrato[]> {
    console.log('IndexedDB: Iniciando busca por todos os contratos');

    // Se o banco de dados não estiver pronto, espera ele ficar pronto primeiro
    if (!this.db) {
      console.log('Banco de dados não inicializado, aguardando inicialização...');
      return this.isReady().pipe(
        switchMap(() => this.getContratos()),
        catchError(error => {
          console.error('Erro ao aguardar inicialização do banco de dados:', error);
          return of([]);
        })
      );
    }

    return new Observable<Contrato[]>(subscriber => {
      try {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          console.log('IndexedDB: Dados recebidos com sucesso, total:', request.result?.length || 0);

          // Garante que os contratos têm IDs válidos
          const contratos = (request.result || []).map((contrato, index) => ({
            ...contrato,
            // Se não tiver ID, cria um temporário baseado no índice (será substituído no salvamento)
            id: contrato.id || `temp-${Date.now()}-${index}`
          }));


          // Ordena por data de término (mais recente primeiro)
          try {
            const ordenados = [...contratos].sort((a, b) =>
              new Date(b.dataFim).getTime() - new Date(a.dataFim).getTime()
            );
            subscriber.next(ordenados);
          } catch (error) {
            console.error('Erro ao ordenar contratos:', error);
            subscriber.next(contratos); // Retorna sem ordenação em caso de erro
          }

          subscriber.complete();
        };

        request.onerror = (event) => {
          const error = (event.target as IDBRequest).error;
          console.error('Erro ao buscar contratos:', error);
          subscriber.error(error || new Error('Erro ao buscar contratos'));
        };

        transaction.onerror = (event) => {
          console.error('Erro na transação de busca:', (event.target as IDBRequest).error);
        };

      } catch (error) {
        console.error('Erro ao processar busca de contratos:', error);
        subscriber.error(error);
      }
    }).pipe(
      catchError(error => {
        console.error('Erro ao carregar contratos:', error);
        return of([]);
      })
    );
  }

  // Obtém um contrato pelo ID
  getContrato(id: number): Observable<Contrato | undefined> {
    console.log('Buscando contrato com ID:', id);

    return new Observable<Contrato | undefined>((subscriber) => {
      const openRequest = indexedDB.open(DB_NAME, DB_VERSION);

      openRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          console.log('Contrato encontrado:', request.result ? 'Sim' : 'Não');
          subscriber.next(request.result || undefined);
          subscriber.complete();
          db.close();
        };

        request.onerror = (event) => {
          console.error('Erro ao buscar contrato:', (event.target as IDBRequest).error);
          subscriber.error(new Error('Erro ao buscar contrato'));
        };
      };

      openRequest.onerror = (event) => {
        console.error('Erro ao abrir o banco de dados:', (event.target as IDBOpenDBRequest).error);
        subscriber.error(new Error('Erro ao acessar o banco de dados'));
      };
    }).pipe(
      catchError(error => {
        console.error('Erro no pipe ao buscar contrato:', error);
        return of(undefined);
      })
    );
  }

  // Remove um contrato pelo ID
  removerContrato(id: number): Observable<boolean> {
    console.log('Removendo contrato com ID:', id);

    return new Observable<boolean>((subscriber) => {
      const openRequest = indexedDB.open(DB_NAME, DB_VERSION);

      openRequest.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Verifica se o contrato existe antes de tentar remover
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          if (!getRequest.result) {
            console.warn(`Contrato com ID ${id} não encontrado`);
            subscriber.next(false);
            subscriber.complete();
            return;
          }

          // Se o contrato existe, procede com a remoção
          const deleteRequest = store.delete(id);

          deleteRequest.onsuccess = () => {
            console.log(`Contrato com ID ${id} removido com sucesso`);
            subscriber.next(true);
            subscriber.complete();
          };

          deleteRequest.onerror = (event) => {
            console.error('Erro ao remover contrato:', (event.target as IDBRequest).error);
            subscriber.error(new Error('Erro ao remover contrato'));
          };
        };

        getRequest.onerror = (event) => {
          console.error('Erro ao verificar contrato:', (event.target as IDBRequest).error);
          subscriber.error(new Error('Erro ao verificar contrato'));
        };

        transaction.oncomplete = () => {
          db.close();
        };
      };

      openRequest.onerror = (event) => {
        console.error('Erro ao abrir o banco de dados:', (event.target as IDBOpenDBRequest).error);
        subscriber.error(new Error('Erro ao acessar o banco de dados'));
      };
    }).pipe(
      catchError(error => {
        console.error('Erro no pipe ao remover contrato:', error);
        return of(false);
      })
    );
  }


}
