import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import mongoose from "mongoose"; // --- NOVO IMPORTE ---
import { connectDB } from "@/lib/mongodb";
import { getChatProvider } from "@/lib/ai/providerFactory";
import { promptDiagnosticoAprofundado, getTrilhasParaPrompt } from "@/lib/prompts";
import AiSession from "@/models/AiSession";
import DiagnosticoAprofundado from "@/models/DiagnosticoAprofundado";
import Empresa from "@/models/Empresa";
import Trilha from "@/models/Trilha";
import type { HistoryMessage, IaResponse } from "@/lib/ai/ChatProvider";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

function getTextForHistory(iaResponse: IaResponse): string {
  if (iaResponse.status === "finalizado" && iaResponse.relatorio_final) {
    return iaResponse.relatorio_final;
  }
  if (iaResponse.status === "confirmacao" && iaResponse.resumo_etapa) {
    return iaResponse.resumo_etapa;
  }
  if (iaResponse.proxima_pergunta?.texto) {
    return iaResponse.proxima_pergunta.texto;
  }
  return "Ok, entendi. Podemos continuar.";
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Verificar e decodificar o token JWT
    const { payload } = await jwtVerify(token, secret);
    const empresaId = payload.id as string;

    // Conectar ao banco de dados
    await connectDB();

    // Buscar a empresa associada ao token
    const empresa = await Empresa.findById(empresaId);
    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    // Ler o corpo da requisição
    const body = await req.json();
    const { message, sessionId } = body;

    // Validar entrada
    if (!message) {
      return NextResponse.json({ error: "Mensagem é obrigatória." }, { status: 400 });
    }

    let session;
    let isNewSession = false;

    // Se foi fornecido um ID de sessão, tentar recuperar
    if (sessionId) {
      session = await AiSession.findById(sessionId);
      if (!session) {
        return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
      }
      // Verificar se a sessão pertence à empresa correta
      if (session.empresaId.toString() !== empresaId) {
        return NextResponse.json({ error: "Acesso negado à sessão." }, { status: 403 });
      }
    } else {
      // Criar uma nova sessão se não houver ID
      isNewSession = true;
      
      // Obter todas as trilhas disponíveis para incluir no prompt
      const todasTrilhas = await Trilha.find({}, 'nome descricao tags areasAbordadas nivel categoria metadados');
      const trilhasFormatadas = await getTrilhasParaPrompt();
      
      session = new AiSession({
        empresaId,
        history: [],
        initialPrompt: promptDiagnosticoAprofundado.replace('{TRILHAS_DISPONIVEIS}', trilhasFormatadas),
      });
    }

    // Obter o provedor de IA configurado (OpenAI, Gemini, etc.)
    const provider = getChatProvider();

    // Enviar a mensagem para a IA junto com o histórico
    const iaResponse: IaResponse = await provider.sendMessage(
      message,
      session.history,
      session.initialPrompt
    );

    // Se for uma nova sessão e a IA retornou um status iniciado, salvar no banco
    if (isNewSession && iaResponse.status === "iniciado") {
      await session.save();
    }

    // Se for uma sessão existente, atualizar o histórico
    if (!isNewSession) {
      // Adicionar a nova interação ao histórico
      session.history.push(
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ text: getTextForHistory(iaResponse) }] }
      );

      // Se o diagnóstico foi finalizado, salvar os dados completos
      if (iaResponse.status === "finalizado" && iaResponse.relatorio_final) {
        const diagnostico = new DiagnosticoAprofundado({
          empresaId,
          sessionId: session._id,
          dadosColetados: iaResponse.dados_coletados,
          relatorioFinal: iaResponse.relatorio_final,
          createdAt: new Date(),
        });
        await diagnostico.save();
        
        // Associar o diagnóstico à sessão
        session.diagnosticoId = diagnostico._id;
      }

      // Salvar as atualizações da sessão
      await session.save();
    }

    // Retornar a resposta da IA para o frontend
    return NextResponse.json({
      success: true,
      sessionId: session._id,
      iaResponse,
    });

  } catch (error: unknown) {
    console.error("Erro na API de Diagnóstico por IA:", error);
    
    // Tratamento específico para erros conhecidos
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { error: "Dados inválidos fornecidos." },
        { status: 400 }
      );
    }

    // Erro genérico
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Erro interno do servidor.", details: message },
      { status: 500 }
    );
  }
}