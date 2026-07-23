const DB = require('../config/database');

class BlogService {
  static getAllPosts(tag = '', search = '') {
    let sql = 'SELECT id, slug, title, excerpt, tag, author_name, author_avatar, read_time, likes FROM blog_posts';
    const params = [];
    const conditions = [];

    if (tag) {
      conditions.push('tag = ?');
      params.push(tag);
    }

    if (search) {
      conditions.push('(title LIKE ? OR excerpt LIKE ? OR content LIKE ?)');
      const wild = `%${search}%`;
      params.push(wild, wild, wild);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY id DESC';
    return DB.all(sql, params);
  }

  static getPostBySlug(slug) {
    const post = DB.get('SELECT * FROM blog_posts WHERE slug = ?', [slug]);
    if (!post) return null;

    // Get comments for this post
    const comments = DB.all(
      'SELECT id, user_name, content, created_at FROM blog_comments WHERE post_id = ? ORDER BY created_at ASC',
      [post.id]
    );

    return {
      ...post,
      comments: comments || []
    };
  }

  static addComment(slug, userName, content) {
    const post = DB.get('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
    if (!post) throw new Error('Blog post not found');

    const cleanName = userName.trim() || 'Anonymous Scholar';
    const cleanContent = content.trim();

    if (!cleanContent) throw new Error('Comment content cannot be empty');

    const result = DB.run(
      'INSERT INTO blog_comments (post_id, user_name, content) VALUES (?, ?, ?)',
      [post.id, cleanName, cleanContent]
    );
    DB.save();

    return {
      id: result.lastId,
      user_name: cleanName,
      content: cleanContent,
      created_at: new Date().toISOString()
    };
  }

  static incrementLikes(slug) {
    const post = DB.get('SELECT id, likes FROM blog_posts WHERE slug = ?', [slug]);
    if (!post) throw new Error('Blog post not found');

    const newLikes = (post.likes || 0) + 1;
    DB.run('UPDATE blog_posts SET likes = ? WHERE id = ?', [newLikes, post.id]);
    DB.save();

    return { slug, likes: newLikes };
  }

  static createPost(title, excerpt, content, tag, authorName) {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error('Title cannot be empty');

    // Generate simple slug
    let slug = cleanTitle.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
      
    // Append random string if slug exists
    const existing = DB.get('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
    if (existing) {
      slug += '-' + Math.random().toString(36).substr(2, 5);
    }

    const cleanExcerpt = excerpt.trim() || cleanTitle;
    const cleanContent = content.trim();
    const cleanTag = tag.trim() || 'General';
    const cleanAuthor = authorName.trim() || 'Anonymous Scholar';
    const initials = cleanAuthor.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AS';
    
    // Calculate approximate read time
    const wordCount = cleanContent.split(/\s+/).length;
    const readTimeMins = Math.max(1, Math.round(wordCount / 200));
    const readTime = `${readTimeMins} min read`;

    const result = DB.run(
      'INSERT INTO blog_posts (slug, title, excerpt, content, tag, author_name, author_avatar, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [slug, cleanTitle, cleanExcerpt, cleanContent, cleanTag, cleanAuthor, initials, readTime]
    );
    DB.save();

    return {
      id: result.lastId,
      slug,
      title: cleanTitle,
      excerpt: cleanExcerpt,
      tag: cleanTag,
      author_name: cleanAuthor,
      read_time: readTime
    };
  }

  static editPost(slug, title, excerpt, content, tag) {
    const post = DB.get('SELECT id, author_name, author_avatar FROM blog_posts WHERE slug = ?', [slug]);
    if (!post) throw new Error('Blog post not found');

    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error('Title cannot be empty');

    const cleanExcerpt = excerpt.trim() || cleanTitle;
    const cleanContent = content.trim();
    const cleanTag = tag.trim() || 'General';

    // Recalculate read time
    const wordCount = cleanContent.split(/\s+/).length;
    const readTimeMins = Math.max(1, Math.round(wordCount / 200));
    const readTime = `${readTimeMins} min read`;

    DB.run(
      'UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, tag = ?, read_time = ? WHERE id = ?',
      [cleanTitle, cleanExcerpt, cleanContent, cleanTag, readTime, post.id]
    );
    DB.save();

    return {
      slug,
      title: cleanTitle,
      excerpt: cleanExcerpt,
      tag: cleanTag,
      read_time: readTime
    };
  }

  static deletePost(slug) {
    const post = DB.get('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
    if (!post) throw new Error('Blog post not found');

    DB.run('DELETE FROM blog_comments WHERE post_id = ?', [post.id]);
    DB.run('DELETE FROM blog_posts WHERE id = ?', [post.id]);
    DB.save();

    return { success: true, slug };
  }

  static getAllNotes() {
    return DB.all('SELECT * FROM research_notes ORDER BY created_at DESC');
  }

  static createNote(authorName, content) {
    const cleanAuthor = authorName.trim() || 'Anonymous Scholar';
    const cleanContent = content.trim();

    if (!cleanContent) throw new Error('Content cannot be empty');
    if (cleanContent.length > 280) throw new Error('Content exceeds 280 characters');

    const result = DB.run(
      'INSERT INTO research_notes (author_name, content) VALUES (?, ?)',
      [cleanAuthor, cleanContent]
    );
    DB.save();

    return {
      id: result.lastId,
      author_name: cleanAuthor,
      content: cleanContent,
      likes: 0,
      created_at: new Date().toISOString()
    };
  }

  static likeNote(id) {
    const note = DB.get('SELECT likes FROM research_notes WHERE id = ?', [id]);
    if (!note) throw new Error('Research note not found');

    const newLikes = (note.likes || 0) + 1;
    DB.run('UPDATE research_notes SET likes = ? WHERE id = ?', [newLikes, id]);
    DB.save();

    return { id, likes: newLikes };
  }
}

module.exports = BlogService;
