const express = require('express');
const router  = express.Router();
const BlogService = require('../services/BlogService');
const RedisService = require('../config/redis');

// GET /api/blog?tag=...&q=...
router.get('/', async (req, res) => {
  try {
    const tag = req.query.tag || '';
    const q = req.query.q || '';
    const cacheKey = `blog:posts:tag:${tag}:q:${q}`;

    const cachedData = await RedisService.get(cacheKey);
    if (cachedData) {
      return res.json({ posts: cachedData, cached: true });
    }

    const posts = BlogService.getAllPosts(tag, q);
    await RedisService.set(cacheKey, posts, 600); // Cache for 10 minutes

    res.json({ posts, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blog/notes (Get short-form notes) - MUST come BEFORE /:slug to avoid route hijacking
router.get('/notes', async (req, res) => {
  try {
    const cacheKey = 'blog:notes';
    const cachedData = await RedisService.get(cacheKey);
    if (cachedData) {
      return res.json({ notes: cachedData, cached: true });
    }

    const notes = BlogService.getAllNotes();
    await RedisService.set(cacheKey, notes, 600);

    res.json({ notes, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/blog/:slug
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const cacheKey = `blog:post:${slug}`;

    const cachedData = await RedisService.get(cacheKey);
    if (cachedData) {
      return res.json({ post: cachedData, cached: true });
    }

    const post = BlogService.getPostBySlug(slug);
    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }
    await RedisService.set(cacheKey, post, 600);

    res.json({ post, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/blog/:slug/like
router.post('/:slug/like', async (req, res) => {
  try {
    const slug = req.params.slug;
    const result = BlogService.incrementLikes(slug);

    // Invalidate list cache and single post cache
    await RedisService.delPattern('blog:posts:*');
    await RedisService.del(`blog:post:${slug}`);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/blog/:slug/comment
router.post('/:slug/comment', async (req, res) => {
  try {
    const slug = req.params.slug;
    const { user_name, content } = req.body;
    const comment = BlogService.addComment(slug, user_name || '', content || '');

    // Invalidate post detail cache so new comment shows up immediately
    await RedisService.del(`blog:post:${slug}`);

    res.json({ comment });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/blog (Create new article)
router.post('/', async (req, res) => {
  try {
    const { title, excerpt, content, tag, author_name } = req.body;
    const post = BlogService.createPost(title, excerpt, content, tag, author_name);

    // Invalidate posts list cache
    await RedisService.delPattern('blog:posts:*');

    res.status(201).json({ post });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/blog/:slug (Edit existing article)
router.put('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const { title, excerpt, content, tag } = req.body;
    const post = BlogService.editPost(slug, title, excerpt, content, tag);

    // Invalidate list cache and single post cache
    await RedisService.delPattern('blog:posts:*');
    await RedisService.del(`blog:post:${slug}`);

    res.json({ post });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/blog/:slug (Delete article)
router.delete('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const result = BlogService.deletePost(slug);

    // Invalidate list cache and single post cache
    await RedisService.delPattern('blog:posts:*');
    await RedisService.del(`blog:post:${slug}`);

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/blog/notes (Create short-form note)
router.post('/notes', async (req, res) => {
  try {
    const { author_name, content } = req.body;
    const note = BlogService.createNote(author_name, content);

    // Invalidate notes list cache
    await RedisService.del('blog:notes');

    res.status(201).json({ note });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/blog/notes/:id/like (Like a note)
router.post('/notes/:id/like', async (req, res) => {
  try {
    const result = BlogService.likeNote(req.params.id);

    // Invalidate notes list cache
    await RedisService.del('blog:notes');

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
