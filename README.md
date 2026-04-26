<p align="center">
  <img src="https://img.shields.io/badge/ZiaLabs-AI-C8102E?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTkuNSAzQTYuNSA2LjUgMCAwIDEgMTYgOS41YzAgMS42MS0uNTkgMy4wOS0xLjU2IDQuMjNsLjI3LjI3aC43OWw1IDUtMS41IDEuNS01LTV2LS43OWwtLjI3LS4yN0E2LjUxNiA2LjUxNiAwIDAgMSA5LjUgMTYgNi41IDYuNSAwIDAgMSAzIDkuNSA2LjUgNi41IDAgMCAxIDkuNSAzIi8+PC9zdmc+" alt="ZiaLabs AI"/>
</p>

<h1 align="center">ZiaLabs AI</h1>

<p align="center">
  <strong>Your AI-Powered Research Co-Pilot</strong><br/>
  Search millions of academic papers · Extract insights · Generate code — all in one place.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/express-4.x-000000?style=flat-square&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite"/>
  <img src="https://img.shields.io/badge/Google%20Gemini-AI-4285F4?style=flat-square&logo=google&logoColor=white" alt="Gemini"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License"/>
</p>

---

## 🚀 What is ZiaLabs AI?

**ZiaLabs AI** is a full-stack AI research agent that helps researchers, students, and academics accelerate their work. It combines multi-source academic paper search, an intelligent AI assistant (with Hinglish support), and powerful analysis tools into a single, beautiful interface.

### ✨ Key Features

| Feature | Description |
|---|---|
| 🔍 **Multi-Source Search** | Search ArXiv, Semantic Scholar, IEEE Xplore & Google Scholar simultaneously |
| 🤖 **AI Research Agent** | Chat with an intelligent assistant that understands research context |
| 📄 **Paper Analysis** | Auto-extract key findings, methodology, and conclusions from papers |
| 💻 **Code Generation** | Generate Python/R/MATLAB implementations directly from research papers |
| 📊 **Citation Tracking** | Discover related papers, citations, and references with one click |
| 📝 **Research Summaries** | Convert dense papers into clear, readable summaries — 10x faster |
| 🔐 **Secure Auth** | JWT-based authentication with bcrypt password hashing |
| 🌐 **Hinglish Support** | AI agent communicates in Hinglish for South Asian researchers |

---

## 🏗️ Architecture

```
ZiaLabs-AI/
│
├── server/                         # Backend (Node.js + Express)
│   ├── index.js                    # Express app entry point
│   ├── config/
│   │   └── database.js             # SQLite connection & schema
│   ├── models/                     # OOP Data Models
│   │   ├── User.js                 # User accounts & plans
│   │   ├── Paper.js                # Saved papers
│   │   ├── SearchHistory.js        # Search tracking
│   │   └── ChatMessage.js          # Chat persistence
│   ├── services/                   # Business Logic Classes
│   │   ├── AIAgent.js              # Google Gemini AI agent
│   │   ├── ArxivService.js         # ArXiv paper search
│   │   ├── SemanticScholarService.js # Semantic Scholar search
│   │   ├── PaperSearchOrchestrator.js # Multi-source orchestrator
│   │   └── AuthService.js          # Authentication & JWT
│   ├── routes/                     # REST API Endpoints
│   │   ├── auth.js                 # /api/auth/*
│   │   ├── chat.js                 # /api/chat/*
│   │   ├── papers.js               # /api/papers/*
│   │   └── search.js               # /api/search/*
│   └── middleware/
│       └── auth.js                 # JWT verification
│
├── public/                         # Frontend (Vanilla HTML/CSS/JS)
│   ├── index.html                  # Single-page application
│   ├── css/
│   │   └── style.css               # Complete design system
│   └── js/
│       └── app.js                  # Frontend application logic
│
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore rules
├── package.json                    # Dependencies & scripts
├── LICENSE                         # MIT License
└── README.md                       # This file
```

---

## ⚡ Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/tech-indro/ZiaLabs-AI.git
cd ZiaLabs-AI
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API key
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3000`) |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key |
| `JWT_SECRET` | **Yes** | Secret key for JWT tokens (any random string) |
| `NODE_ENV` | No | `development` or `production` |

### 4. Start the Server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 5. Open in Browser

Navigate to **[http://localhost:3000](http://localhost:3000)** 🎉

---

## 📡 API Reference

All protected routes require `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create new account | ❌ |
| `POST` | `/api/auth/login` | Sign in with email/password | ❌ |
| `POST` | `/api/auth/google` | Google sign-in (simulated) | ❌ |
| `GET` | `/api/auth/me` | Get current user profile | ✅ |

### AI Chat

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/chat/message` | Send message to AI agent | ✅ |
| `GET` | `/api/chat/history` | Get conversation history | ✅ |
| `DELETE` | `/api/chat/clear` | Clear chat history | ✅ |

### Paper Search

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/search?q=...&sources=...` | Search papers across sources | ✅ |
| `GET` | `/api/search/history` | Get recent searches | ✅ |

### Saved Papers

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/papers/save` | Save a paper | ✅ |
| `GET` | `/api/papers` | List saved papers | ✅ |
| `DELETE` | `/api/papers/:id` | Remove a saved paper | ✅ |
| `GET` | `/api/papers/stats` | Get user dashboard metrics | ✅ |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 18+ |
| **Server** | Express.js 4.x |
| **Database** | SQLite via better-sqlite3 |
| **AI Engine** | Google Gemini (generative AI) |
| **Auth** | JWT + bcryptjs |
| **Paper APIs** | ArXiv API, Semantic Scholar API |
| **Frontend** | Vanilla HTML5, CSS3, JavaScript |
| **Typography** | Playfair Display + DM Sans (Google Fonts) |

---

## 🔍 Data Sources

| Source | Papers | API Type | Cost |
|---|---|---|---|
| **ArXiv** | 2.4M+ | REST (XML) | Free |
| **Semantic Scholar** | 200M+ | REST (JSON) | Free |
| **IEEE Xplore** | 5.4M+ | REST (JSON) | API key required |
| **Google Scholar** | Unlimited | Scraping (limited) | Free |

> **Note:** ArXiv and Semantic Scholar are fully integrated. IEEE and Google Scholar are shown in the UI for future expansion.

---

## 🤖 AI Agent Capabilities

The ZiaLabs AI Agent is powered by Google Gemini and can:

1. **Answer research questions** in Hinglish with academic rigor
2. **Search and summarize papers** from multiple databases
3. **Extract key insights** — methodology, findings, limitations
4. **Generate code** from paper algorithms (Python, R, MATLAB)
5. **Compare approaches** across multiple papers
6. **Track citations** and suggest related reading

### Example Prompts

```
"Transformer architecture ke latest advancements batao"
"RLHF aur DPO mein kya difference hai?"
"Attention mechanism ka Python code generate karo"
"RAG vs fine-tuning comparison paper dhundo"
```

---

## 📸 Screenshots

| Landing Page | Dashboard |
|---|---|
| *Beautiful landing page with stats and features* | *Research dashboard with AI chat and metrics* |

| Sign In | Sign Up |
|---|---|
| *Split-screen auth with brand messaging* | *Quick registration with Google or email* |

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Guidelines

- Follow class-based OOP patterns established in `server/services/`
- All new API routes must include JWT auth middleware
- Use the existing color system defined in CSS custom properties
- Test all endpoints before submitting PR

---

## 📋 Roadmap

- [x] Landing page with hero, stats, and features
- [x] JWT authentication (email + Google sign-in)
- [x] AI research agent with Hinglish support
- [x] ArXiv paper search integration
- [x] Semantic Scholar integration
- [x] Dashboard with metrics and chat
- [ ] PDF upload & analysis
- [ ] Real Google OAuth 2.0
- [ ] IEEE Xplore integration
- [ ] Citation graph visualization
- [ ] Export to BibTeX/RIS
- [ ] Team collaboration features
- [ ] Mobile responsive design
- [ ] Rate limiting & usage quotas

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License — Copyright (c) 2026 Shubham Patel
```

---

## 🙏 Acknowledgments

- [ArXiv](https://arxiv.org/) — Open-access academic paper archive
- [Semantic Scholar](https://www.semanticscholar.org/) — AI-powered research tool by Allen AI
- [Google Gemini](https://ai.google.dev/) — Generative AI platform
- [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) & [DM Sans](https://fonts.google.com/specimen/DM+Sans) — Typography

---

<p align="center">
  Built with ❤️ by <strong>Shubham Patel</strong> · <a href="https://github.com/tech-indro/ZiaLabs-AI">GitHub</a>
</p>