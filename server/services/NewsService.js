const xml2js = require('xml2js');

class NewsService {
  /**
   * Fetches latest research news from Google News RSS
   * @param {string} query - Search query (default: academic research news)
   */
  static async getLatestNews(query = 'MIT OR Berkeley OR IIT AI Research') {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(url);
      const xml = await response.text();
      
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xml);
      
      const items = result.rss.channel.item || [];
      const list = Array.isArray(items) ? items : [items];

      return list.slice(0, 10).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source: item.source._ || item.source,
        description: item.description
      }));
    } catch (err) {
      console.error('NewsService error:', err.message);
      return [];
    }
  }
}

module.exports = NewsService;
