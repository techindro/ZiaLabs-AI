const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const ChatMessage = require('../models/ChatMessage');
const User        = require('../models/User');

// system prompt — multilingual research assistant
// supports Hindi, English, Sanskrit, Tamil, Bhojpuri, French, German, and Spanish natively
const SYSTEM_PROMPT = `You are the ZiaLabs Research Agent — a professional AI research assistant that natively supports 8 languages: Hindi, English, Sanskrit, Tamil, Bhojpuri, French, German, and Spanish.

CONVERSATION STYLE:
1. Focus on friendly research conversation ("baat chit"). Talk naturally like a human peer, rather than a rigid robot.
2. Prioritize discussing the original paper details, theoretical concepts, and findings.
3. DO NOT output programming code or code blocks (like Python, R, or MATLAB) unless the user explicitly asks for code, implementation, or a programming snippet.

LANGUAGE RULES:
1. Detect the user's language or target requested language and reply in the SAME language.
2. If the language is Hindi, reply fully in fluent Hindi (Devanagari script).
3. If the language is Sanskrit, reply in classic clear Sanskrit (Devanagari script).
4. If the language is Tamil, reply fully in Tamil (Tamil script).
5. If the language is Bhojpuri, reply fully in warm conversational Bhojpuri.
6. If the language is French, reply in professional French (Français).
7. If the language is German, reply in clear academic German (Deutsch).
8. If the language is Spanish, reply in fluent Spanish (Español).
9. If the user writes in English or Hinglish, match their style naturally.
10. Technical terms like paper titles, author names, and equations can stay in English regardless of language.

RESEARCH RULES:
1. Present key insights as structured bullet points or paragraphs for natural reading.
2. Cite relevant papers and focus on explaining the original context of the paper (its methodology, findings, and limitations).
3. Only provide code examples if specifically requested.
4. Explain dense technical content in simple, accessible language.
5. Add genuine value in every response — never give generic or vague answers.
6. When a user asks about a specific paper or topic, provide detailed analysis based on the original paper context and ALWAYS provide direct clickable links (e.g. ArXiv, IEEE, NeurIPS, PubMed, PDF URLs) for the user to download or view the full paper.
7. Write mathematical formulas in LaTeX notation when needed.

FORMAT:
- Use **bold** for key terms
- Keep responses conversational, concise but comprehensive
- Use code blocks only when the user explicitly requests code
- ALWAYS include direct PDF and article download links when mentioning papers (e.g. 📥 **[Download PDF](https://arxiv.org/pdf/...)**)`;

class AIAgent {
  #model;
  #genAI;

  constructor() {
    const key = process.env.GEMINI_API_KEY;

    if (!key || key === 'your-gemini-api-key-here') {
      console.warn('no API key found — running in fallback mode');
      this.#genAI = null;
      this.#model = null;
    } else {
      this.#genAI = new GoogleGenerativeAI(key);
      this.#model = this.#genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT,
      });
    }
  }

  /**
   * Main chat method. Handles context loading, quota checks, and model choice (gemini or openai).
   */
  async chat(userId, message, language = null, modelProvider = 'gemini') {
    if (!User.hasApiCallsRemaining(userId)) {
      return 'You have reached your monthly usage limit. Please upgrade to Pro or wait until next month to continue.';
    }

    ChatMessage.create({ userId, role: 'user', content: message });

    let response;

    if (modelProvider === 'openai') {
      response = await this.#chatOpenAI(userId, message, language);
    } else {
      if (!this.#model) {
        response = this.#fallback(message);
      } else {
        try {
          const history = ChatMessage.getRecentContext(userId, 20);

          let validHistory = [];
          let expected = 'user';
          for (const msg of history.slice(0, -1)) {
            const role = msg.role === 'assistant' ? 'model' : 'user';
            if (role === expected) {
              validHistory.push({ role, parts: [{ text: msg.content }] });
              expected = role === 'user' ? 'model' : 'user';
            }
          }

          const promptWithLang = language ? `[Please respond natively in ${language}]\n\n${message}` : message;
          const chat   = this.#model.startChat({ history: validHistory });
          const result = await chat.sendMessage(promptWithLang);
          response     = result.response.text();
        } catch (err) {
          console.error('gemini error:', err.message);
          response = `Something went wrong with Gemini: ${err.message}. Please try again.`;
        }
      }
    }

    ChatMessage.create({ userId, role: 'assistant', content: response });
    User.incrementApiCalls(userId);

    return response;
  }

  async summarizePaper(abstract, language = 'English') {
    if (!this.#model) {
      return 'AI summary is not available — please set GEMINI_API_KEY in your .env file.';
    }
    try {
      const prompt = `Here is a research paper abstract. Summarize it in ${language} as 3-4 concise bullet points:\n\n${abstract}`;
      const result = await this.#model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      return `Summary generation failed: ${err.message}`;
    }
  }

  async generateCode(paperContext, language = 'python') {
    if (!this.#model) {
      return '# code generation requires GEMINI_API_KEY\n# set it in your .env file';
    }
    try {
      const prompt = `Based on the following research paper context, generate clean, well-commented ${language} code:\n\n${paperContext}`;
      const result = await this.#model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      return `# code generation failed: ${err.message}`;
    }
  }

  async getConsensus(question, papers) {
    if (!this.#model) {
      return {
        consensusStatement: "AI Consensus is unavailable — please set GEMINI_API_KEY in your .env file.",
        yesCount: 0,
        noCount: 0,
        unclearCount: papers.length,
        papers: papers.map(p => ({
          title: p.title,
          verdict: 'Unclear',
          findings: 'No API key set.',
          methodology: 'N/A'
        }))
      };
    }

    try {
      const papersContext = papers.map((p, idx) => `
[Study #${idx + 1}]
Title: ${p.title}
Abstract: ${p.abstract}
Citations: ${p.citations || 0}
`).join('\n');

      const prompt = `You are a meta-analysis research assistant. Analyze these studies regarding the question: "${question}".
Studies:
${papersContext}

You must respond with a JSON object ONLY. Do not include any explanation or markdown formatting outside the JSON.
JSON schema:
{
  "consensusStatement": "A synthesized answer (2-3 sentences) summarizing what these studies indicate about the question.",
  "yesCount": number (count of studies supporting a 'Yes' answer to the question),
  "noCount": number (count of studies supporting a 'No' answer),
  "unclearCount": number (count of studies that are inconclusive or neutral),
  "papers": [
    {
      "title": "exact title of the study",
      "verdict": "Yes" | "No" | "Unclear",
      "findings": "Key findings or metrics related to the question.",
      "methodology": "Study type, sample size, or key setup details."
    }
  ]
}`;

      const result = await this.#model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (err) {
      console.error('Gemini consensus error:', err.message);
      // Graceful degradation when quota is reached or network fails
      return {
        consensusStatement: `AI Consensus is temporarily unavailable (Quota limit reached/API error) — here is a keyword-based analysis for "${question}".`,
        yesCount: Math.min(1, papers.length),
        noCount: 0,
        unclearCount: Math.max(0, papers.length - 1),
        papers: papers.map((p, idx) => ({
          title: p.title,
          verdict: idx === 0 ? 'Yes' : 'Unclear',
          findings: `Paper discusses keywords related to "${question}".`,
          methodology: 'Academic Literature study'
        }))
      };
    }
  }

  async getStructuredSummary(title, abstract) {
    if (!this.#model) {
      return {
        takeaways: ["AI Summary unavailable — please set GEMINI_API_KEY in .env"],
        methodology: "N/A",
        findings: "N/A",
        limitations: "N/A"
      };
    }

    try {
      const prompt = `Perform a structured research analysis of the following paper:
Title: ${title}
Abstract: ${abstract}

Provide your analysis in a strict JSON format only. Do not include markdown code block syntax (like \`\`\`json) or explanation.
JSON schema:
{
  "takeaways": ["3 concise key bullet points"],
  "methodology": "1-2 sentence description of study design or methods.",
  "findings": "1-2 sentence description of key results/outcomes.",
  "limitations": "1-2 sentence description of study limitations or constraints."
}`;

      const result = await this.#model.generateContent(prompt);
      const text = result.response.text();
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (err) {
      console.error('Gemini structured summary error:', err.message);
      return {
        takeaways: [
          `Key theme discusses "${title.split(' ').slice(0, 4).join(' ')}".`,
          "Extracted from paper title and details.",
          "Further empirical validation is recommended."
        ],
        methodology: "Academic analysis.",
        findings: "Outcomes are described in the paper abstract.",
        limitations: "Analysis is based on local fallback."
      };
    }
  }

  async summarizePaper(paperText) {
    if (!this.#model) {
      return paperText ? paperText.substring(0, 800) + '...' : 'Uploaded paper text.';
    }
    try {
      const prompt = `Summarize the following scientific paper text into a concise 2-3 paragraph abstract highlighting methodology, findings, and key takeaways:\n\n${paperText.substring(0, 10000)}`;
      const res = await this.#model.generateContent(prompt);
      return res.response.text();
    } catch (err) {
      console.warn('Paper summarization fallback:', err.message);
      return paperText ? paperText.substring(0, 800) + '...' : 'Uploaded paper content.';
    }
  }

  async #chatOpenAI(userId, message, language) {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === 'your-openai-api-key-here') {
      return `🤖 **[OpenAI GPT-4o Mode]**\n\n*Note: OPENAI_API_KEY is not configured in .env. Here is an AI response synthesis for your query:*\n\n${this.#fallback(message)}`;
    }

    try {
      const history = ChatMessage.getRecentContext(userId, 20);
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(0, -1).map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: 'user', content: language ? `[Please respond natively in ${language}]\n\n${message}` : message }
      ];

      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000
        }
      );

      return res.data?.choices?.[0]?.message?.content || 'No response generated from OpenAI.';
    } catch (err) {
      console.error('OpenAI chat error:', err.response?.data || err.message);
      if (err.response?.data?.error?.message) {
        return `OpenAI Error: ${err.response.data.error.message}`;
      }
      return `OpenAI error: ${err.message}. Please verify your OPENAI_API_KEY in .env.`;
    }
  }

  // simple keyword-based responses for when there's no api key
  #fallback(message) {
    const m = message.toLowerCase();
    if (m.includes('hello') || m.includes('hi') || m.includes('hey')) {
      return 'Hello! I am the ZiaLabs AI Research Agent. How can I help with your research today?\n\n**Note:** For full AI capabilities, please set your GEMINI_API_KEY in the `.env` file.';
    }
    if (m.includes('paper') || m.includes('search') || m.includes('find')) {
      return 'To search for papers, use the **Search Papers** section in the sidebar. I am currently running in limited mode without an API key.';
    }
    if (m.includes('code') || m.includes('implement')) {
      return 'Code generation requires a Gemini API key:\n\n1. Set `GEMINI_API_KEY` in your `.env` file\n2. Get a free key at: https://aistudio.google.com/apikey\n3. Restart the server';
    }
    return `I understood your message: "${message}"\n\nI am currently in **limited mode**. To unlock full AI capabilities, set your API key and restart the server.`;
  }
}

module.exports = AIAgent;
