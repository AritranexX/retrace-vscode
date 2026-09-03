import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { Session, RepoMetric } from './types';

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath?: string;
  private SQL: SqlJsStatic | null = null;

  constructor(dbPath?: string) {
    this.dbPath = dbPath;
  }

  public async initialize(): Promise<void> {
    if (this.db) return;
    const wasmFilePath = this.findWasmPath();
    const config = wasmFilePath ? { locateFile: (file: string) => path.join(path.dirname(wasmFilePath), file) } : {};
    this.SQL = await initSqlJs(config);

    if (this.dbPath) {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(this.dbPath)) {
        this.db = new this.SQL.Database(fs.readFileSync(this.dbPath));
      } else {
        this.db = new this.SQL.Database();
        this.save();
      }
    } else {
      this.db = new this.SQL.Database();
    }
    this.createTables();
  }

  private findWasmPath(): string | null {
    const possiblePaths = [
      path.join(__dirname, 'sql-wasm.wasm'),
      path.join(__dirname, '..', 'dist', 'sql-wasm.wasm'),
      path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
      path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, file_path TEXT NOT NULL, repo_name TEXT NOT NULL,
        git_branch TEXT NOT NULL, start_time INTEGER NOT NULL, duration_seconds INTEGER NOT NULL,
        lines_added INTEGER NOT NULL, lines_deleted INTEGER NOT NULL,
        cursor_start_line INTEGER NOT NULL, cursor_end_line INTEGER NOT NULL, timestamp INTEGER NOT NULL
      );
    `);
    this.save();
  }

  private saveTimeout: NodeJS.Timeout | null = null;

  public save(): void {
    if (!this.db || !this.dbPath) return;
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.forceSave();
    }, 300);
  }

  public forceSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (!this.db || !this.dbPath) return;
    try {
      fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
    } catch {
      // Ignore save errors during teardown
    }
  }

  public async insertSession(s: Session): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, file_path, repo_name, git_branch, start_time,
        duration_seconds, lines_added, lines_deleted,
        cursor_start_line, cursor_end_line, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([s.id, s.file_path, s.repo_name, s.git_branch, s.start_time, s.duration_seconds, s.lines_added, s.lines_deleted, s.cursor_start_line, s.cursor_end_line, s.timestamp]);
    stmt.free();
    this.save();
  }

  public async getSessions(
    timeRangeOrFilter?: number | { startTime?: number; endTime?: number }
  ): Promise<Session[]> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let q = 'SELECT * FROM sessions';
    const params: (number | string)[] = [];

    if (typeof timeRangeOrFilter === 'number' && timeRangeOrFilter > 0) {
      q += ' WHERE timestamp >= ?';
      params.push(Date.now() - timeRangeOrFilter);
    } else if (typeof timeRangeOrFilter === 'object' && timeRangeOrFilter !== null) {
      const conditions: string[] = [];
      if (timeRangeOrFilter.startTime !== undefined) {
        conditions.push('timestamp >= ?');
        params.push(timeRangeOrFilter.startTime);
      }
      if (timeRangeOrFilter.endTime !== undefined) {
        conditions.push('timestamp <= ?');
        params.push(timeRangeOrFilter.endTime);
      }
      if (conditions.length > 0) {
        q += ' WHERE ' + conditions.join(' AND ');
      }
    }

    q += ' ORDER BY timestamp DESC';

    const stmt = this.db.prepare(q);
    stmt.bind(params);

    const res: Session[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      res.push({
        id: String(r.id ?? ''), file_path: String(r.file_path ?? ''), repo_name: String(r.repo_name ?? ''),
        git_branch: String(r.git_branch ?? ''), start_time: Number(r.start_time ?? 0), duration_seconds: Number(r.duration_seconds ?? 0),
        lines_added: Number(r.lines_added ?? 0), lines_deleted: Number(r.lines_deleted ?? 0),
        cursor_start_line: Number(r.cursor_start_line ?? 0), cursor_end_line: Number(r.cursor_end_line ?? 0), timestamp: Number(r.timestamp ?? 0)
      });
    }
    stmt.free();
    return res;
  }

  public async getRepoMetrics(timeRangeMs?: number): Promise<RepoMetric[]> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    let q = `SELECT repo_name, SUM(duration_seconds) as total_duration, SUM(lines_added) as lines_added, SUM(lines_deleted) as lines_deleted, COUNT(id) as session_count FROM sessions`;
    const params: (number | string)[] = [];
    if (timeRangeMs !== undefined && timeRangeMs > 0) {
      q += ' WHERE timestamp >= ?';
      params.push(Date.now() - timeRangeMs);
    }
    q += ' GROUP BY repo_name ORDER BY total_duration DESC';

    const stmt = this.db.prepare(q);
    stmt.bind(params);

    const res: RepoMetric[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject();
      res.push({
        repo_name: String(r.repo_name ?? ''), total_duration: Number(r.total_duration ?? 0),
        lines_added: Number(r.lines_added ?? 0), lines_deleted: Number(r.lines_deleted ?? 0), session_count: Number(r.session_count ?? 0)
      });
    }
    stmt.free();
    return res;
  }



  public close(): void {
    if (this.db) {
      this.forceSave();
      this.db.close();
      this.db = null;
    }
  }
}
