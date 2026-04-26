// ─── ZiaLabs AI — ArXiv Paper Search Service ───
const { parseStringPromise } = require('xml2js');

const ARXIV_API = 'http://export.arxiv.org/api/query';

class ArxivService {
  /**
   * Search ArXiv for papers matching a query
   * @param {string} query - Search query
   * @param {number} maxResults - Max papers to return (default 10)
   * @returns {Promise<Array>} Normalized paper objects
   */
  static async search(query, maxResults = 10) {
    try {
      const params = new URLSearchParams({
        search_query: `all:${query}`,
        start: '0',
        max_results: String(maxResults),
        sortBy: 'relevance',
        sortOrder: 'descending',
      });

      const res = await fetch(`${ARXIV_API}?${params}`);
      if (!res.ok) throw new Error(`ArXiv API error: ${res.status}`);

      const xml = await res.text();
      const parsed = await parseStringPromise(xml, { explicitArray: false });

      const entries = parsed.feed.entry;
      if (!entries) return [];

      const items = Array.isArray(entries) ? entries : [entries];

      return items.map(entry => ArxivService.#normalize(entry));
    } catch (err) {
      console.error('ArXiv search error:', err.message);
      return [];
    }
  }

  /**
   * Normalize an ArXiv entry to a standard paper object
   */
  static #normalize(entry) {
    // Authors can be single object or array
    let authors = '';
    if (entry.author) {
      const authorList = Array.isArray(entry.author) ? entry.author : [entry.author];
      authors = authorList.map(a => a.name || a).join(', ');
    }

    // Get the HTML link
    let url = '';
    if (entry.id) {
      url = typeof entry.id === 'string' ? entry.id : entry.id._ || '';
    }

    // Get abstract
    let abstract = '';
    if (entry.summary) {
      abstract = (typeof entry.summary === 'string' ? entry.summary : entry.summary._ || '')
        .replace(/\n/g, ' ').trim();
    }

    return {
      title: (typeof entry.title === 'string' ? entry.title : entry.title?._ || 'Untitled')
        .replace(/\n/g, ' ').trim(),
      authors,
      abstract,
      source: 'arxiv',
      sourceUrl: url.replace('http://', 'https://'),
      published: entry.published || '',
      citations: 0,
    };
  }
}

module.exports = ArxivService;
