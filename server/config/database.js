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
        userId INTEGER,
        title TEXT,
        authors TEXT,
        abstract TEXT,
        url TEXT,
        source TEXT,
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        role TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        query TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  static run(sql, params = []) {
    return this.#db.run(sql, params);
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
