import type { ChatProvider, IaResponse, HistoryMessage } from "./ChatProvider";

// Removemos a verificação de apiKey aqui para evitar erros durante o build
// A verificação será feita em tempo de execução

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider implements ChatProvider {
    async sendMessage(
        message: string,
        history: HistoryMessage[],
        initialPrompt: string
    ): Promise<IaResponse> {
        // Verificar se a chave de API está definida em tempo de execução
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("A variável de ambiente OPENAI_API_KEY não está definida.");
        }

        // Converte nosso formato de histórico para o formato do OpenAI
        const messages = [
            { role: "system", content: initialPrompt },
            ...history.map(msg => ({
                role: msg.role === "model" ? "assistant" : "user",
                content: msg.parts[0].text,
            })),
            { role: "user", content: message },
        ];

        const response = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // Verificar se a resposta tem o formato esperado
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Formato de resposta inválido da API OpenAI");
        }

        try {
            const jsonResponse: IaResponse = JSON.parse(data.choices[0].message.content);
            return jsonResponse;
        } catch (parseError) {
            console.error("Erro ao parsear resposta da OpenAI:", parseError);
            console.error("Texto recebido:", data.choices[0].message.content);
            
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