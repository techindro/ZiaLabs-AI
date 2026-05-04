const ArxivService = require('./ArxivService');
const SemanticScholarService = require('./SemanticScholarService');

class PaperSearchOrchestrator {
  /** Available search sources */
  static SOURCES = {
    arxiv: ArxivService,
    semantic_scholar: SemanticScholarService,
  };

  /**
   * Search across multiple paper sources in parallel
   * @param {string} query - Search query
   * @param {string[]} sources - Sources to search (default: all)
   * @param {number} maxResults - Max results per source
   * @returns {Promise<Array>} Deduplicated, ranked results
   */
  static async search(query, sources = null, maxResults = 10) {
    const activeSources = sources || Object.keys(PaperSearchOrchestrator.SOURCES);

    // Run searches in parallel
    const promises = activeSources
      .filter(s => PaperSearchOrchestrator.SOURCES[s])
      .map(async (sourceName) => {
        try {
          const service = PaperSearchOrchestrator.SOURCES[sourceName];
          return await service.search(query, maxResults);
        } catch (err) {
          console.error(`Search error for ${sourceName}:`, err.message);
          return [];
        }
      });

    const results = await Promise.all(promises);
    const allPapers = results.flat();

    return PaperSearchOrchestrator.#deduplicateAndRank(allPapers);
  }

  /**
   * Deduplicate by title similarity and rank by citations + source diversity
   */
  static #deduplicateAndRank(papers) {
    const seen = new Map();

    for (const paper of papers) {
      const key = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
      const existing = seen.get(key);

      if (!existing || paper.citations > (existing.citations || 0)) {
        seen.set(key, paper);
      }
    }

    // Sort: papers with citations first, then by title
    return Array.from(seen.values()).sort((a, b) => {
      if (b.citations !== a.citations) return b.citations - a.citations;
      return a.title.localeCompare(b.title);
    });
  }
}

module.exports = PaperSearchOrchestrator;
