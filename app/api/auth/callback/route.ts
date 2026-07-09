import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      renderHtmlPage("Erro na Autorização", `Ocorreu um erro ao autorizar com o Google: ${error}`, false),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new NextResponse(
      renderHtmlPage("Código Ausente", "Código de autorização não fornecido pela API do Google.", false),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId || "",
        client_secret: clientSecret || "",
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorDetails = await tokenResponse.text();
      console.error("Failed to exchange code for tokens:", errorDetails);
      return new NextResponse(
        renderHtmlPage(
          "Falha na Troca de Token",
          `O Google rejeitou a troca do código. Verifique se seu Client ID e Client Secret estão corretos no arquivo .env.<br/><br/><small class="text-zinc-500">${errorDetails}</small>`,
          false
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    const tokens = await tokenResponse.json();
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return new NextResponse(
        renderHtmlPage(
          "Aviso: Refresh Token Ausente",
          "O Google não retornou um <strong>refresh_token</strong>. Isso ocorre porque o aplicativo já está autorizado no seu Google. Para corrigir, acesse <a href='https://myaccount.google.com/connections' target='_blank' class='text-blue-500 underline'>Conexões da sua Conta Google</a>, remova a permissão do seu app <strong>my-tasks-501719</strong>, e tente novamente o fluxo de autorização.",
          true
        ),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new NextResponse(
      renderHtmlPage(
        "Sucesso! Token Gerado",
        `Copie o token abaixo e cole-o no seu arquivo <strong>.env</strong> no campo <strong>GOOGLE_REFRESH_TOKEN</strong>:<br/><br/>
         <div class="relative bg-zinc-900 border border-zinc-700 rounded-xl p-4 font-mono text-zinc-100 text-xs break-all select-all flex items-center justify-between gap-4">
           <span>${refreshToken}</span>
         </div>
         <p class="mt-4 text-xs text-zinc-400">Após salvar o .env, reinicie o servidor do Next.js (se necessário) e recarregue a página principal do Tasky.</p>`,
        true
      ),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err: any) {
    console.error("Token exchange exception:", err);
    return new NextResponse(
      renderHtmlPage("Erro do Servidor", `Exceção capturada: ${err.message}`, false),
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

function renderHtmlPage(title: string, message: string, isSuccess: boolean) {
  const brandGradient = isSuccess ? "from-emerald-600 to-teal-600" : "from-red-600 to-rose-600";
  const iconSvg = isSuccess 
    ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tasky Auth Callback</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body {
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #09090b;
          color: #f4f4f5;
        }
      </style>
    </head>
    <body class="flex min-h-screen flex-col items-center justify-center p-4">
      <div class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center shadow-2xl backdrop-blur-md">
        <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr ${brandGradient} shadow-lg shadow-emerald-500/10">
          ${iconSvg}
        </div>
        <h1 class="text-xl font-bold text-zinc-50 mb-3">${title}</h1>
        <div class="text-sm leading-relaxed text-zinc-300 text-left mb-6">
          ${message}
        </div>
        <div class="flex flex-col gap-2">
          <a href="http://localhost:3000" class="inline-flex h-10 w-full items-center justify-center rounded-xl bg-zinc-800 text-sm font-semibold hover:bg-zinc-700 transition-colors">
            Voltar para o Tasky
          </a>
        </div>
      </div>
    </body>
    </html>
  `;
}
