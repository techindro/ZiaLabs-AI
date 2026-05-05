const xml2js = require('xml2js');

// Using Google News RSS to populate the 'Latest Labs' section on the landing page.
// Much easier than managing a CMS for news - just fetch and parse XML.
class NewsService {
  static async getLatestNews(query = 'MIT OR Berkeley OR IIT AI Research') {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(url);
      const xml = await response.text();
      
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xml);
      
      const items = result.rss.channel.item || [];
      const list = Array.isArray(items) ? items : [items];

      return list.slice(0, 10).map(item => {
        // Strip the source name from the title if it exists (e.g. "News Title - Source")
        const cleanTitle = item.title.split(' - ')[0];
        
        return {
          title: cleanTitle,
          link: item.link,
          pubDate: item.pubDate,
          source: item.source._ || item.source,
          description: item.description
        };
      });
    } catch (err) {
      console.error('NewsService error:', err.message);
      return [];
    }
  }
}

module.exports = NewsService;
