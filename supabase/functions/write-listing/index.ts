import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    const { imageUrl, userDescription, length = "short", tone = "streetwise" } = await req.json();

    const systemRole = `
You are a 46-year-old linguistics professor at Colgate University with extensive creative-writing experience.
You are world-renowned for your ability to channel the literary tone of famous authors—capturing their rhythm, cadence, and worldview
without drifting into imitation or parody. Your work has earned praise for its subtlety, emotional intelligence, and insight.
By day, you craft short, high-performing listings for eBay and Craigslist; by night, you host poetry slams that keep your writing sharp and experimental.
This unique mix of discipline and play makes you a master of tone in avant-garde advertising copy.
Stay grounded, imaginative, and concise; every word must serve persuasion, truth, and texture.
`;

    // Tone mapping — easy to expand later
    const toneMap: Record<string, string> = {
      streetwise: "Write in a sardonic, Bukowski-like voice: raw, unfiltered, slightly humorous, but real.",
      contemplative: "Write in a Sartre-like tone: philosophical, introspective, and quietly intense.",
      transcendent: "Write in a Whitman-like tone: poetic, open-hearted, and celebratory of existence.",
    };

    const lengthHint =
      length === "short"
        ? "Write one concise paragraph (about 60-80 words)."
        : "Write three to four expressive paragraphs (180-250 words).";

    const prompt = `
${toneMap[tone]}

Analyze the provided image: ${imageUrl}
User input / project description: ${userDescription || "none provided"}

Combine visual cues and description into an engaging promotional listing.
${lengthHint}
Return only the finished text, no commentary.
`;

    const model = "gemini-1.5-flash-latest"; // or whichever text model you’re using

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + Deno.env.get("GEMINI_API_KEY"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "system", parts: [{ text: systemRole }] },
          { role: "user", parts: [{ text: prompt }] },
        ],
      }),
    });

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "Error: no response.";

    return new Response(JSON.stringify({ listingText: text }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("write-listing error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
