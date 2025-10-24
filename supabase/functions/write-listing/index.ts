import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toneMap: Record<string, string> = {
  streetwise: "Write in a sardonic, Bukowski-like voice: raw, unfiltered, slightly humorous, but real.",
  contemplative: "Write in a Sartre-like tone: philosophical, introspective, and quietly intense.",
  transcendent: "Write in a Whitman-like tone: poetic, open-hearted, and celebratory of existence.",
};

const fallbackDescription = (userDescription: string) =>
  `Premium quality product ready for its next owner: ${userDescription}. Ships fast with care and comes from a smoke-free home. This is a smart buy for shoppers who appreciate value—grab it before it's gone.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      imageUrl,
      userDescription,
      length = "short",
      tone = "streetwise",
    } = body ?? {};

    if (!userDescription || !String(userDescription).trim()) {
      throw new Error("No product description provided");
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const toneInstruction = toneMap[tone] ?? toneMap.streetwise;
    const lengthHint =
      length === "long"
        ? "Write three to four expressive paragraphs (180-250 words)."
        : "Write one concise paragraph (about 60-80 words).";

    const prompt = `
${toneInstruction}

Analyze the provided image reference: ${imageUrl ? imageUrl : "no image available"}
Listing notes from the seller: ${userDescription}

Blend the visual cues and seller notes into a persuasive e-commerce listing.
${lengthHint}
Return only the finished listing copy—no headings, labels, or commentary.
`;

    const models = [
      "gemini-2.0-flash-exp",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
    ];

    let descriptionData: any = null;
    let lastError: string | null = null;

    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      if (response.ok) {
        descriptionData = await response.json();
        break;
      }

      const errorText = await response.text();
      console.error(`write-listing model ${model} error:`, errorText);

      if (response.status !== 404) {
        lastError = `Description generation failed: ${response.status}`;
        break;
      }
    }

    if (!descriptionData) {
      throw new Error(lastError ?? "Description generation failed: all Gemini models unavailable (404)");
    }

    let listingText = "";
    const candidates = Array.isArray(descriptionData?.candidates)
      ? descriptionData.candidates
      : [];

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts ?? [];
      for (const part of parts) {
        if (typeof part?.text === "string" && part.text.trim().length > 0) {
          listingText = part.text.trim();
          break;
        }
      }
      if (listingText) break;
    }

    if (!listingText) {
      listingText = fallbackDescription(userDescription);
    }

    return new Response(
      JSON.stringify({
        listingText,
        success: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("write-listing error:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Unexpected error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
