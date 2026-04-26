// ─── ZiaLabs AI — Search History Model ───
const DB = require('../config/database');

class SearchHistory {
  constructor(row) {
    this.id = row.id;
    this.userId = row.user_id;
    this.query = row.query;
    this.resultsCount = row.results_count;
    this.sources = row.sources;
    this.searchedAt = row.searched_at;
  }

  static create({ userId, query, resultsCount = 0, sources = '' }) {
    DB.run('INSERT INTO search_history (user_id, query, results_count, sources) VALUES (?, ?, ?, ?)',
      [userId, query, resultsCount, sources]);
  }

  static findByUser(userId, limit = 10) {
    return DB.all('SELECT * FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT ?', [userId, limit])
      .map(r => new SearchHistory(r));
  }

  static countByUser(userId) {
    const row = DB.get('SELECT COUNT(*) as total FROM search_history WHERE user_id = ?', [userId]);
    return row ? row.total : 0;
  }

  static countThisWeek(userId) {
    const row = DB.get("SELECT COUNT(*) as total FROM search_history WHERE user_id = ? AND searched_at >= datetime('now', '-7 days')", [userId]);
    return row ? row.total : 0;
  }

  toJSON() {
    return { id: this.id, query: this.query, resultsCount: this.resultsCount, sources: this.sources, searchedAt: this.searchedAt };
  }
}

module.exports = SearchHistory;
