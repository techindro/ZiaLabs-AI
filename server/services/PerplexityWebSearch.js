const axios = require('axios');
const PaperSearchOrchestrator = require('./PaperSearchOrchestrator');

/**
 * Perplexity-Style Real-Time Internet & Academic Web Search Service
 * Searches live web, ArXiv, Semantic Scholar, BioRxiv, and Wikipedia in real-time for every query.
 */
class PerplexityWebSearch {
  /**
   * Search real-time web & academic databases
   * @param {string} query 
   * @returns {Promise<{papers: Array, webResults: Array, formattedContext: string, citationWidget: string}>}
   */
  static async searchInternet(query) {
    if (!query || typeof query !== 'string') {
      return { papers: [], webResults: [], formattedContext: '', citationWidget: '' };
    }

    try {
      // 1. Parallel Academic Search (ArXiv, Semantic Scholar)
      const academicPromise = PaperSearchOrchestrator.search(query, null, 5).catch(() => []);

      // 2. Parallel Web Search (DuckDuckGo / Wikipedia API)
      const webPromise = PerplexityWebSearch.#fetchWebSearchResults(query).catch(() => []);

      const [academicPapers, webResults] = await Promise.all([academicPromise, webPromise]);

      // Combine and format results for Gemini AI grounding context
      let formattedContext = '### REAL-TIME INTERNET & ACADEMIC SEARCH RESULTS (LIVE GROUNDING CONTEXT):\n';
      let citationWidget = '\n\n---\n### 🌐 **Perplexity-Style Web Sources & Direct PDF Downloads**\n';

      let totalSources = 0;

      // Append Academic Papers
      if (academicPapers && academicPapers.length > 0) {
        academicPapers.slice(0, 4).forEach((p) => {
          totalSources++;
          const pdfUrl = p.pdfUrl || (p.arxivId ? `https://arxiv.org/pdf/${p.arxivId}.pdf` : p.url);
          const pageUrl = p.url || (p.arxivId ? `https://arxiv.org/abs/${p.arxivId}` : pdfUrl);
          
          formattedContext += `[Source ${totalSources}] Title: ${p.title}\nAuthors: ${Array.isArray(p.authors) ? p.authors.join(', ') : p.authors}\nAbstract: ${p.abstract || 'N/A'}\nURL: ${pageUrl}\nPDF: ${pdfUrl}\n\n`;

          citationWidget += `**[${totalSources}] ${p.title}** (${p.year || 'Academic Paper'})\n`;
          if (p.authors && p.authors.length) citationWidget += `*Authors: ${Array.isArray(p.authors) ? p.authors.slice(0, 3).join(', ') : p.authors}*\n`;
          citationWidget += `📥 **[Download PDF](${pdfUrl})** &nbsp;|&nbsp; 🌐 **[View Source Page](${pageUrl})**\n\n`;
        });
      }

      // Append Web Results
      if (webResults && webResults.length > 0) {
        webResults.slice(0, 3).forEach((w) => {
          totalSources++;
          formattedContext += `[Source ${totalSources}] Title: ${w.title}\nSnippet: ${w.snippet}\nURL: ${w.url}\n\n`;

          citationWidget += `**[${totalSources}] ${w.title}**\n`;
          citationWidget += `${w.snippet.substring(0, 140)}...\n`;
          citationWidget += `🌐 **[Visit Web Source](${w.url})**\n\n`;
        });
      }

      citationWidget += `---`;

      return {
        papers: academicPapers || [],
        webResults: webResults || [],
        formattedContext: totalSources > 0 ? formattedContext : '',
        citationWidget: totalSources > 0 ? citationWidget : ''
      };
    } catch (err) {
      console.warn('PerplexityWebSearch error:', err.message);
      return { papers: [], webResults: [], formattedContext: '', citationWidget: '' };
    }
  }

  /**
   * Fetch live web search snippets via DuckDuckGo / Wikipedia Open APIs
   */
  static async #fetchWebSearchResults(query) {
    const cleanQuery = encodeURIComponent(query);
    const results = [];

    try {
      // DuckDuckGo Instant Answer API
      const ddgRes = await axios.get(`https://api.duckduckgo.com/?q=${cleanQuery}&format=json&no_html=1&skip_disambig=1`, { timeout: 3000 });
      if (ddgRes.data && ddgRes.data.AbstractText) {
        results.push({
          title: ddgRes.data.Heading || query,
          snippet: ddgRes.data.AbstractText,
          url: ddgRes.data.AbstractURL || `https://duckduckgo.com/?q=${cleanQuery}`
        });
      }

      if (ddgRes.data && ddgRes.data.RelatedTopics) {
        ddgRes.data.RelatedTopics.slice(0, 2).forEach(t => {
          if (t.Text && t.FirstURL) {
            results.push({
              title: t.Text.split(' - ')[0] || 'Web Reference',
              snippet: t.Text,
              url: t.FirstURL
            });
          }
        });
      }
    } catch (e) {
      // Fallback silent
    }

    return results;
  }
}

module.exports = PerplexityWebSearch;
