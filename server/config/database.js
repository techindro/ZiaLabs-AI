const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'zialabs.db');

class DB {
  static #db = null;
  static #ready = null;

  /** Initialize and return the database (async, call once at startup) */
  static async init() {
    if (DB.#db) return DB.#db;

    const SQL = await initSqlJs();

    // Load existing database file or create new
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      DB.#db = new SQL.Database(buffer);
    } else {
      DB.#db = new SQL.Database();
    }

    DB.#initTables();
    DB.#save(); // persist initial schema
    console.log('✅ Database connected:', DB_PATH);
    return DB.#db;
  }

  /** Get the database instance (sync — must call init() first) */
  static getInstance() {
    if (!DB.#db) throw new Error('Database not initialized. Call DB.init() first.');
    return DB.#db;
  }

  static #initTables() {
    const db = DB.#db;
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        email           TEXT    NOT NULL UNIQUE,
        password_hash   TEXT,
        auth_provider   TEXT    DEFAULT 'email',
        plan            TEXT    DEFAULT 'free',
        api_calls_used  INTEGER DEFAULT 0,
        api_calls_limit INTEGER DEFAULT 500,
        created_at      TEXT    DEFAULT (datetime('now'))
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS papers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        title       TEXT    NOT NULL,
        authors     TEXT,
        abstract    TEXT,
        source      TEXT,
        source_url  TEXT,
        published   TEXT,
        citations   INTEGER DEFAULT 0,
        saved_at    TEXT    DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS search_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id       INTEGER NOT NULL,
        query         TEXT    NOT NULL,
        results_count INTEGER DEFAULT 0,
        sources       TEXT,
        searched_at   TEXT    DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        role       TEXT    NOT NULL,
        content    TEXT    NOT NULL,
        created_at TEXT    DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }

  /** Persist database to disk */
  static #save() {
    if (!DB.#db) return;
    const data = DB.#db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  /** Save to disk (call after writes) */
  static persist() {
    DB.#save();
  }

  /** Run a query that modifies data, returns { lastId, changes } */
  static run(sql, params = []) {
    const db = DB.getInstance();
    db.run(sql, params);
    const lastId = db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0] || 0;
    const changes = db.getRowsModified();
    DB.#save();
    return { lastId, changes };
  }

  /** Get one row as an object */
  static get(sql, params = []) {
    const db = DB.getInstance();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      return row;
    }
    stmt.free();
    return null;
  }

  /** Get all rows as array of objects */
  static all(sql, params = []) {
    const db = DB.getInstance();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      const columns = stmt.getColumnNames();
      const values = stmt.get();
      const row = {};
      columns.forEach((col, i) => { row[col] = values[i]; });
      rows.push(row);
    }
    stmt.free();
    return rows;
  }

  static close() {
    if (DB.#db) {
      DB.#save();
      DB.#db.close();
      DB.#db = null;
    }
  }
}

module.exports = DB;
