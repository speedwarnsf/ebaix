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

const capitalize = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const fallbackDescription = (userDescription: string) => {
  const clean = userDescription
    .replace(/\s+/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();

  if (!clean) {
    return "Well-cared-for item ready to ship quickly. Trusted seller, responsive communication, and accurate descriptions. Message for more photos or details.";
  }

  const rawChunks = clean
    .split(/[,;•\-|\n]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 2);

  const uniqueChunks = Array.from(new Set(rawChunks)).slice(0, 6);
  const headline = capitalize(uniqueChunks[0] ?? clean);
  const featureLines = uniqueChunks.slice(1, 5).map((feature) => `- ${capitalize(feature)}`);

  return [
    `${headline}.`,
    featureLines.length
      ? "Key details:\n" + featureLines.join("\n")
      : "",
    "Ships fast with careful packaging, tracked delivery, and responsive support. Reach out with questions—this one moves quick.",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash-exp",
      "gemma-3-12b",
    ];

    let descriptionData: any = null;
    let lastError: string | null = null;
    let lastStatus: number | null = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
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
        console.error(
          `write-listing model ${model} attempt ${attempt + 1} error:`,
          errorText,
        );

        lastStatus = response.status;
        lastError = `Description generation failed: ${response.status}`;

        if (response.status === 404) {
          break;
        }

        if (response.status === 429 || response.status === 503) {
          const backoff = Math.pow(2, attempt) * 1500 + Math.random() * 500;
          await sleep(backoff);
          continue;
        }

        break;
      }

      if (descriptionData) {
        break;
      }

      if (lastStatus && lastStatus !== 404 && lastStatus !== 429 && lastStatus !== 503) {
        break;
      }
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

    const responsePayload = {
      listingText,
      success: Boolean(descriptionData),
      source: descriptionData ? "gemini" : "fallback",
      reason: descriptionData ? undefined : lastError ?? "Model unavailable",
      retryable: !descriptionData && lastStatus
        ? lastStatus === 429 || lastStatus === 503
        : undefined,
    };

    return new Response(
      JSON.stringify(responsePayload),
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
