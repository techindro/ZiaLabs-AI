const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatMessage = require('../models/ChatMessage');
const User        = require('../models/User');

// system prompt — defines agent personality and output rules
const SYSTEM_PROMPT = `Tum ZiaLabs Research Agent ho — ek professional AI research assistant.

RULES:
1. Respond in the user's preferred language. You natively support Hindi, English, Bhojpuri, and Tamil. If the user doesn't specify, default to Hinglish (mix of Hindi + English) but keep a professional tone.
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
    const key = process.env.GEMINI_API_KEY;
    
    // Check if the user actually set their API key. 
    // Fallback to local mode if not.
    if (!key || key === 'your-gemini-api-key-here') {
      console.warn('API key missing — switching to local fallback');
      this.#genAI = null;
      this.#model = null;
    } else {
      this.#genAI = new GoogleGenerativeAI(key);
      this.#model = this.#genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        systemInstruction: SYSTEM_PROMPT,
      });
    }
  }

  async chat(userId, message) {
    // Check if the user hasn't burned through their quota for the month.
    if (!User.hasApiCallsRemaining(userId)) {
      return 'Bhai, aapka monthly limit khatam ho gaya hai. 🔒 Please Pro mein upgrade karo ya fir next month ka wait karo.';
    }

    ChatMessage.create({ userId, role: 'user', content: message });

    let response;

    if (!this.#model) {
      response = this.#fallback(message);
    } else {
      try {
        const history = ChatMessage.getRecentContext(userId, 20);

        // Gemini is picky about the role order (user -> model -> user).
        // If the context is messy, it throws a fit. Clean it up here.
        let validHistory = [];
        let expected = 'user';
        for (const msg of history.slice(0, -1)) {
          const role = msg.role === 'assistant' ? 'model' : 'user';
          if (role === expected) {
            validHistory.push({ role, parts: [{ text: msg.content }] });
            expected = role === 'user' ? 'model' : 'user';
          }
        }

        const chat   = this.#model.startChat({ history: validHistory });
        const result = await chat.sendMessage(message);
        response     = result.response.text();
      } catch (err) {
        console.error('AI error in chat:', err.message);
        response = `Yaar, kuch issue aa gaya: ${err.message}. Ek baar fir se try karo?`;
      }
    }

    ChatMessage.create({ userId, role: 'assistant', content: response });
    User.incrementApiCalls(userId);

    return response;
  }

  async summarizePaper(abstract, language = 'Hinglish') {
    if (!this.#model) {
      return 'AI summary available nahi hai — GEMINI_API_KEY set karo .env mein.';
    }
    try {
      const prompt = `Yeh ek research paper ka abstract hai. Isko ${language} mein 3-4 bullet points mein summarize karo:\n\n${abstract}`;
      const result = await this.#model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      return `Summary generation failed: ${err.message}`;
    }
  }

  async generateCode(paperContext, language = 'python') {
    if (!this.#model) {
      return '# AI code generation requires GEMINI_API_KEY\n# Set it in your .env file';
    }
    try {
      const prompt = `Is research paper ke context se ${language} code generate karo. Clean, commented code likho:\n\n${paperContext}`;
      const result = await this.#model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      return `# Code generation failed: ${err.message}`;
    }
  }

  // basic fallback when no api key is set
  #fallback(message) {
    const m = message.toLowerCase();
    if (m.includes('hello') || m.includes('hi') || m.includes('namaste')) {
      return 'Namaste! 🙏 Main ZiaLabs AI Agent hoon. Aaj kya research karna chahte hain?\n\n**Note:** Full AI ke liye GEMINI_API_KEY set karo `.env` mein.';
    }
    if (m.includes('paper') || m.includes('search') || m.includes('find')) {
      return '📄 Papers search karne ke liye sidebar mein **Search Papers** use karo. Main abhi limited mode mein hoon.';
    }
    if (m.includes('code') || m.includes('implement')) {
      return '💻 Code generation ke liye GEMINI_API_KEY chahiye:\n\n1. `.env` mein `GEMINI_API_KEY` set karo\n2. Free key: https://aistudio.google.com/apikey\n3. Server restart karo';
    }
    return `Samajh gaya: "${message}"\n\n⚠️ Abhi **limited mode** mein hoon. Full AI ke liye API key set karo aur server restart karo. 🚀`;
  }
}

module.exports = AIAgent;
