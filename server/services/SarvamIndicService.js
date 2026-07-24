/**
 * Sarvam AI — Indic Sovereign AI Research Service
 * Inspired by Sarvam AI's Indic models, regional language intelligence, and Indian scientific research archives.
 */
class SarvamIndicService {
  static INDIC_LANGUAGES = [
    { code: 'hi', name: 'हिंदी (Hindi)', flag: '🇮🇳' },
    { code: 'sa', name: 'संस्कृतम् (Sanskrit)', flag: '🔱' },
    { code: 'bho', name: 'भोजपुरी (Bhojpuri)', flag: '🌾' },
    { code: 'ta', name: 'தமிழ் (Tamil)', flag: '🌺' },
    { code: 'bn', name: 'বাংলা (Bengali)', flag: '🐅' },
    { code: 'te', name: 'తెలుగు (Telugu)', flag: '🪷' },
    { code: 'mr', name: 'मराठी (Marathi)', flag: '🚩' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)', flag: '🦁' },
    { code: 'kn', name: 'கன்னட (Kannada)', flag: '🐘' },
    { code: 'ml', name: 'മലയാളം (Malayalam)', flag: '🌴' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🌾' },
    { code: 'en', name: 'English (India)', flag: '🌐' }
  ];

  static INDIAN_RESEARCH_HUBS = [
    { id: 'iisc', name: 'IISc Bangalore', logo: '/img/iisc_bg.png', focus: 'Deep Tech, Quantum, AI' },
    { id: 'iitd', name: 'IIT Delhi', logo: '/img/iitd_bg.png', focus: 'Engineering, Energy, AI' },
    { id: 'iitb', name: 'IIT Bombay', logo: '/img/iitb_bg.png', focus: 'Robotics, Materials, Biotech' },
    { id: 'isro', name: 'ISRO Space Research', logo: '/img/isro_space_real.png', focus: 'Aerospace, Remote Sensing' },
    { id: 'csir', name: 'CSIR India', logo: '/img/google_campus_real.png', focus: 'Chemical & Industrial' }
  ];

  /**
   * Enhances AI prompt with Sarvam Indic model instructions and Indian context.
   */
  static getIndicSystemPrompt() {
    return `You are ZiaLabs AI — powered by Sarvam AI Indic Sovereign Intelligence & Global Research Matrix.
Always respect Indian cultural nuance, scientific excellence from IISc, IITs, ISRO, and CSIR, and provide warm, respectful, and highly accurate research guidance in Indian regional languages when requested.`;
  }
}

module.exports = SarvamIndicService;
