import type { ChatProvider, IaResponse, HistoryMessage } from "./ChatProvider";

// Removemos a verificação de variáveis de ambiente aqui para evitar erros durante o build
// A verificação será feita em tempo de execução

export class OllamaProvider implements ChatProvider {
  async sendMessage(
    message: string,
    history: HistoryMessage[],
    initialPrompt: string
  ): Promise<IaResponse> {
    // Verificar se as variáveis de ambiente estão definidas em tempo de execução
    const baseUrl = process.env.OLLAMA_BASE_URL;
    const modelName = process.env.OLLAMA_MODEL_NAME;

    if (!baseUrl || !modelName) {
      throw new Error("As variáveis de ambiente OLLAMA_BASE_URL e OLLAMA_MODEL_NAME são necessárias.");
    }

    // Converte nosso formato de histórico para o formato do Ollama
    const messages = [
      { role: "system", content: initialPrompt },
      ...history.map(msg => ({
        role: msg.role === "model" ? "assistant" : "user",
        content: msg.parts[0].text,
      })),
      { role: "user", content: message },
    ];
    
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: modelName,
            messages: messages,
            format: 'json',
            stream: false,
        }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na comunicação com o Ollama: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    // Verificar se a resposta tem o formato esperado
    if (!data.message || !data.message.content) {
      throw new Error("Formato de resposta inválido da API Ollama");
    }

    try {
      const jsonResponse: IaResponse = JSON.parse(data.message.content);
      return jsonResponse;
    } catch (parseError) {
      console.error("Erro ao parsear resposta do Ollama:", parseError);
      console.error("Texto recebido:", data.message.content);
      
      // Retorna um erro estruturado
      return {
        status: "em_andamento",
        proxima_pergunta: {
          texto: "Desculpe, ocorreu um erro ao processar sua resposta. Você poderia repetir?",
          tipo_resposta: "texto",
          opcoes: null,
          placeholder: "Sua resposta..."
        },
        resumo_etapa: null,
        dados_coletados: {},
        relatorio_final: null
      };
    }
  }
}