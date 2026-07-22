/**
 * ZiaLabs AI — MCP (Model Context Protocol) Server
 * 
 * Exposes ZiaLabs research tools as an MCP server so AI assistants
 * (Claude, Cursor, VS Code, etc.) can call them directly.
 * 
 * Tools exposed:
 *   - search_papers     → Search ArXiv & Semantic Scholar
 *   - get_consensus     → Literature consensus analysis
 *   - summarize_paper   → Summarize a paper abstract
 *   - generate_code     → Turn paper context into code
 *   - ask_research_agent→ Chat with the ZiaLabs AI agent
 * 
 * Usage:
 *   node server/mcp/index.js           (stdio transport)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

// ── Load ZiaLabs services ──────────────────────────────────────
const DB = require('../config/database');
const PaperSearchOrchestrator = require('../services/PaperSearchOrchestrator');
const AIAgent = require('../services/AIAgent');

const agent = new AIAgent();

// ── Create MCP Server ──────────────────────────────────────────
const server = new McpServer(
  {
    name: 'zialabs-ai',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
    instructions: 'ZiaLabs AI Research Assistant — search academic papers, get literature consensus, summarize abstracts, and generate code from research context.',
  }
);

// ── Tool 1: Search Papers ──────────────────────────────────────
server.tool(
  'search_papers',
  'Search millions of academic papers across ArXiv and Semantic Scholar. Returns titles, authors, abstracts, URLs, and citation counts.',
  {
    query: z.string().describe('The research query or topic to search for'),
    max_results: z.number().optional().default(10).describe('Maximum number of results (1-50)'),
    sources: z.string().optional().describe('Comma-separated sources: arxiv,semantic_scholar (default: all)'),
  },
  async ({ query, max_results, sources }) => {
    try {
      const sourceList = sources ? sources.split(',').map(s => s.trim()) : null;
      const limit = Math.min(Math.max(max_results || 10, 1), 50);
      const papers = await PaperSearchOrchestrator.search(query, sourceList, limit);

      const formatted = papers.map((p, i) =>
        `${i + 1}. **${p.title}**\n   Authors: ${p.authors || 'N/A'}\n   Source: ${p.source || 'N/A'} | Citations: ${p.citations || 0}\n   URL: ${p.url || 'N/A'}\n   Abstract: ${(p.abstract || '').slice(0, 300)}${(p.abstract || '').length > 300 ? '...' : ''}`
      ).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: papers.length
              ? `Found ${papers.length} papers for "${query}":\n\n${formatted}`
              : `No papers found for "${query}". Try broadening your search terms.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Search failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 2: Literature Consensus ───────────────────────────────
server.tool(
  'get_consensus',
  'Analyze the scientific consensus on a research question. Searches papers and uses AI to classify each as Yes/No/Unclear, then synthesizes a consensus statement.',
  {
    question: z.string().describe('A specific yes/no research question, e.g. "Does zinc shorten cold duration?"'),
  },
  async ({ question }) => {
    try {
      const papers = await PaperSearchOrchestrator.search(question, null, 4);

      if (!papers || !papers.length) {
        return {
          content: [{ type: 'text', text: `No research papers found for: "${question}". Try rephrasing your question.` }],
        };
      }

      const consensus = await agent.getConsensus(question, papers);

      let text = `## Literature Consensus: "${question}"\n\n`;
      text += `**Verdict:** ${consensus.consensusStatement}\n\n`;
      text += `| Metric | Count |\n|--------|-------|\n`;
      text += `| ✅ Yes | ${consensus.yesCount} |\n`;
      text += `| ❌ No | ${consensus.noCount} |\n`;
      text += `| ❓ Unclear | ${consensus.unclearCount} |\n\n`;

      if (consensus.papers && consensus.papers.length) {
        text += `### Paper-by-Paper Analysis:\n\n`;
        consensus.papers.forEach((p, i) => {
          text += `**${i + 1}. ${p.title}**\n`;
          text += `- Verdict: ${p.verdict}\n`;
          text += `- Findings: ${p.findings}\n`;
          text += `- Methodology: ${p.methodology}\n\n`;
        });
      }

      return { content: [{ type: 'text', text }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Consensus analysis failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 3: Summarize Paper ────────────────────────────────────
server.tool(
  'summarize_paper',
  'Summarize a research paper abstract into concise bullet points using AI.',
  {
    abstract: z.string().describe('The full text of the paper abstract to summarize'),
    language: z.string().optional().default('English').describe('Language for the summary (English, Hindi, etc.)'),
  },
  async ({ abstract, language }) => {
    try {
      const summary = await agent.summarizePaper(abstract, language);
      return { content: [{ type: 'text', text: summary }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Summarization failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 4: Generate Code ──────────────────────────────────────
server.tool(
  'generate_code',
  'Generate clean, well-commented code (Python, R, or MATLAB) from a research paper context, equation, or methodology description.',
  {
    context: z.string().describe('The paper context, equation, or methodology to convert into code'),
    language: z.string().optional().default('python').describe('Programming language: python, r, or matlab'),
  },
  async ({ context, language }) => {
    try {
      const code = await agent.generateCode(context, language);
      return { content: [{ type: 'text', text: code }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Code generation failed: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Tool 5: Ask Research Agent ─────────────────────────────────
server.tool(
  'ask_research_agent',
  'Ask the ZiaLabs AI Research Agent any question about science, papers, methodologies, or research topics. Supports English, Hindi, Tamil, and Bhojpuri.',
  {
    message: z.string().describe('Your research question or message'),
  },
  async ({ message }) => {
    try {
      // Use a fixed MCP user ID so conversation context is maintained
      const MCP_USER_ID = 'mcp-user';
      const response = await agent.chat(MCP_USER_ID, message);
      return { content: [{ type: 'text', text: response }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Research agent error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Boot ────────────────────────────────────────────────────────
async function main() {
  // Initialize the database (required for User model used inside AIAgent)
  await DB.init();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🧪 ZiaLabs AI MCP Server running on stdio');
}

main().catch((err) => {
  console.error('MCP Server failed to start:', err);
  process.exit(1);
});
