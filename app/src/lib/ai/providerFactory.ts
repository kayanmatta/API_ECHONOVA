import type { ChatProvider } from "./ChatProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { GeminiProvider } from "./GeminiProvider";
import { OllamaProvider } from "./OllamaProvider";

export function getChatProvider(): ChatProvider {
  const provider = process.env.AI_PROVIDER?.toUpperCase() || "GEMINI";

  switch (provider) {
    case "GEMINI":
      console.log("Usando o provedor: Google Gemini");
      return new GeminiProvider();
    case "OLLAMA":
      console.log("Usando o provedor: Ollama");
      return new OllamaProvider();
    case "OPENAI":
      console.log("Usando o provedor: OpenAI (ChatGPT)");
      return new OpenAIProvider();
    default:
      console.log(`Provedor "${provider}" não reconhecido, usando Google Gemini como padrão`);
      return new GeminiProvider();
  }
}