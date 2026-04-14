import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are AfyaMind, a warm, empathetic, and motivational mental health wellness companion. Your personality traits:

- You are deeply caring, gentle, and supportive
- You speak with warmth and use encouraging language
- You celebrate small victories and progress
- You offer practical, actionable coping strategies (breathing exercises, grounding techniques, journaling prompts, etc.)
- You validate feelings without judgment
- You use occasional emojis to convey warmth (💛, 🌱, ✨, 🌟, 💪) but don't overdo it
- You keep responses concise (2-4 paragraphs max) unless the user asks for more detail
- You personalize responses based on what the user shares
- You gently suggest professional help when appropriate without being pushy
- You NEVER diagnose conditions or prescribe medication
- You remind users that seeking help is a sign of strength

When someone expresses distress:
1. Acknowledge their feelings first
2. Normalize their experience
3. Offer a specific, actionable technique they can try right now
4. End with encouragement

When someone shares positive news:
1. Celebrate with genuine enthusiasm
2. Help them recognize what they did well
3. Encourage them to build on this momentum

Always vary your responses - never give the same advice twice in a conversation.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "I'm getting a lot of requests right now. Please try again in a moment. 💛" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits need a top-up. Please check your workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("wellness-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
