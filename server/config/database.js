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

    let SQL;
    try {
      const wasmDir = path.dirname(require.resolve('sql.js'));
      SQL = await initSqlJs({
        locateFile: file => path.join(wasmDir, file)
      });
    } catch (e1) {
      console.warn('⚠️ Explicit WASM locateFile failed, falling back to default initSqlJs:', e1.message);
      SQL = await initSqlJs();
    }
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
      try {
        const fileBuffer = fs.readFileSync(this.#dbPath);
        this.#db = new SQL.Database(fileBuffer);
      } catch (e) {
        console.warn('⚠️ Could not load DB file from disk, creating new DB:', e.message);
        this.#db = new SQL.Database();
      }
    } else {
      this.#db = new SQL.Database();
    }

    // Always create core tables and seed data safely
    try {
      this.#createTables();
      this.#createBlogTables();
      this.#seedBlogPosts();
      this.#seedResearchNotes();
      this.save();
    } catch (e) {
      console.warn('⚠️ Table creation/seeding warning:', e.message);
    }

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
        slug: 'gemini-2-5-multimodal-reasoning-deepmind',
        title: 'Gemini 2.5: Multimodal Reasoning Across Billion-Token Contexts',
        excerpt: 'Google DeepMind presents breakthroughs in continuous long-context memory and real-time multimodal reasoning benchmarks.',
        tag: 'AI & ML',
        author_name: 'Google DeepMind AI Team',
        author_avatar: 'GOOG',
        read_time: '7 min read',
        content: `<h3>Long-Context Multimodal Architecture</h3>
<p>Researchers at Google DeepMind have introduced architectural refinements to the <strong>Gemini 2.5</strong> foundation series, extending native context length while sustaining low latency under sparse cross-attention layers.</p>
<h3>Benchmark Performance</h3>
<p>Empirical results demonstrate state-of-the-art performance on MATH-500, HumanEval, and video reasoning tasks.</p>`
      },
      {
        slug: 'test-time-compute-scaling-openai',
        title: 'Test-Time Compute Scaling: Enhancing LLM Problem Solving',
        excerpt: 'OpenAI Research demonstrates how scaling search and verification compute during inference outperforms raw parameter scaling.',
        tag: 'AI & ML',
        author_name: 'OpenAI Research',
        author_avatar: 'OAI',
        read_time: '8 min read',
        content: `<h3>Systematic Inference Search</h3>
<p>By coupling Process-Supervised Reward Models (PRMs) with Monte Carlo Tree Search (MCTS), language models achieve massive accuracy boosts on competitive programming and olympiad mathematics.</p>`
      },
      {
        slug: 'neuromorphic-spike-processing-iisc',
        title: 'Neuromorphic Spike-Based Processing for Edge Vision',
        excerpt: 'IISc Bangalore Quantum & AI Lab develops ultra-low-power spiking neural network chips for real-time edge processing.',
        tag: 'AI & ML',
        author_name: 'IISc Bangalore AI Lab',
        author_avatar: 'IISC',
        read_time: '6 min read',
        content: `<h3>Ultra-Low Energy Neuromorphic Hardware</h3>
<p>IISc Bangalore researchers present an asynchronous spiking neural network processor consuming less than 1.2 milliwatts during continuous visual classification tasks.</p>`
      },
      {
        slug: 'small-language-models-phi-4-microsoft',
        title: 'Small Language Models (Phi-4): Outperforming 70B Baselines',
        excerpt: 'Microsoft Research releases Phi-4, proving that high-quality synthetic data curation matches massive parameter architectures.',
        tag: 'AI & ML',
        author_name: 'Microsoft Research',
        author_avatar: 'MSFT',
        read_time: '7 min read',
        content: `<h3>Synthetic Data Curation Paradigms</h3>
<p>Microsoft Research demonstrates that filtering training corpora using algorithmic verification allows a 14B parameter model to achieve parity with 70B parameter open models.</p>`
      },
      {
        slug: 'ftte-privacy-first-ai',
        title: 'FTTE: Accelerating Privacy-First AI Training by 81%',
        excerpt: 'MIT researchers develop the Federated Tiny Training Engine to enable powerful AI on edge devices without compromising user data.',
        tag: 'Privacy',
        author_name: 'MIT Media Lab Research Team',
        author_avatar: 'MIT',
        read_time: '6 min read',
        content: `<h3>Accelerating Edge Federated Learning</h3>
<p>Privacy concerns in central server model training have driven researchers at MIT to develop the <strong>Federated Tiny Training Engine (FTTE)</strong>. By executing backward pass weight updates directly on edge microcontrollers and mobile silicon, user data never leaves local device storage.</p>`
      },
      {
        slug: 'federated-differential-privacy-google',
        title: 'Federated Differential Privacy in Large-Scale Android Deployments',
        excerpt: 'Google Research details practical differential privacy bounds across 100M+ active mobile devices.',
        tag: 'Privacy',
        author_name: 'Google Privacy Research',
        author_avatar: 'GOOG',
        read_time: '8 min read',
        content: `<h3>Guaranteed Differential Privacy Bounds</h3>
<p>Google Privacy Research outlines real-world deployments of Laplace noise injection in local federated updates, achieving strict ($\epsilon < 0.2$) privacy budgets.</p>`
      },
      {
        slug: 'bench-jack-ai-resilience',
        title: 'Bench Jack: Testing AI Resilience Against Benchmark Gaming',
        excerpt: 'UC Berkeley Lab reveals structural flaws in current AI evaluation methods and releases new tools to test model integrity.',
        tag: 'Privacy',
        author_name: 'UC Berkeley AI Research (BAIR)',
        author_avatar: 'UCB',
        read_time: '7 min read',
        content: `<h3>Benchmark Contamination & Evaluation Risks</h3>
<p>As large language models scale, traditional benchmark evaluations are increasingly vulnerable to dataset contamination and benchmark gaming.</p>`
      },
      {
        slug: 'synthesizing-multidisciplinary-literature-iisc',
        title: 'Synthesizing Multi-Disciplinary Literature with AI Agents',
        excerpt: 'IISc Bangalore publishes a comprehensive framework for multi-agent evidence matrix extraction across open-access repositories.',
        tag: 'Research Guide',
        author_name: 'IISc Bangalore Literature Group',
        author_avatar: 'IISC',
        read_time: '9 min read',
        content: `<h3>Automated Systematic Literature Review</h3>
<p>Researchers at IISc Bangalore present structured prompt orchestration workflows to automatically parse, compare, and synthesize scientific literature matrices.</p>`
      },
      {
        slug: 'genomic-foundation-transformer-models',
        title: 'Genomic Foundation Transformer Models',
        excerpt: 'Stanford AI BioLab presents zero-shot variant effect predictions across multi-species genomic sequence datasets.',
        tag: 'Research Guide',
        author_name: 'Stanford AI BioLab',
        author_avatar: 'SU',
        read_time: '9 min read',
        content: `<h3>Zero-Shot Clinical Variant Interpretation</h3>
<p>Stanford BioLab researchers have introduced a multi-billion parameter genomic foundation model trained across 3,000 mammalian genomes.</p>`
      },
      {
        slug: 'democratizing-ai-prompt-engineering',
        title: 'Democratizing AI: Prompt Engineering for Millions',
        excerpt: 'IIT Madras launches SWAYAM Plus to scale AI education across India, focusing on industry-aligned skill development.',
        tag: 'Education',
        author_name: 'IIT Madras AI & Data Science Center',
        author_avatar: 'IITM',
        read_time: '8 min read',
        content: `<h3>Bridging the Digital Divide with LLM Education</h3>
<p>IIT Madras has partnered with national education platforms to launch open prompt engineering and applied AI curricula across 500+ regional colleges.</p>`
      },
      {
        slug: 'interactive-ai-tutors-iisc-education',
        title: 'Interactive AI Tutors in STEM Undergraduate Education',
        excerpt: 'IISc Bangalore Science Education Center evaluates AI-assisted personalized tutoring across physics and computer science courses.',
        tag: 'Education',
        author_name: 'IISc Science Education Center',
        author_avatar: 'IISC',
        read_time: '7 min read',
        content: `<h3>Pioneering Personalized STEM Learning</h3>
<p>IISc Bangalore evaluates LLM-driven step-by-step problem solvers, demonstrating a 28% improvement in student mastery of complex algorithms.</p>`
      },
      {
        slug: 'isro-gaganyaan-autonomous-ai-space-navigation',
        title: 'ISRO Gaganyaan: Autonomous AI Spacecraft Trajectory & Docking Systems',
        excerpt: 'ISRO unveils breakthrough autonomous neural guidance systems for the Gaganyaan crewed spaceflight program and future Bharatiya Antariksha Station.',
        tag: 'Space & AI',
        author_name: 'ISRO Space AI Lab',
        author_avatar: 'ISRO',
        read_time: '8 min read',
        content: `<h3>Autonomous Deep Space Guidance</h3>
<p>Engineers at ISRO have deployed real-time neural trajectory optimizers aboard the <strong>Gaganyaan</strong> orbital module, enabling precision autonomous orbital rendezvous and docking for India's upcoming space station.</p>`
      },
      {
        slug: 'skyroot-vikram-1-3d-printed-rocket-engines-ai',
        title: 'Skyroot Aerospace: AI-Optimized 3D-Printed Liquid Rocket Engines for Vikram-1',
        excerpt: 'Skyroot Aerospace details generative AI structural design and additive manufacturing for hyper-efficient 3D-printed rocket engines.',
        tag: 'Aerospace',
        author_name: 'Skyroot Aerospace R&D Team',
        author_avatar: 'SKYROOT',
        read_time: '7 min read',
        content: `<h3>Generative Design in Private Spaceflight</h3>
<p>Skyroot Aerospace presents generative AI topology optimization for 3D-printed cryogenic rocket engines, reducing payload launcher structural mass by 34% while boosting thrust-to-weight ratio for the Vikram-1 orbital rocket series.</p>`
      },
      {
        slug: 'iit-bombay-bharat-gpt-multilingual-ai-models',
        title: 'IIT Bombay BharatGPT: Multi-Task Indic LLMs across 22 Official Indian Languages',
        excerpt: 'IIT Bombay AI Center presents BharatGPT, advancing native speech, script, and multi-modal reasoning across all 22 official Indian languages.',
        tag: 'AI & ML',
        author_name: 'IIT Bombay BharatGPT Lab',
        author_avatar: 'IITB',
        read_time: '8 min read',
        content: `<h3>Multilingual Foundation Models for India</h3>
<p>Researchers at IIT Bombay AI Center have unveiled <strong>BharatGPT</strong>, a state-of-the-art multi-lingual and multi-modal foundation model series trained specifically across 22 official Indian languages to power regional governance, healthcare, and educational AI assistants.</p>`
      },
      {
        slug: 'iit-delhi-mhas-neuromorphic-ai-chip',
        title: 'IIT Delhi mHAS: Sub-Milliwatt Neuromorphic AI Chip for Edge Perception',
        excerpt: 'IIT Delhi Yardi School of Artificial Intelligence develops mHAS chip, enabling ultra-low latency on-device neural processing.',
        tag: 'AI & Hardware',
        author_name: 'IIT Delhi Yardi School of AI',
        author_avatar: 'IITD',
        read_time: '8 min read',
        content: `<h3>On-Chip Edge Neuromorphic Intelligence</h3>
<p>Researchers at the Yardi School of Artificial Intelligence, IIT Delhi, have demonstrated <strong>mHAS</strong>, a novel event-driven neuromorphic silicon processor consuming under 0.8 milliwatts for continuous multi-modal signal processing.</p>`
      },
      {
        slug: 'nasa-artemis-ai-autonomous-lunar-navigation',
        title: 'NASA Artemis IV: AI Neural Guidance & Autonomous Lunar Landing Systems',
        excerpt: 'NASA Jet Propulsion Lab details real-time terrain-relative navigation AI powering autonomous precision landings on the Lunar South Pole.',
        tag: 'Space & AI',
        author_name: 'NASA JPL & Artemis AI Team',
        author_avatar: 'NASA',
        read_time: '9 min read',
        content: `<h3>Autonomous Deep Space Lunar Navigation</h3>
<p>Engineers at NASA Jet Propulsion Laboratory (JPL) have deployed real-time optical neural mapping and autonomous hazard avoidance systems for the <strong>Artemis IV</strong> crewed lunar lander program, achieving sub-meter precision landing capability on shadowed polar craters.</p>`
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
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT,
        plan TEXT DEFAULT 'free',
        api_calls INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS papers (
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

      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        role TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS search_history (
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
    if (!this.#db) return { lastId: 0, changes: 0 };
    try {
      this.#db.run(sql, params);
      const lastIdRes = this.exec('SELECT last_insert_rowid() AS id');
      const changesRes = this.exec('SELECT changes() AS changes');
      return {
        lastId: lastIdRes[0]?.id,
        changes: changesRes[0]?.changes
      };
    } catch (err) {
      console.warn(`⚠️ DB run error (${err.message}) for SQL: ${sql}`);
      return { lastId: 0, changes: 0 };
    }
  }

  static get(sql, params = []) {
    const results = this.exec(sql, params);
    return results.length ? results[0] : null;
  }

  static all(sql, params = []) {
    return this.exec(sql, params);
  }

  static exec(sql, params = []) {
    if (!this.#db) return [];
    try {
      const stmt = this.#db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      console.warn(`⚠️ DB exec error (${err.message}) for SQL: ${sql}`);
      return [];
    }
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
