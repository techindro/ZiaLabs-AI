/**
 * Paper Link Extractor & PDF Parser Service
 * Supports ArXiv, NeurIPS, IEEE Xplore, PubMed, Semantic Scholar, and Direct PDF URLs.
 */
class PaperLinkParser {
  /**
   * Detects and parses paper URLs in text message.
   */
  static parse(message) {
    if (!message || typeof message !== 'string') return null;

    // 1. ArXiv Link Pattern
    const arxivMatch = message.match(/https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)(?:v\d+)?(?:\.pdf)?/i);
    if (arxivMatch) {
      const arxivId = arxivMatch[1];
      return {
        type: 'ArXiv',
        id: arxivId,
        url: arxivMatch[0],
        pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
        abstractUrl: `https://arxiv.org/abs/${arxivId}`,
        title: `ArXiv Paper (${arxivId})`
      };
    }

    // 2. NeurIPS Link Pattern
    const neuripsMatch = message.match(/https?:\/\/proceedings\.neurips\.cc\/paper_files\/paper\/(\d+)\/(?:hash|file)\/([a-f0-9]+)(?:-[A-Za-z0-9_-]+)?\.(html|pdf)/i);
    if (neuripsMatch) {
      const year = neuripsMatch[1];
      const hash = neuripsMatch[2];
      return {
        type: 'NeurIPS',
        id: hash,
        url: neuripsMatch[0],
        pdfUrl: `https://proceedings.neurips.cc/paper_files/paper/${year}/file/${hash}-Paper-Conference.pdf`,
        abstractUrl: `https://proceedings.neurips.cc/paper_files/paper/${year}/hash/${hash}-Abstract-Conference.html`,
        title: `NeurIPS ${year} Conference Paper`
      };
    }

    // 3. IEEE Xplore Link Pattern
    const ieeeMatch = message.match(/https?:\/\/ieeexplore\.ieee\.org\/(?:document|stamp\/stamp\.jsp\?.*arnumber=)(\d+)/i);
    if (ieeeMatch) {
      const docId = ieeeMatch[1];
      return {
        type: 'IEEE Xplore',
        id: docId,
        url: ieeeMatch[0],
        pdfUrl: `https://ieeexplore.ieee.org/stamp/stamp.jsp?arnumber=${docId}`,
        abstractUrl: `https://ieeexplore.ieee.org/document/${docId}`,
        title: `IEEE Xplore Paper (ID: ${docId})`
      };
    }

    // 4. Direct PDF Link Pattern
    const pdfMatch = message.match(/https?:\/\/[^\s]+\.pdf(?:\?[^\s]*)?/i);
    if (pdfMatch) {
      const pdfUrl = pdfMatch[0];
      const filename = pdfUrl.split('/').pop().split('?')[0] || 'research_paper.pdf';
      return {
        type: 'Direct PDF',
        id: filename,
        url: pdfUrl,
        pdfUrl: pdfUrl,
        abstractUrl: pdfUrl,
        title: filename
      };
    }

    // 5. PubMed Link Pattern
    const pubmedMatch = message.match(/https?:\/\/(?:www\.)?ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)|pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);
    if (pubmedMatch) {
      const pmid = pubmedMatch[1] || pubmedMatch[2];
      return {
        type: 'PubMed',
        id: pmid,
        url: pubmedMatch[0],
        pdfUrl: `https://www.ncbi.nlm.nih.gov/pmc/articles/pmid/${pmid}/pdf/`,
        abstractUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        title: `PubMed Research Article (PMID: ${pmid})`
      };
    }

    return null;
  }

  /**
   * Generates formatted Markdown download widget for detected paper link.
   */
  static formatWidget(paper) {
    if (!paper) return '';
    return `\n\n---\n### 📄 **Direct Paper Download & Citation Source**\n` +
      `- **Source Platform**: \`${paper.type}\`\n` +
      `- **Paper Title / Identifier**: **${paper.title}**\n\n` +
      `📥 **[Download Full Paper PDF](${paper.pdfUrl})** &nbsp;|&nbsp; ` +
      `🌐 **[View Source Article](${paper.abstractUrl})**\n---`;
  }
}

module.exports = PaperLinkParser;
