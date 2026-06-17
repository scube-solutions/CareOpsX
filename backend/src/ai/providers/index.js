const { GroqProvider } = require('./groq');

// Provider factory — selects the LLM backend from env (AI_PROVIDER).
// Add new providers here as they are implemented (openai, gemini, claude…).
// The orchestrator calls getProvider() and is agnostic to the choice.
let cached = null;

const getProvider = () => {
  if (cached) return cached;
  const name = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  switch (name) {
    case 'groq':
      cached = new GroqProvider();
      break;
    // case 'openai': cached = new OpenAIProvider(); break;
    // case 'gemini': cached = new GeminiProvider(); break;
    // case 'claude': cached = new ClaudeProvider(); break;
    default:
      throw new Error(`Unsupported AI_PROVIDER "${name}". Supported: groq`);
  }
  return cached;
};

module.exports = { getProvider };
