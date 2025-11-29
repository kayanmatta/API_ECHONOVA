import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  try {
    // Testar conexão com o banco de dados
    await connectDB();
    
    return NextResponse.json({ 
      status: "ok", 
      message: "Serviço operacional",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Erro no health check:", error);
    return NextResponse.json({ 
      status: "error", 
      message: "Falha na verificação de saúde",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 });
  }
}