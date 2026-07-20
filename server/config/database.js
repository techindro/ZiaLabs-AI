const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

// ZiaLabs uses sql.js (SQLite in WASM) so we don't have to deal with 
// native build tools like node-gyp on Windows.
// the db is saved to zialabs.db on every write.
class DB {
  static #db = null;
  static #dbPath = path.join(__dirname, '../../zialabs.db');

  static async init() {
    const SQL = await initSqlJs();
    
    if (fs.existsSync(this.#dbPath)) {
      const fileBuffer = fs.readFileSync(this.#dbPath);
      this.#db = new SQL.Database(fileBuffer);
    } else {
      this.#db = new SQL.Database();
      this.#createTables();
      this.save();
    }
    console.log('✅ Database connected:', this.#dbPath);
  }

  static #createTables() {
    // simple schema for research projects
    this.#db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        plan TEXT DEFAULT 'free',
        api_calls INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE papers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        authors TEXT,
        abstract TEXT,
        source TEXT,
        source_url TEXT,
        published TEXT,
        citations INTEGER DEFAULT 0,
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        query TEXT,
        results_count INTEGER DEFAULT 0,
        sources TEXT,
        searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  static run(sql, params = []) {
    this.#db.run(sql, params);
    const lastIdRes = this.exec('SELECT last_insert_rowid() AS id');
    const changesRes = this.exec('SELECT changes() AS changes');
    return {
      lastId: lastIdRes[0]?.id,
      changes: changesRes[0]?.changes
    };
  }

  static get(sql, params = []) {
    const results = this.exec(sql, params);
    return results.length ? results[0] : null;
  }

  static all(sql, params = []) {
    return this.exec(sql, params);
  }

  static exec(sql, params = []) {
    const stmt = this.#db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  static save() {
    const data = this.#db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.#dbPath, buffer);
  }

  static close() {
    if (this.#db) this.#db.close();
  }
}

module.exports = DB;
