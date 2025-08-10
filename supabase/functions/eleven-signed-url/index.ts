// Supabase Edge Function: eleven-signed-url
// Deno runtime
// This function returns a signed URL for a private ElevenLabs Conversational AI agent
// and can also validate whether an agent exists in the current workspace.
// Requires Supabase secret: XI_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "*",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, validate } = await req.json();
    if (!agentId) {
      return new Response(JSON.stringify({ error: "Missing agentId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const XI_API_KEY = Deno.env.get("XI_API_KEY");
    if (!XI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing XI_API_KEY secret" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const headers = new Headers();
    headers.set("xi-api-key", XI_API_KEY);

    // Optional: validate agent existence in this workspace
    if (validate) {
      const validateUrl = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`;
      const vresp = await fetch(validateUrl, { method: "GET", headers });
      if (!vresp.ok) {
        const text = await vresp.text();
        return new Response(
          JSON.stringify({ valid: false, status: vresp.status, message: text }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      }
      const agent = await vresp.json();
      return new Response(
        JSON.stringify({ valid: true, agent: { id: agent?.agent_id || agentId, name: agent?.name, visibility: agent?.visibility } }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Default: create signed URL for websocket session
    const url = `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`;
    const resp = await fetch(url, { method: "GET", headers });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: "ElevenLabs error", details: text }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = await resp.json();

    return new Response(JSON.stringify({ signed_url: body.signed_url || body.url || body.signedUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error", details: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
