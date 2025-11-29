import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose"; // Importa a função para criar o JWT
import { connectDB } from "@/lib/mongodb";
import Empresa from "@/models/Empresa";

// Chave secreta para assinar o token. É crucial que ela esteja em variáveis de ambiente.
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Constantes do administrador
const ADMIN_EMAIL = 'admin@echonova.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_CNPJ = '00000000000000';

/**
 * Verifica se o administrador existe no banco de dados.
 * Se não existir, cria automaticamente.
 */
async function ensureAdminExists() {
  try {
    // Verificar se já existe um admin
    const existingAdmin = await Empresa.findOne({ tipo_usuario: 'ADMIN' });

    if (existingAdmin) {
      return;
    }

    // Criar admin se não existir
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    const admin = await Empresa.create({
      nome_empresa: 'Administração EchoNova',
      email: ADMIN_EMAIL,
      cnpj: ADMIN_CNPJ,
      senha: hashedPassword,
      tipo_usuario: 'ADMIN',
      planoAtivo: 'escalado'
    });

    console.log('✅ Administrador criado automaticamente no login');
    console.log(`   📧 Email: ${ADMIN_EMAIL}`);
  } catch (error) {
    console.error('❌ Erro ao criar administrador:', error);
  }
}

export async function POST(req: Request) {
  try {
    const { email, senha } = await req.json();

    // Conecta ao banco de dados
    await connectDB();
    
    // Garantir que o admin exista
    await ensureAdminExists();

    // Busca a empresa no banco pelo email
    const empresa = await Empresa.findOne({ email });

    // Se não encontrar, retorna erro
    if (!empresa) {
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    // Compara a senha fornecida com a senha criptografada do banco
    const isPasswordValid = await bcrypt.compare(senha, empresa.senha);

    // Se a senha estiver incorreta, retorna erro
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    // Se tudo estiver certo, cria o token JWT
    const token = await new SignJWT({ 
      id: empresa._id, 
      email: empresa.email,
      nome_empresa: empresa.nome_empresa,
      tipo_usuario: empresa.tipo_usuario,
      plano: empresa.planoAtivo
    })
      .setProtectedHeader({ alg: "HS256" }) // Algoritmo de assinatura
      .setIssuedAt() // Define quando o token foi emitido
      .setExpirationTime("7d") // Expira em 7 dias
      .sign(secret); // Assina o token com a chave secreta

    // Retorna o token em um cookie HttpOnly (seguro contra XSS)
    const response = NextResponse.json({
      success: true,
      user: {
        id: empresa._id,
        email: empresa.email,
        nome_empresa: empresa.nome_empresa,
        tipo_usuario: empresa.tipo_usuario,
        plano: empresa.planoAtivo
      }
    });

    // Configura o cookie com as opções de segurança apropriadas
    response.cookies.set("auth_token", token, {
      httpOnly: true, // Protege contra XSS
      secure: process.env.NODE_ENV === "production", // Só usa HTTPS em produção
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: "/", // Disponível em todo o site
      sameSite: "strict", // Protege contra CSRF
    });

    return response;
  } catch (error: unknown) {
    // Em caso de erro, loga e retorna uma mensagem genérica
    console.error("Erro no login:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}