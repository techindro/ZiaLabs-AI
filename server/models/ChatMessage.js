// ─── ZiaLabs AI — Chat Message Model ───
const DB = require('../config/database');

class ChatMessage {
  constructor(row) {
    this.id = row.id;
    this.userId = row.user_id;
    this.role = row.role;
    this.content = row.content;
    this.createdAt = row.created_at;
  }

  static create({ userId, role, content }) {
    DB.run('INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)', [userId, role, content]);
  }

  static findByUser(userId, limit = 50) {
    return DB.all('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?', [userId, limit])
      .map(r => new ChatMessage(r));
  }

  static getRecentContext(userId, limit = 20) {
    const rows = DB.all('SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
    return rows.reverse();
  }

  static clearByUser(userId) {
    DB.run('DELETE FROM chat_messages WHERE user_id = ?', [userId]);
  }

  static countByUser(userId) {
    const row = DB.get("SELECT COUNT(*) as total FROM chat_messages WHERE user_id = ? AND role = 'assistant'", [userId]);
    return row ? row.total : 0;
  }

  toJSON() {
    return { id: this.id, role: this.role, content: this.content, createdAt: this.createdAt };
  }
}

module.exports = ChatMessage;
