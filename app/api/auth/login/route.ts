import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID não está configurado no arquivo .env" },
      { status: 500 }
    );
  }

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback`;
  const scope = "https://www.googleapis.com/auth/tasks";
  
  // Google OAuth 2.0 Auth URL
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("access_type", "offline"); // Crucial to get the refresh_token
  authUrl.searchParams.append("prompt", "consent"); // Force consent screen to always get a refresh_token

  return NextResponse.redirect(authUrl.toString());
}
