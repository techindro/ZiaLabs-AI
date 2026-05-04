const SS_API = 'https://api.semanticscholar.org/graph/v1/paper/search';

class SemanticScholarService {
  /**
   * Search Semantic Scholar for papers
   * @param {string} query - Search query
   * @param {number} maxResults - Max papers to return (default 10)
   * @returns {Promise<Array>} Normalized paper objects
   */
  static async search(query, maxResults = 10) {
    try {
      const params = new URLSearchParams({
        query,
        limit: String(maxResults),
        fields: 'title,authors,abstract,url,year,citationCount,externalIds',
      });

      const headers = { 'Accept': 'application/json' };
      const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
      if (apiKey) headers['x-api-key'] = apiKey;

      const res = await fetch(`${SS_API}?${params}`, { headers });
      if (!res.ok) {
        if (res.status === 429) {
          console.warn('Semantic Scholar rate limited, retrying in 2s...');
          await new Promise(r => setTimeout(r, 2000));
          const retry = await fetch(`${SS_API}?${params}`, { headers });
          if (!retry.ok) throw new Error(`SS API error: ${retry.status}`);
          const retryData = await retry.json();
          return (retryData.data || []).map(p => SemanticScholarService.#normalize(p));
        }
        throw new Error(`Semantic Scholar API error: ${res.status}`);
      }

      const data = await res.json();
      return (data.data || []).map(p => SemanticScholarService.#normalize(p));
    } catch (err) {
      console.error('Semantic Scholar search error:', err.message);
      return [];
    }
  }

  /**
   * Normalize a Semantic Scholar paper to standard format
   */
  static #normalize(paper) {
    let authors = '';
    if (paper.authors && Array.isArray(paper.authors)) {
      authors = paper.authors.map(a => a.name).join(', ');
    }

    let sourceUrl = paper.url || '';
    if (paper.externalIds?.ArXiv) {
      sourceUrl = `https://arxiv.org/abs/${paper.externalIds.ArXiv}`;
    }

    return {
      title: paper.title || 'Untitled',
      authors,
      abstract: paper.abstract || '',
      source: 'semantic_scholar',
      sourceUrl,
      published: paper.year ? String(paper.year) : '',
      citations: paper.citationCount || 0,
    };
  }
}

module.exports = SemanticScholarService;
