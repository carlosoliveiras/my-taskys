import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { user, provider_token, provider_refresh_token } = data.session;
      const supabaseService = createServiceClient();

      // Check if user already has a token row
      const { data: existingToken } = await supabaseService
        .from("user_tokens")
        .select("provider_refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (provider_refresh_token) {
        // Save or overwrite both tokens (this happens on first login or when prompt=consent is triggered)
        await supabaseService
          .from("user_tokens")
          .upsert({
            user_id: user.id,
            provider_refresh_token: provider_refresh_token,
            provider_token: provider_token || null,
            updated_at: new Date().toISOString(),
          });
      } else if (provider_token) {
        // If we only got a provider_token, update it in the database if the row exists
        if (existingToken) {
          await supabaseService
            .from("user_tokens")
            .update({
              provider_token: provider_token,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);
        } else {
          // If no row exists, we insert it anyway, but alert about the missing refresh token
          console.warn("No existing refresh token found for user. Access to Google Tasks will fail after token expiry.");
          await supabaseService
            .from("user_tokens")
            .upsert({
              user_id: user.id,
              provider_refresh_token: "", // Placeholder, will fail API requests but allows login
              provider_token: provider_token,
              updated_at: new Date().toISOString(),
            });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    } else if (error) {
      console.error("Error exchanging code for session:", error);
    }
  }

  // Redirect to home page with error parameter
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
