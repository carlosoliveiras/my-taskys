import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

// Cache access token in-memory on server side for global fallback
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

// Helper to fetch/refresh the OAuth access token from Google for a specific user or global fallback
async function getAccessTokenForUser(userId?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env");
    return null;
  }

  let refreshToken: string | null = null;

  if (userId) {
    // Fetch user tokens from database
    const supabaseService = createServiceClient();
    const { data, error } = await supabaseService
      .from("user_tokens")
      .select("provider_refresh_token, provider_token, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user tokens from DB:", error);
    }

    if (data?.provider_refresh_token) {
      refreshToken = data.provider_refresh_token;

      // If cached provider_token exists and is valid (< 50 minutes old), return it
      const tokenAgeMs = Date.now() - new Date(data.updated_at).getTime();
      if (data.provider_token && tokenAgeMs < 50 * 60 * 1000) {
        return data.provider_token;
      }
    }
  }

  // Fallback to global GOOGLE_REFRESH_TOKEN if no user-specific token is found
  if (!refreshToken) {
    refreshToken = process.env.GOOGLE_REFRESH_TOKEN || null;
    if (!refreshToken) {
      return null;
    }

    // Use cached global token if valid (minus 1 min buffer)
    if (cachedAccessToken && Date.now() < cachedTokenExpiresAt - 60000) {
      return cachedAccessToken;
    }
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to refresh Google token on server:", errorText);
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;

    if (userId && newAccessToken) {
      // Update access token in the database
      const supabaseService = createServiceClient();
      await supabaseService
        .from("user_tokens")
        .update({
          provider_token: newAccessToken,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else if (!userId && newAccessToken) {
      // Update global in-memory cache
      cachedAccessToken = newAccessToken;
      cachedTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    }

    return newAccessToken;
  } catch (err) {
    console.error("Error refreshing Google OAuth token on server:", err);
    return null;
  }
}

// Helper fetch with Bearer authorization and API key injection
async function googleTasksFetch(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
) {
  const apiKey = process.env.TASK_API_KEY || process.env.NEXT_PUBLIC_TASK_API_KEY || "";
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `https://tasks.googleapis.com${endpoint}${apiKey ? `${separator}key=${apiKey}` : ""}`;

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 204) {
    return { success: true };
  }
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google API returned status ${res.status}: ${errorText}`);
  }
  
  return res.json().catch(() => ({ success: true }));
}

// GET: Fetch Lists or Tasks
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const token = await getAccessTokenForUser(user?.id);

  if (!token) {
    return NextResponse.json({ demoMode: true, user: user || null });
  }

  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("listId");

  try {
    if (listId) {
      // Fetch tasks for the list
      const data = await googleTasksFetch(
        `/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`,
        token
      );
      return NextResponse.json({ demoMode: false, items: data.items || [], user });
    } else {
      // Fetch task lists
      const data = await googleTasksFetch("/tasks/v1/users/@me/lists", token);
      return NextResponse.json({ demoMode: false, items: data.items || [], user });
    }
  } catch (err: any) {
    console.error("Error in GET /api/tasks proxy:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create list/task or clear completed tasks
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const token = await getAccessTokenForUser(user?.id);

  if (!token) {
    return NextResponse.json({ error: "Google credentials not configured on server" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, type, title, listId, parent } = body;

    // Action: clear completed tasks
    if (action === "clear" && listId) {
      await googleTasksFetch(`/tasks/v1/lists/${listId}/clear`, token, { method: "POST" });
      return NextResponse.json({ success: true });
    }

    // Type: list
    if (type === "list" && title) {
      const data = await googleTasksFetch("/tasks/v1/users/@me/lists", token, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      return NextResponse.json(data);
    }

    // Type: task
    if (type === "task" && listId && title) {
      const parentParam = parent ? `?parent=${parent}` : "";
      const data = await googleTasksFetch(`/tasks/v1/lists/${listId}/tasks${parentParam}`, token, {
        method: "POST",
        body: JSON.stringify({
          title,
          status: "needsAction",
          parent: parent || undefined,
        }),
      });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid POST request body" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in POST /api/tasks proxy:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Rename list, move task or update task details
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const token = await getAccessTokenForUser(user?.id);

  if (!token) {
    return NextResponse.json({ error: "Google credentials not configured on server" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, id, title, listId, task, destinationListId } = body;

    // Type: list (rename)
    if (type === "list" && id && title) {
      const data = await googleTasksFetch(`/tasks/v1/users/@me/lists/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({ id, title }),
      });
      return NextResponse.json(data);
    }

    // Type: task
    if (type === "task" && listId && id) {
      // Case A: Move task to another list
      if (destinationListId) {
        const data = await googleTasksFetch(
          `/tasks/v1/lists/${listId}/tasks/${id}/move?destination=${destinationListId}`,
          token,
          { method: "POST" }
        );
        return NextResponse.json(data);
      }
      
      // Case B: Update task details
      if (task) {
        const data = await googleTasksFetch(`/tasks/v1/lists/${listId}/tasks/${id}`, token, {
          method: "PUT",
          body: JSON.stringify(task),
        });
        return NextResponse.json(data);
      }
    }

    return NextResponse.json({ error: "Invalid PUT request body" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in PUT /api/tasks proxy:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete list or task
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const token = await getAccessTokenForUser(user?.id);

  if (!token) {
    return NextResponse.json({ error: "Google credentials not configured on server" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const listId = searchParams.get("listId");

  try {
    // Delete list
    if (type === "list" && id) {
      await googleTasksFetch(`/tasks/v1/users/@me/lists/${id}`, token, { method: "DELETE" });
      return NextResponse.json({ success: true });
    }

    // Delete task
    if (type === "task" && listId && id) {
      await googleTasksFetch(`/tasks/v1/lists/${listId}/tasks/${id}`, token, { method: "DELETE" });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid DELETE parameters" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in DELETE /api/tasks proxy:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
