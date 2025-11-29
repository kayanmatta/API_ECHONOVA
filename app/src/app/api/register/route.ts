import { connectDB } from "@/lib/mongodb";
import Empresa from "@/models/Empresa";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Conecta ao banco de dados
    await connectDB();

    // Pega os dados enviados pelo front-end no body da requisição
    const { nome_empresa, cnpj, email, senha } = await req.json();

    // Verifica se já existe uma empresa com esse email
    const empresaExists = await Empresa.findOne({ email });
    if (empresaExists) {
      // Retorna erro 400 se já existir
      return NextResponse.json({ error: "Empresa já existe" }, { status: 400 });
    }

    // Gera o "salt" para o hash da senha (mais segurança)
    const salt = await bcrypt.genSalt(10);
    // Cria o hash da senha usando o salt
    const hashedPassword = await bcrypt.hash(senha, salt);

    // Cria a nova empresa no banco de dados
    const newEmpresa = await Empresa.create({
      nome_empresa, // nome da empresa
      cnpj, // cnpj da empresa
      email, // email de login
      senha: hashedPassword, // senha criptografada
    });

    // Retorna os dados da empresa criada (sem a senha, por segurança)
    return NextResponse.json(
      {
        user: {
          id: newEmpresa._id,
          nome: newEmpresa.nome_empresa,
          email: newEmpresa.email,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // Log do erro para depuração
    console.error("[API Register] Erro:", error);

    // Trata erros específicos do Mongoose (banco de dados)
    if (error instanceof Error && "code" in error) {
      // Erro de chave duplicada (usuário já existe)
      if ((error as any).code === 11000) {
        return NextResponse.json(
          { error: "Empresa já cadastrada com este email ou CNPJ." },
          { status: 400 }
        );
      }
    }

    // Erro genérico
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}