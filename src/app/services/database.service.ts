import { Injectable } from '@angular/core';
import { Contrato } from '../contrato.model';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

// Tipos para SQL.js
declare module 'sql.js' {
  interface Config {
    locateFile?: (filename: string) => string;
  }
  
  interface Database {
    run: (sql: string, params?: any) => void;
    exec: (sql: string, params?: any) => { columns: string[]; values: any[][] }[];
    prepare: (sql: string, params?: any) => Statement;
    getRowsModified: () => number;
  }
  
  interface Statement {
    bind: (params: any) => void;
    step: () => boolean;
    getAsObject: () => any;
    free: () => void;
  }
  
  interface SqlJsStatic {
    Database: new (data?: any) => Database;
  }
  
  function init(config?: Config): Promise<SqlJsStatic>;
}

declare const initSqlJs: typeof import('sql.js').init;

interface SQLiteDB {
  run: (sql: string, params?: any[]) => void;
  exec: (sql: string) => { values: any[][] }[];
  prepare: (sql: string, params?: any[]) => any;
  getRowsModified: () => number;
}

interface SQLiteStmt {
  bind: (params: any[]) => void;
  step: () => boolean;
  getAsObject: () => any;
  free: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private db: SQLiteDB | null = null;
  private dbReady = new BehaviorSubject<boolean>(false);

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): void {
    // Usando SQL.js para compatibilidade com o navegador
    const initSQL = async () => {
      try {
        const SQL = await initSqlJs({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        });
        
        // Criar ou abrir o banco de dados
        this.db = new SQL.Database() as unknown as SQLiteDB;
        
        // Criar a tabela de contratos se não existir
        this.db.run(`
          CREATE TABLE IF NOT EXISTS contratos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numeroContrato TEXT NOT NULL,
            dataInicio TEXT NOT NULL,
            dataFim TEXT NOT NULL,
            anexoContrato TEXT,
            anexoPortaria TEXT,
            nomeFiscal TEXT NOT NULL,
            nomeGestor TEXT NOT NULL,
            nomeEmpresa TEXT NOT NULL,
            cnpj TEXT,
            matriculaFiscal TEXT NOT NULL,
            termoAditivo TEXT NOT NULL,
            valorContrato REAL,
            situacao TEXT DEFAULT 'ativo',
            observacoes TEXT
          )
        `);
        
        this.dbReady.next(true);
      } catch (err) {
        console.error('Erro ao inicializar o banco de dados:', err);
      }
    };

    // Carrega o SQL.js
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
    script.integrity = 'sha512-3G1XG5jNQ5+7HdvR3fKWmXmLrRnt/+w0kOvhH1Yz6dDfZOGjIhC4z7JBsX6F6j30fTyqYq1Y4ZOd3Vq0JOw==';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      // @ts-ignore
      window.initSqlJs({}).then((SQL: any) => {
        initSQL();
      });
    };
    document.head.appendChild(script);
  }

  // Executa uma consulta SQL
  private executeQuery(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      return Promise.reject('Banco de dados não inicializado');
    }
    
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      
      const result = [];
      while (stmt.step()) {
        result.push(stmt.getAsObject());
      }
      
      stmt.free();
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Executa um comando SQL (INSERT, UPDATE, DELETE)
  private executeCommand(sql: string, params: any[] = []): Promise<{ lastID: number, changes: number }> {
    if (!this.db) {
      return Promise.reject('Banco de dados não inicializado');
    }
    
    try {
      this.db.run(sql, params);
      return Promise.resolve({
        lastID: this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0],
        changes: this.db.getRowsModified()
      });
    } catch (err) {
      return Promise.reject(err);
    }
  }

  // Salva um contrato no banco de dados
  salvarContrato(contrato: Contrato): Observable<Contrato> {
    if (contrato.id) {
      // Atualizar contrato existente
      const sql = `
        UPDATE contratos SET 
          numeroContrato = ?, 
          dataInicio = ?, 
          dataFim = ?,
          anexoContrato = ?,
          anexoPortaria = ?,
          nomeFiscal = ?,
          nomeGestor = ?,
          nomeEmpresa = ?,
          cnpj = ?,
          matriculaFiscal = ?,
          termoAditivo = ?,
          valorContrato = ?,
          situacao = ?,
          observacoes = ?
        WHERE id = ?
      `;
      
      const params = [
        contrato.numeroContrato,
        contrato.dataInicio,
        contrato.dataFim,
        contrato.anexoContrato || null,
        contrato.anexoPortaria || null,
        contrato.nomeFiscal,
        contrato.nomeGestor,
        contrato.nomeEmpresa,
        contrato.cnpj || null,
        contrato.matriculaFiscal,
        contrato.termoAditivo,
        contrato.valorContrato || null,
        contrato.situacao || 'ativo',
        contrato.observacoes || null,
        contrato.id
      ];
      
      return from(this.executeCommand(sql, params)).pipe(
        map(() => contrato)
      );
    } else {
      // Inserir novo contrato
      const sql = `
        INSERT INTO contratos (
          numeroContrato, dataInicio, dataFim, anexoContrato, anexoPortaria,
          nomeFiscal, nomeGestor, nomeEmpresa, cnpj, matriculaFiscal,
          termoAditivo, valorContrato, situacao, observacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        contrato.numeroContrato,
        contrato.dataInicio,
        contrato.dataFim,
        contrato.anexoContrato || null,
        contrato.anexoPortaria || null,
        contrato.nomeFiscal,
        contrato.nomeGestor,
        contrato.nomeEmpresa,
        contrato.cnpj || null,
        contrato.matriculaFiscal,
        contrato.termoAditivo,
        contrato.valorContrato || null,
        contrato.situacao || 'ativo',
        contrato.observacoes || null
      ];
      
      return from(this.executeCommand(sql, params)).pipe(
        map(result => ({
          ...contrato,
          id: result.lastID
        }))
      );
    }
  }

  // Obtém todos os contratos
  getContratos(): Observable<Contrato[]> {
    const sql = 'SELECT * FROM contratos ORDER BY dataFim DESC';
    return from(this.executeQuery(sql)).pipe(
      map((rows: any[]) => 
        rows.map(row => ({
          id: row.id,
          numeroContrato: row.numeroContrato,
          dataInicio: row.dataInicio,
          dataFim: row.dataFim,
          anexoContrato: row.anexoContrato || undefined,
          anexoPortaria: row.anexoPortaria || undefined,
          nomeFiscal: row.nomeFiscal,
          nomeGestor: row.nomeGestor,
          nomeEmpresa: row.nomeEmpresa,
          cnpj: row.cnpj || undefined,
          matriculaFiscal: row.matriculaFiscal,
          termoAditivo: row.termoAditivo as any,
          valorContrato: row.valorContrato !== null ? Number(row.valorContrato) : undefined,
          situacao: row.situacao as 'ativo' | 'inativo' | 'encerrado',
          observacoes: row.observacoes || undefined
        }))
      )
    );
  }

  // Obtém um contrato pelo ID
  getContrato(id: number): Observable<Contrato | undefined> {
    const sql = 'SELECT * FROM contratos WHERE id = ?';
    return from(this.executeQuery(sql, [id])).pipe(
      map((rows: any[]) => {
        if (rows.length === 0) return undefined;
        const row = rows[0];
        return {
          id: row.id,
          numeroContrato: row.numeroContrato,
          dataInicio: row.dataInicio,
          dataFim: row.dataFim,
          anexoContrato: row.anexoContrato || undefined,
          anexoPortaria: row.anexoPortaria || undefined,
          nomeFiscal: row.nomeFiscal,
          nomeGestor: row.nomeGestor,
          nomeEmpresa: row.nomeEmpresa,
          cnpj: row.cnpj || undefined,
          matriculaFiscal: row.matriculaFiscal,
          termoAditivo: row.termoAditivo as any,
          valorContrato: row.valorContrato !== null ? Number(row.valorContrato) : undefined,
          situacao: row.situacao as 'ativo' | 'inativo' | 'encerrado',
          observacoes: row.observacoes || undefined
        };
      })
    );
  }

  // Remove um contrato pelo ID
  removerContrato(id: number): Observable<boolean> {
    const sql = 'DELETE FROM contratos WHERE id = ?';
    return from(this.executeCommand(sql, [id])).pipe(
      map(result => result.changes > 0)
    );
  }

  // Verifica se o banco de dados está pronto
  isReady(): Observable<boolean> {
    return this.dbReady.asObservable();
  }
}
