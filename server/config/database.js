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
    if (this.#db) return; // DB already initialized

    const SQL = await initSqlJs();
    const rootDbPath = path.join(__dirname, '../../zialabs.db');

    if (process.env.VERCEL || process.env.TMPDIR) {
      const tmpPath = path.join('/tmp', 'zialabs.db');
      if (!fs.existsSync(tmpPath) && fs.existsSync(rootDbPath)) {
        try {
          fs.copyFileSync(rootDbPath, tmpPath);
        } catch (e) {
          console.warn('⚠️ Could not copy initial DB to /tmp:', e.message);
        }
      }
      this.#dbPath = fs.existsSync(tmpPath) ? tmpPath : rootDbPath;
    } else {
      this.#dbPath = rootDbPath;
    }
    
    if (fs.existsSync(this.#dbPath)) {
      const fileBuffer = fs.readFileSync(this.#dbPath);
      this.#db = new SQL.Database(fileBuffer);
    } else {
      this.#db = new SQL.Database();
      this.#createTables();
      this.save();
    }

    // Initialize blog tables and seed contents
    this.#createBlogTables();
    this.#seedBlogPosts();
    this.#seedResearchNotes();
    this.save();

    console.log('✅ Database connected:', this.#dbPath);
  }

  static #createBlogTables() {
    this.#db.run(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE,
        title TEXT,
        excerpt TEXT,
        content TEXT,
        tag TEXT,
        author_name TEXT,
        author_avatar TEXT,
        read_time TEXT,
        likes INTEGER DEFAULT 0,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS blog_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER,
        user_name TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES blog_posts(id)
      );

      CREATE TABLE IF NOT EXISTS research_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_name TEXT,
        content TEXT,
        likes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  static #seedResearchNotes() {
    const hasMath = this.get("SELECT COUNT(*) as count FROM research_notes WHERE content LIKE '%$%'");
    if (hasMath && hasMath.count > 0) {
      return; // Already has math seeded
    }

    // Drop table to migrate to LaTeX math-seeded data
    this.run('DROP TABLE IF EXISTS research_notes');
    this.run(`
      CREATE TABLE IF NOT EXISTS research_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_name TEXT,
        content TEXT,
        likes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const notes = [
      {
        author_name: 'Dr. Aris Thorne',
        content: 'Has anyone looked at the replication rates of the recent LK-99 ambient superconductivity papers? It seems most labs are finding zero resistance but no Meissner effect. Curious to hear thoughts.'
      },
      {
        author_name: 'Sarah Jenkins',
        content: 'Tip for literature reviews: Semantic Scholar has an influence score that tracks if a paper is cited heavily in a supportive context. Combined with ZiaLabs filtering, it saves hours.'
      },
      {
        author_name: 'Shubham Patel',
        content: 'Just published a guide on few-shot prompting templates for parsing PDF methodology. Let me know if you try these in your labs!'
      },
      {
        author_name: 'Prof. Marcus Vance',
        content: 'Interesting result on attention layer gradients. The update formula $\\theta_{t+1} = \\theta_t - \\eta \\nabla L(\\theta_t)$ achieves stable convergence when the condition number of the attention matrix satisfies $\\kappa(A) \\le 1.5$. Worth verifying!'
      }
    ];

    for (const note of notes) {
      this.run(
        'INSERT INTO research_notes (author_name, content) VALUES (?, ?)',
        [note.author_name, note.content]
      );
    }
  }

  static #seedBlogPosts() {
    const hasMath = this.get("SELECT COUNT(*) as count FROM blog_posts WHERE content LIKE '%$$%'");
    if (hasMath && hasMath.count > 0) {
      return; // Already has math seeded
    }

    // Drop table to migrate to LaTeX math-seeded data
    this.run('DROP TABLE IF EXISTS blog_posts');
    this.run(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE,
        title TEXT,
        excerpt TEXT,
        tag TEXT,
        author_name TEXT,
        author_avatar TEXT,
        read_time TEXT,
        content TEXT,
        likes INTEGER DEFAULT 0,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const posts = [
      {
        slug: 'benign-overfitting-attention-mechanisms',
        title: 'Benign Overfitting in Attention Mechanisms: Why Modern Models Generalize',
        excerpt: 'Explore the mathematical foundations of why attention models maintain high generalization performance even when they fit noisy training data.',
        tag: 'AI & ML',
        author_name: 'Dr. Aris Thorne',
        author_avatar: 'AT',
        read_time: '6 min read',
        content: `<h3>The Mystery of Generalization</h3>
<p>In classical statistical learning theory, a model that fits the training data too closely is expected to generalize poorly to unseen data. This phenomenon is known as overfitting. However, modern deep learning architectures, particularly Transformers, routinely violate this rule: they fit complex training datasets with near-perfect accuracy while achieving state-of-the-art generalization performance.</p>

<p>This behavior is termed <strong>benign overfitting</strong>. In this article, we analyze the mathematical underpinnings of this phenomenon inside token selection and attention layers.</p>

<h3>The Role of Signal-to-Noise Ratio (SNR)</h3>
<p>Recent research indicates that attention heads achieve benign overfitting by behaving as implicit selectors of high-SNR features. Even when training labels are heavily corrupted by noise, the attention mechanisms align token vectors along the direction of the underlying signal, rather than the random noise component.</p>

<blockquote>"Attention heads act as high-pass filters for information. By amplifying signal and dissipating isotropic noise, they prevent overfitting from degrading validation benchmarks."</blockquote>

<h3>Mathematical Analysis of Attention Bounds</h3>
<p>Suppose our input signals consist of data matrices $X \in \mathbb{R}^{N \times D}$ and query key projections. The empirical risk minimization loss function with weight decay parameter $\lambda > 0$ is defined as:</p>
<div style="margin: 20px 0; text-align: center;">
  $$\mathcal{L}(\theta) = \frac{1}{N} \sum_{i=1}^N \| f(x_i; \theta) - y_i \|^2 + \lambda \| \theta \|_2^2$$
</div>
<p>As the token dimensionality $D$ grows much larger than $N$ ($D \gg N$), the signal component dominates the noise eigenvalue spectrum, leading to:</p>
<div style="margin: 20px 0; text-align: center;">
  $$\lim_{D \to \infty} R(\theta_{t}) = 0$$
</div>
<p>proving that generalization error bounds converge to zero despite interpolating noisy labeling distributions.</p>

<h3>Key Takeaways for Researchers</h3>
<ul>
  <li><strong>Label Noise Tolerance:</strong> Transformer models do not require perfectly pristine datasets to generalize. Their architecture naturally dampens the effect of sparse labeling errors.</li>
  <li><strong>Overparameterization Advantage:</strong> Scaling model width improves the probability of finding benign directions during gradient descent, making overparameterization a feature rather than a bug.</li>
</ul>`
      },
      {
        slug: 'federated-learning-edge-devices',
        title: 'Federated Learning on Edge Devices: Privacy-First AI Training',
        excerpt: 'How the Federated Tiny Training Engine (FTTE) enables local model tuning on mobile devices without sending raw data to the cloud.',
        tag: 'Privacy',
        author_name: 'Sarah Jenkins',
        author_avatar: 'SJ',
        read_time: '5 min read',
        content: `<h3>Privacy in the Era of Big Data</h3>
<p>As AI applications become more integrated into our lives, data privacy has emerged as a primary concern. Traditional centralized training pipelines require users to send raw personal data to cloud servers. Federated Learning (FL) mitigates this risk by training models locally on user devices and only transmitting weight updates.</p>

<h3>Introducing Federated Tiny Training Engine (FTTE)</h3>
<p>FTTE optimizes resource-constrained edge training. Devices like mobile phones or smartwatches have strict CPU, memory, and thermal limits. FTTE achieves up to an 81% reduction in training energy overhead using three key innovations:</p>

<ol>
  <li><strong>Sparse Layer Tuning:</strong> Only the final linear classifier and attention-pooling layer updates are computed, saving memory bandwidth.</li>
  <li><strong>Quantized Backward Pass:</strong> Gradient computations are executed in low-precision (INT8) using dynamic scaling.</li>
  <li><strong>Asynchronous Updates:</strong> Weights are uploaded only during device charging states to prevent battery drain.</li>
</ol>

<h3>Implications for Enterprise R&D</h3>
<p>By shifting training to the edge, organizations can build highly customized recommendation engines and language models directly on-device, fully complying with GDPR and HIPAA regulations without paying massive cloud infrastructure costs.</p>`
      },
      {
        slug: 'scientists-guide-prompt-engineering',
        title: "A Scientist's Guide to Prompt Engineering: Structuring LLM Outputs",
        excerpt: 'Learn standard prompt templates and structured generation tactics to get reproducible, formatted data from AI agents.',
        tag: 'Research Guide',
        author_name: 'Shubham Patel',
        author_avatar: 'SP',
        read_time: '8 min read',
        content: `<h3>Beyond Basic Chatting</h3>
<p>Most people interact with LLMs by asking simple questions and receiving paragraphs of text. While this is helpful for generic tasks, scientific workflows demand high precision, structure, and reproducibility. Prompt engineering is the science of designing inputs to ensure that outputs conform to strict logical constraints.</p>

<h3>Structuring Outputs via JSON Schemas</h3>
<p>When using models like Gemini to extract methodology or parse equations, raw text is difficult for automated systems to process. Instead, you should always request outputs in structured formats like JSON or XML.</p>

<pre><code>{
  "methodology": "Randomized double-blind study",
  "sample_size": 250,
  "confidence_interval": "95%",
  "verdict": "Supportive"
}</code></pre>

<h3>Recommended Framework: Few-Shot Prompting</h3>
<p>One of the most powerful techniques is Few-Shot Prompting. By providing the LLM with 2-3 examples of inputs and desired outputs, you align its response distribution directly with your schema, drastically reducing hallucinations.</p>`
      },
      {
        slug: 'democratizing-ai-prompt-engineering',
        title: 'Democratizing AI: Prompt Engineering for Millions',
        excerpt: 'How educational initiatives are teaching millions of students to leverage AI tools for learning and research.',
        tag: 'Education',
        author_name: 'Prof. Ramesh Kumar',
        author_avatar: 'RK',
        read_time: '7 min read',
        content: `<h3>Bridging the Digital Divide</h3>
<p>Artificial Intelligence is often seen as a resource-heavy technology limited to top tech companies and elite laboratories. However, the rise of powerful generative APIs has democratized access to computer logic. Anyone with an internet connection can now use AI to solve complex tasks.</p>

<h3>Educational Initiatives</h3>
<p>India\'s SWAYAM Plus platform, in collaboration with IIT Madras, recently launched course tracks to teach prompt engineering and AI literacy to over a million undergraduate students. By teaching how to use LLMs as personalized tutors, the initiative seeks to raise coding literacy, research throughput, and technical writing skills across all socioeconomic groups.</p>`
      }
    ];

    for (const post of posts) {
      this.run(
        'INSERT INTO blog_posts (slug, title, excerpt, content, tag, author_name, author_avatar, read_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [post.slug, post.title, post.excerpt, post.content, post.tag, post.author_name, post.author_avatar, post.read_time]
      );
    }
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
    if (!this.#db) return;
    try {
      const data = this.#db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.#dbPath, buffer);
    } catch (err) {
      console.warn('⚠️ Could not save DB to disk (read-only environment):', err.message);
    }
  }

  static close() {
    if (this.#db) this.#db.close();
  }
}

module.exports = DB;
