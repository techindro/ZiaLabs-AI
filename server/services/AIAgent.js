// ─── ZiaLabs AI — Core AI Agent Service ───
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

const SYSTEM_PROMPT = `Tum ZiaLabs Research Agent ho — ek professional AI research assistant.

RULES:
1. Hinglish mein baat karo (mix of Hindi + English) — professional tone rakho.
2. Key insights numbered list mein do.
3. Relevant papers aur sources cite karo jab bhi possible ho.
4. Code examples do jahan relevant ho (Python, R, MATLAB).
5. Dense technical content ko simple language mein explain karo.
6. Har response mein value add karo — generic answers mat do.
7. Agar user koi specific paper ya topic ke baare mein puche, detailed analysis do.
8. Mathematical formulas LaTeX notation mein likho jab needed ho.
9. Always be helpful, accurate, and research-focused.

FORMAT:
- Use **bold** for key terms
- Use numbered lists for insights/steps
- Use code blocks for code examples
- Keep responses concise but comprehensive`;

class AIAgent {
  #model;
  #genAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key-here') {
      console.warn('⚠️  GEMINI_API_KEY not set — AI agent will use fallback responses');
      this.#genAI = null;
      this.#model = null;
    } else {
      this.#genAI = new GoogleGenerativeAI(apiKey);
      this.#model = this.#genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        systemInstruction: SYSTEM_PROMPT,
      });
    }
  }

  /**
   * Send a message to the AI agent and get a response
   * @param {number} userId - User ID
   * @param {string} message - User's message
   * @returns {Promise<string>} AI response text
   */
  async chat(userId, message) {
    // Check API limits
    if (!User.hasApiCallsRemaining(userId)) {
      return 'Aapke API calls limit ho gaye hain is month ke liye. Please upgrade karo ya next month wait karo. 🔒';
    }

    // Save user message
    ChatMessage.create({ userId, role: 'user', content: message });

    let response;

    if (!this.#model) {
      // Fallback when no API key
      response = this.#fallbackResponse(message);
    } else {
      try {
        // Get conversation history for context
        const history = ChatMessage.getRecentContext(userId, 20);
        
        // Sanitize history: Gemini strictly requires alternating user/model roles starting with user
        let validHistory = [];
        let expectedRole = 'user';
        for (const msg of history.slice(0, -1)) {
          const role = msg.role === 'assistant' ? 'model' : 'user';
          if (role === expectedRole) {
            validHistory.push({ role, parts: [{ text: msg.content }] });
            expectedRole = role === 'user' ? 'model' : 'user';
          }
        }

        const chat = this.#model.startChat({ history: validHistory });
        const result = await chat.sendMessage(message);
        response = result.response.text();
      } catch (err) {
        console.error('AI Agent error:', err.message);
        response = `Sorry, AI agent mein error aaya: ${err.message}. Please try again.`;
      }
    }

    // Save assistant response & increment API calls
    ChatMessage.create({ userId, role: 'assistant', content: response });
    User.incrementApiCalls(userId);

    return response;
  }

  /**
   * Summarize a paper abstract using AI
   */
  async summarizePaper(abstract) {
    if (!this.#model) {
      return 'AI summary available nahi hai — GEMINI_API_KEY set karo .env mein.';
    }

    try {
      const prompt = `Yeh ek research paper ka abstract hai. Isko Hinglish mein 3-4 bullet points mein summarize karo:\n\n${abstract}`;
      const result = await this.#model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      return `Summary generation failed: ${err.message}`;
    }
  }

  /**
   * Generate code from a paper context
   */
  async generateCode(paperContext, language = 'python') {
    if (!this.#model) {
      return '# AI code generation requires GEMINI_API_KEY\n# Set it in your .env file';
    }

    try {
      const prompt = `Is research paper ke context se ${language} code generate karo. Clean, commented, production-ready code likho:\n\n${paperContext}`;
      const result = await this.#model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      return `# Code generation failed: ${err.message}`;
    }
  }

  /**
   * Fallback response when API key is not available
   */
  #fallbackResponse(message) {
    const lower = message.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi') || lower.includes('namaste')) {
      return 'Namaste! 🙏 Main ZiaLabs AI Agent hoon. Aaj kya research karna chahte hain?\n\n**Note:** Full AI functionality ke liye GEMINI_API_KEY set karo `.env` file mein.';
    }
    if (lower.includes('paper') || lower.includes('search') || lower.includes('find')) {
      return '📄 Papers search karne ke liye sidebar mein **Search Papers** option use karo. Main abhi limited mode mein hoon — full AI responses ke liye GEMINI_API_KEY configure karo.';
    }
    if (lower.includes('code') || lower.includes('implement')) {
      return '💻 Code generation ke liye mujhe GEMINI_API_KEY chahiye. Abhi ke liye:\n\n1. `.env` file mein `GEMINI_API_KEY` set karo\n2. Free key yahan se lo: https://aistudio.google.com/apikey\n3. Server restart karo';
    }

    return `Main aapka message samajh gaya: "${message}"\n\n⚠️ Abhi main **limited mode** mein hoon. Full AI agent activate karne ke liye:\n\n1. Google AI Studio se free API key lo: https://aistudio.google.com/apikey\n2. \`.env\` file mein \`GEMINI_API_KEY=your-key\` add karo\n3. Server restart karo\n\nPhir main properly research questions answer kar paunga! 🚀`;
  }
}

module.exports = AIAgent;
