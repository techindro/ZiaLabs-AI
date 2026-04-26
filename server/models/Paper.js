// ─── ZiaLabs AI — Paper Model ───
const DB = require('../config/database');

class Paper {
  constructor(row) {
    this.id = row.id;
    this.userId = row.user_id;
    this.title = row.title;
    this.authors = row.authors;
    this.abstract = row.abstract;
    this.source = row.source;
    this.sourceUrl = row.source_url;
    this.published = row.published;
    this.citations = row.citations;
    this.savedAt = row.saved_at;
  }

  static save({ userId, title, authors, abstract, source, sourceUrl, published, citations = 0 }) {
    const { lastId } = DB.run(
      'INSERT INTO papers (user_id, title, authors, abstract, source, source_url, published, citations) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, title, authors, abstract, source, sourceUrl, published, citations]
    );
    return Paper.findById(lastId);
  }

  static findById(id) {
    const row = DB.get('SELECT * FROM papers WHERE id = ?', [id]);
    return row ? new Paper(row) : null;
  }

  static findByUser(userId, limit = 50) {
    return DB.all('SELECT * FROM papers WHERE user_id = ? ORDER BY saved_at DESC LIMIT ?', [userId, limit])
      .map(r => new Paper(r));
  }

  static delete(id, userId) {
    const { changes } = DB.run('DELETE FROM papers WHERE id = ? AND user_id = ?', [id, userId]);
    return changes > 0;
  }

  static count(userId) {
    const row = DB.get('SELECT COUNT(*) as total FROM papers WHERE user_id = ?', [userId]);
    return row ? row.total : 0;
  }

  toJSON() {
    return {
      id: this.id, title: this.title, authors: this.authors,
      abstract: this.abstract, source: this.source, sourceUrl: this.sourceUrl,
      published: this.published, citations: this.citations, savedAt: this.savedAt,
    };
  }
}

module.exports = Paper;
