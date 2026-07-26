# ZiaLabs AI — Research Assiatant

A full-stack web application that helps researchers search, analyze, and manage academic papers using AI. Built with Node.js, Express, and the Gemini API.

## Why I Built This

During my time working on academic projects, I noticed how tedious it was to manually search through ArXiv, Semantic Scholar, and other databases just to find relevant papers. I wanted a single interface that could pull from multiple sources, let me chat with an AI about the results, and keep everything organized in one place.

ZiaLabs started as a weekend hack and evolved into a proper full-stack project with auth, payments, and a real AI backend.

## Features

- **Multi-source paper search** — queries ArXiv and Semantic Scholar simultaneously, deduplicates results, and ranks them by relevance
- **AI chat agent** — powered by Google Gemini; you can ask it to summarize papers, explain methodologies, or generate implementation code
- **Multilingual support** — natively speaks Hindi (हिंदी), English, Tamil (தமிழ்), and Bhojpuri (भोजपुरी). The AI auto-detects your language and replies accordingly
- **Paper library** — save papers you find interesting, upload your own PDFs, and export citations as BibTeX
- **PDF upload & parsing** — drag-and-drop a PDF and the system extracts metadata using `pdf-parse`
- **User auth** — email/password registration with bcrypt hashing, JWT sessions, and a Google Sign-In bypass for local dev
- **Stripe integration** — Pro plan upgrade flow with webhook handling (test mode)
- **Responsive UI** — works on desktop and mobile; single-page app with vanilla JS (no framework overhead)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, vanilla JavaScript (SPA pattern) |
| Backend | Node.js, Express |
| Database | SQLite via sql.js (in-memory + file persistence) |
| AI | Google Gemini API (`gemini-flash-latest`) | OpenAI API Key |
| Auth | bcrypt, JWT |
| Payments | Rozarpay Checkout + Webhooks |
| Search APIs | ArXiv REST API, Semantic Scholar Graph API |

## Project Structure

```
ZiaLabs-AI/
├── public/                 # frontend (served as static files)
│   ├── index.html          # single-page app shell
│   ├── css/style.css       # all styles, responsive breakpoints
│   ├── js/app.js           # SPA routing, API client, UI logic
│   └── img/                # logos, blog images, illustrations
├── server/
│   ├── index.js            # express server entry point
│   ├── config/
│   │   └── database.js     # sql.js wrapper with CRUD helpers
│   ├── middleware/
│   │   └── auth.js         # JWT verification middleware
│   ├── models/             # data access layer
│   │   ├── User.js
│   │   ├── Paper.js
│   │   ├── ChatMessage.js
│   │   └── SearchHistory.js
│   ├── routes/             # API endpoints
│   │   ├── auth.js         # register, login, google sign-in
│   │   ├── chat.js         # AI chat, summarize, code gen
│   │   ├── search.js       # paper search with rate limiting
│   │   ├── papers.js       # library CRUD + stats
│   │   ├── upload.js       # PDF upload with multer
│   │   ├── payment.js      # Stripe checkout + webhooks
│   │   └── news.js         # RSS feed from MIT/Berkeley
│   └── services/           # business logic
│       ├── AIAgent.js      # Gemini wrapper + chat history
│       ├── ArXivService.js # ArXiv API client + XML parsing
│       ├── AuthService.js  # registration, login, JWT
│       ├── NewsService.js  # RSS aggregator
│       ├── PaperSearchOrchestrator.js  # multi-source merge
│       └── SemanticScholarService.js   # S2 API client
├── .env                    # environment variables (not committed)
├── package.json
└── zialabs.db              # SQLite database file
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Gemini API key (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### Setup

```bash
# clone and install
git clone https://github.com/your-username/ZiaLabs-AI.git
cd ZiaLabs-AI
npm install

# configure environment
cp .env.example .env
# edit .env and add your GEMINI_API_KEY

# start the server
npm start
# → http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `PORT` | No | Server port (default: 3000) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (test mode) |
| `SEMANTIC_SCHOLAR_API_KEY` | No | S2 API key for higher rate limits |

## Architecture Decisions

**Why sql.js instead of better-sqlite3?**
sql.js compiles to WASM so it works everywhere without native build tools. During development I ran into issues with `better-sqlite3` on Windows, and sql.js just worked out of the box. The tradeoff is that the entire DB lives in memory and gets serialized to disk on every write — fine for a portfolio project, but you'd swap this for PostgreSQL in production.

**Why vanilla JS on the frontend?**
I wanted to demonstrate that I understand the fundamentals before reaching for React or Vue. The entire frontend is ~630 lines of JS organized into classes (`Auth`, `Chat`, `Search`, `Library`, `Dashboard`, `Payment`). It's a proper SPA with page routing, API client, and state management — just without the framework overhead.

**Why class-based architecture on the backend?**
Each service is a standalone class with static methods. This makes testing straightforward and keeps the routes thin — they just validate input, call the service, and return the response. The models follow a simple Active Record pattern.

## What I Learned

- How to integrate multiple third-party APIs (Gemini, ArXiv, Semantic Scholar, Stripe) into a single coherent product
- Building JWT auth from scratch instead of using Passport.js — gave me a much better understanding of token-based auth
- Handling Gemini's strict chat history format (alternating user/model roles) required writing a history sanitizer
- Stripe webhook verification and the importance of receiving raw request bodies before JSON parsing
- CSS-only infinite marquee animations without JavaScript

## Known Limitations

- No real Google OAuth yet — the "Sign in with Google" button uses a mock endpoint for local development
- The database is SQLite, so it won't scale to concurrent users
- No rate limiting on the API endpoints (would add express-rate-limit in production)
- Search results aren't cached — every query hits the external APIs

## Future Plans

- [ ] Add real Google OAuth with proper credentials
- [ ] Migrate to PostgreSQL for production deployment
- [ ] Add paper recommendation engine based on saved papers
- [ ] Implement collaborative features (shared libraries, team workspaces)
- [ ] Deploy to Azure with CI/CD pipeline

## License

MIT — see [LICENSE](./LICENSE) for details.

---

Built by **Shubham Patel** · [LinkedIn](https://linkedin.com) · [GitHub](https://github.com)
