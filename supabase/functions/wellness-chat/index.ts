/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type WellnessChatRequest = {
  messages?: ChatMessage[];
  send_sms?: boolean;
  sms_to?: string;
};

type VertexResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type SmsResponse = {
  status?: string;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages = [], send_sms = false, sms_to = "" }: WellnessChatRequest = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("messages are required");
    }

    const accessToken = await getVertexAccessToken();
    const payload = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: messages
        .filter((message) => message && typeof message.content === "string" && message.content.trim())
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content.trim() }],
        })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 320,
        candidateCount: 1,
      },
    };

    const response = await fetch(vertexGenerateContentUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.error("Vertex AI error:", response.status, rawText);
      return jsonResponse({ error: "AI service temporarily unavailable" }, 500);
    }

    const reply = extractReply(rawText);
    let smsStatus = "skipped";
    let smsWarning = "";

    if (send_sms) {
      try {
        const target = sms_to.trim();
        if (!target) {
          smsWarning = "sms_to is required when send_sms is true";
        } else {
          const smsResponse = await sendSMS(target, `AfyaMind AI: ${truncateForSMS(reply)}`);
          smsStatus = smsResponse.status;
        }
      } catch (error) {
        smsStatus = "failed";
        smsWarning = error instanceof Error ? error.message : "Failed to send SMS";
      }
    }

    return jsonResponse({ reply, sms_status: smsStatus, sms_warning: smsWarning });
  } catch (error) {
    console.error("wellness-chat error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

function vertexGenerateContentUrl(): string {
  const endpoint = getEnv("VERTEX_ENDPOINT", "https://us-central1-aiplatform.googleapis.com").replace(/\/+$/, "");
  const projectId = getRequiredEnv("VERTEX_PROJECT_ID");
  const location = getEnv("VERTEX_LOCATION", "us-central1");
  const model = getEnv("VERTEX_MODEL", "gemini-2.0-flash-001");

  return `${endpoint}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

async function getVertexAccessToken(): Promise<string> {
  const rawServiceAccount = getRequiredEnv("VERTEX_SERVICE_ACCOUNT_JSON");
  const serviceAccount = JSON.parse(rawServiceAccount) as {
    client_email?: string;
    private_key?: string;
    token_uri?: string;
  };

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Vertex service account JSON is missing client_email or private_key");
  }

  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = `${base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  )}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64UrlEncode(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Vertex token request failed (${response.status}): ${rawText}`);
  }

  const tokenPayload = JSON.parse(rawText) as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new Error("Vertex token response was empty");
  }
  return tokenPayload.access_token;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pkcs8 = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");

  const keyData = Uint8Array.from(atob(pkcs8), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    keyData.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

function extractReply(rawText: string): string {
  const parsed = JSON.parse(rawText) as VertexResponse;
  const parts = parsed.candidates?.[0]?.content?.parts || [];
  const reply = parts.map((part) => part.text || "").join("\n").trim();

  if (!reply) {
    throw new Error("Vertex returned an empty reply");
  }

  return reply;
}

async function sendSMS(to: string, message: string): Promise<{ status: string }> {
  const smsURL = getEnv("DEVTEXT_SMS_URL", "https://devtext.site/v1/sms/send");
  const smsAPIKey = getRequiredEnv("DEVTEXT_API_KEY");

  const response = await fetch(smsURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": smsAPIKey,
    },
    body: JSON.stringify({
      to,
      message,
      correlation_id: `wellness-chat-${Date.now()}`,
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`SMS provider error (${response.status}): ${rawText}`);
  }

  const payload = JSON.parse(rawText) as SmsResponse;
  return { status: payload.status || "queued" };
}

function truncateForSMS(message: string): string {
  const normalized = message.trim();
  return normalized.length > 320 ? `${normalized.slice(0, 317)}...` : normalized;
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getEnv(key: string, fallback: string): string {
  const value = Deno.env.get(key);
  return value && value.trim() ? value.trim() : fallback;
}

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value || !value.trim()) {
    throw new Error(`${key} is not configured`);
  }
  return value.trim();
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
