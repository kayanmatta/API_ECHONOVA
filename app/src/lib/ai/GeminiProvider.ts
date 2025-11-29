import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatProvider, IaResponse, HistoryMessage } from "./ChatProvider";

export class GeminiProvider implements ChatProvider {
    async sendMessage(
        message: string,
        history: HistoryMessage[],
        initialPrompt: string
    ): Promise<IaResponse> {
        // Verificar se a chave de API está definida em tempo de execução
        const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("A variável de ambiente GOOGLE_GEMINI_API_KEY não está definida.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Configura o modelo do Google Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Converte nosso formato de histórico para o formato do Google
        const chatHistory = [
            {
                role: "user",
                parts: [{ text: initialPrompt }]
            },
            ...history.map(msg => ({
                role: msg.role,
                parts: msg.parts
            }))
        ];

        // Inicia um chat com o histórico
        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                responseMimeType: "application/json",
            },
        });

        // Envia a nova mensagem
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        try {
            // Tenta parsear a resposta como JSON
            const jsonResponse: IaResponse = JSON.parse(text);
            return jsonResponse;
        } catch (parseError) {
            console.error("Erro ao parsear resposta da IA:", parseError);
            console.error("Texto recebido:", text);
            
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