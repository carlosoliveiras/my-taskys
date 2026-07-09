@AGENTS.md

## Supabase Google OAuth Setup

### Fluxo de Configuração

1. **Autenticar com Supabase MCP**
   - CLI: `/mcp` → select "claude.ai Supabase"
   - Conecta com sua conta Supabase

2. **Obter URLs e Chaves do Projeto**
   - Use `mcp__claude_ai_Supabase__get_project_url` → retorna `https://{project-id}.supabase.co`
   - Use `mcp__claude_ai_Supabase__get_publishable_keys` → retorna anon key + service_role key

3. **Configurar Variáveis de Ambiente (.env)**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://{project-id}.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   GOOGLE_CLIENT_ID=226695038952-lj2ci34kg0cl1hpprhbv0254ms58n0al.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

4. **Habilitar Google Provider no Supabase**
   - Dashboard Supabase → Auth → Providers → Google
   - Enable toggle (ON)
   - Colar `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
   - Callback URL auto: `https://{project-id}.supabase.co/auth/v1/callback`
   - Save

5. **Fluxo de Login (já implementado)**
   - `components/TaskApp.tsx:223` → `handleGoogleLogin()`
   - Chama `supabase.auth.signInWithOAuth({ provider: 'google', ... })`
   - Redireciona para Google → volta em `/auth/callback`
   - Route `app/auth/callback/route.ts:5` → troca code por session Supabase
   - Salva Google tokens em `user_tokens` table

6. **Troubleshooting**
   - Erro "provider is not enabled" → Google provider não habilitado no Supabase
   - Erro "Unsupported provider" → Verificar se Google está marcado como ativo
   - Callback URL mismatch → Usar URL exata do projeto Supabase
