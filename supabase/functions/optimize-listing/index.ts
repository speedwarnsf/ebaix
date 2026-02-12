import {
  ensureProfile,
  extractUserEmail,
  canConsumeCredit,
  consumeCredit,
  getUsageSummary,
} from '../_shared/usage.ts';
import { guestGate } from '../_shared/guest_gate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-guest-id, x-nudio-shopify-mode',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let guestRemaining: number | undefined;
  let guestResult: Awaited<ReturnType<typeof guestGate>> | null = null;
  const shopifyModeEnabled = Deno.env.get('NUDIO_SHOPIFY_MODE') === 'true'
  const shopifyMode =
    shopifyModeEnabled && req.headers.get('x-nudio-shopify-mode') === 'true'

  try {
    if (!shopifyMode) {
      guestResult = await guestGate(req);
      guestRemaining =
        !guestResult.blocked && typeof guestResult.remaining === 'number'
          ? guestResult.remaining
          : undefined;
      if (guestResult.blocked) {
        const payload = await guestResult.response.text();
        return new Response(payload, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: guestResult.response.status,
        });
      }
    }

    const body = await req.json()
    const {
      mode,
      imageBase64,
      productDescription,
      userEmail: bodyEmail,
      backdropId,
      backdropHex,
      variant: bodyVariant,
      labsPrompt,
      creditCost,
      requirePaidCredits,
      enable4k,
    } = body

    const sanitizedLabsPrompt =
      typeof labsPrompt === 'string' && labsPrompt.trim().length > 0
        ? labsPrompt.trim()
        : ''
    const labsMode = sanitizedLabsPrompt.length > 0
    const labsUltraRes = labsMode && enable4k === true
    const variant = labsMode || bodyVariant === 'portrait' ? 'portrait' : 'product'

    if (shopifyMode) {
      if (mode !== 'image') {
        return new Response(
          JSON.stringify({ error: 'Shopify mode only supports product images.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }
      if (labsMode || variant !== 'product') {
        return new Response(
          JSON.stringify({ error: 'Shopify mode only supports product photos.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }
      const allowedBackdrops = new Set([
        'pink',
        'fashion-grey',
        'deep-yellow',
        'bone',
        'blue-mist',
        'custom',
      ])
      if (!allowedBackdrops.has(typeof backdropId === 'string' ? backdropId : '')) {
        return new Response(
          JSON.stringify({ error: 'Backdrop not allowed in Shopify mode.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }
      if (
        backdropId === 'custom' &&
        (typeof backdropHex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(backdropHex))
      ) {
        return new Response(
          JSON.stringify({ error: 'Custom backdrop requires a valid hex color.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    const requestedCost =
      typeof creditCost === 'number' && Number.isFinite(creditCost) && creditCost > 0
        ? Math.floor(creditCost)
        : undefined
    const creditCostValue = labsMode
      ? requestedCost ?? 4
      : requestedCost ?? 1
    const forcePaidCredits = labsMode
      ? requirePaidCredits !== false
      : requirePaidCredits === true

    const resolveBackdrop = () => {
      if (typeof backdropId !== 'string') return BACKDROP_VARIANTS.pink
      if (backdropId === 'custom' && typeof backdropHex === 'string') {
        return {
          id: 'custom',
          description: `custom backdrop (${backdropHex})`,
          tone: `a solid backdrop in ${backdropHex}`,
        }
      }
      return BACKDROP_VARIANTS[backdropId] ?? BACKDROP_VARIANTS.pink
    }
    const backdrop = resolveBackdrop()

    let email = extractUserEmail({ userEmail: bodyEmail }, req)
    if (!email && guestResult && !guestResult.blocked && guestResult.fingerprint) {
      email = `guest-${guestResult.fingerprint}@nudio.ai`
    }
    if (!email) {
      const err = new Error('User email required') as Error & { guestRemaining?: number }
      if (typeof guestRemaining === 'number') {
        err.guestRemaining = guestRemaining
      }
      throw err
    }

    const profile = await ensureProfile(email)
    if (!shopifyMode) {
      const allowance = canConsumeCredit(profile, {
        creditCost: creditCostValue,
        requirePaidCredits: forcePaidCredits,
      })
      if (!allowance.allowed) {
        return new Response(
          JSON.stringify({
            error: allowance.message ?? 'Usage limit reached',
            usage: (await getUsageSummary(email)).usage,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        )
      }
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const buildProductPrompt = (backdropVariant: { description: string; tone: string }) =>
      `Output a high-resolution image at maximum quality. Cut out the object from the uploaded iPhone photo and place it on ${backdropVariant.description} paper background. The seamless backdrop must remain exactly ${backdropVariant.tone} with the precise hue described—no pink shift, no default fallback.

Frame the shot closely around the object, filling the entire frame to maximize resolution and detail. Keep the camera angle flattering and direct, with no lighting equipment, stands, or studio gear visible—only the object against ${backdropVariant.tone}.

Light the object as if photographed in a professional studio with high-end equipment, creating realistic, flattering highlights and natural shadows. The lighting should be invisible—only its effect should be seen on the product.

Maintain meticulous attention to detail. Preserve authentic color fidelity, texture, and every surface detail exactly as it appears in the original photo. Capture all visible imperfections, scuffs, scratches, wear patterns, and surface characteristics with extreme precision. Do not clean, smooth, enhance, or retouch the object in any way. The seamless backdrop must stay ${backdropVariant.tone} from edge to edge—do not drift toward pink or any other unrelated color.

Render with professional studio polish: a gentle gradient and soft shadow falloff across the seamless backdrop, subtle depth of field to emphasize the object, and absolutely no artificial gloss, exaggerated reflections, or cartoonish edges. The result should look like an authentic professional product photograph shot on ${backdropVariant.description}, with crisp yet natural realism and maximum detail preservation.`

    const buildPortraitPrompt = (backdropVariant: { description: string }) =>
      `Take this picture of a person and examine every pore of their skin, every scar, mark, mole, and freckle. Look carefully at the shape of their face and their body. You are going to represent every detail in the most realistic way, but imagine they have been taken to a world-leading NYC portrait studio with stylists, hair, and makeup specialists. The set uses an amazing Broncolor ParaLight three-point lighting setup with a cyc wall backdrop painted to match ${backdropVariant.description}.

Ground rules: the subject must be 16ft from the backdrop and they keep the exact same clothes they arrived in—the clothes can only be subtly fitted or pinned. Makeup must be virtually unnoticeable. Hair should remain similar but look clean, styled, and magazine-quality cool. The photographer is incredibly skilled at directing the best pose and expression.

Only show the subject and the seamless cyc wall. Never reveal lighting equipment, stands, rolled paper, flooring seams, or any other set pieces—just the person against that perfectly smooth ${backdropVariant.description} backdrop edge to edge.

The shoot is captured on a Phase One camera using a Schneider Kreuznach 110mm LS f/2.8 lens. Deliver the final Vogue magazine-style candid editorial portrait—hyper-real, flattering, and true to the subject.`

    const promptText =
      labsMode && sanitizedLabsPrompt
        ? sanitizedLabsPrompt
        : variant === 'portrait'
          ? buildPortraitPrompt(backdrop)
          : buildProductPrompt(backdrop)

    const defaultImageModel = Deno.env.get('NUDIO_IMAGE_MODEL') ?? 'gemini-2.5-flash-image'
    const labsImageModel = Deno.env.get('NUDIO_LABS_IMAGE_MODEL') ?? 'gemini-2.5-flash-image'
    const imageModel = labsMode ? labsImageModel : defaultImageModel

    // MODE: IMAGE - Process with Gemini 2.5 Flash Image
    if (mode === 'image') {
      if (!imageBase64) {
        throw new Error('No image provided')
      }

      console.log(`Processing image with model ${imageModel}...`)

      // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64

      const imageEditResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mime_type: 'image/jpeg', data: base64Data } },
                { text: promptText }
              ]
            }],
            generationConfig: {
              temperature: 0.4,
              topP: 0.95,
              topK: 40,
            }
          })
        }
      )

      if (!imageEditResponse.ok) {
        const errorText = await imageEditResponse.text()
        console.error('Gemini API error:', errorText)
        throw new Error(`Gemini API failed: ${imageEditResponse.status}`)
      }

      const data = await imageEditResponse.json()
      console.log('Gemini response received')

      // CRITICAL FIX: Use inlineData (camelCase) not inline_data (snake_case)
      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData) {
            console.log('Image successfully generated')
            const usage = shopifyMode
              ? (await getUsageSummary(email)).usage
              : (
                  await consumeCredit(profile, {
                    creditCost: creditCostValue,
                    requirePaidCredits: forcePaidCredits,
                  })
                ).usage
            return new Response(
              JSON.stringify({
                success: true,
                image: `data:image/png;base64,${part.inlineData.data}`,
                message: 'Image processed successfully',
                usage,
                backdropId: backdrop.id,
                variant,
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
              }
            )
          }
        }
      }

      console.error('No image in response:', JSON.stringify(data))
      throw new Error('No image returned from Gemini')
    }

    // MODE: TEXT - Generate SEO-optimized description
    if (mode === 'text') {
      if (!productDescription || !productDescription.trim()) {
        throw new Error('No product description provided')
      }

      console.log('Generating optimized description for:', productDescription)
      const textModels = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash-lite',
        'gemini-2.0-flash-exp',
        'gemma-3-12b'
      ]

      let descriptionData: any = null
      let lastError: string | null = null

      for (const model of textModels) {
        const descriptionResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are an expert eBay listing copywriter. Create a compelling, SEO-optimized product description based on this input:

"${productDescription}"

Write a professional eBay listing description that:
1. Highlights key features and benefits
2. Uses persuasive language to attract buyers
3. Includes relevant keywords for search optimization
4. Mentions condition, quality, and value proposition
5. Creates urgency and trust
6. Is 3-5 sentences long

Make it punchy, professional, and conversion-focused. Do NOT use emojis.`
                }]
              }]
            })
          }
        )

        if (descriptionResponse.ok) {
          descriptionData = await descriptionResponse.json()
          break
        }

        const errorText = await descriptionResponse.text()
        console.error(`Description generation failed for model ${model}:`, errorText)

        if (descriptionResponse.status !== 404) {
          lastError = `Description generation failed: ${descriptionResponse.status}`
          break
        }
      }

      if (!descriptionData) {
        throw new Error(lastError ?? 'Description generation failed: all Gemini models unavailable (404)')
      }

      let optimizedDescription = ''

      if (descriptionData.candidates && descriptionData.candidates[0] &&
          descriptionData.candidates[0].content && descriptionData.candidates[0].content.parts[0]) {
        optimizedDescription = descriptionData.candidates[0].content.parts[0].text.trim()
      } else {
        // Fallback description
        optimizedDescription = `Premium quality product in excellent condition. ${productDescription}. This item ships fast with satisfaction guaranteed. Limited availability - order now to secure this exceptional value. Perfect for buyers seeking quality and reliability.`
      }

      console.log('Generated description:', optimizedDescription)

      const usage = shopifyMode
        ? (await getUsageSummary(email)).usage
        : (
            await consumeCredit(profile, {
              creditCost: creditCostValue,
              requirePaidCredits: forcePaidCredits,
            })
          ).usage

      return new Response(
        JSON.stringify({
          success: true,
          description: optimizedDescription,
          message: 'Description generated successfully',
          usage,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Invalid mode
    const invalid = new Error(`Invalid mode: ${mode}. Expected 'image' or 'text'`) as Error & { guestRemaining?: number }
    if (typeof guestRemaining === 'number') {
      invalid.guestRemaining = guestRemaining
    }
    throw invalid

  } catch (error) {
    console.error('Edge function error:', error)
    const err = error as Error & { guestRemaining?: number }
    if (typeof err.guestRemaining !== 'number' && typeof guestRemaining === 'number') {
      err.guestRemaining = guestRemaining
    }
    return new Response(
      JSON.stringify({
        error: err.message || 'Processing failed',
        details: err.toString(),
        guestRemaining:
          typeof err.guestRemaining === 'number'
            ? err.guestRemaining
            : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
const BACKDROP_VARIANTS: Record<string, { id: string; description: string; tone: string }> = {
  pink: {
    id: 'pink',
    description: 'Savage Seamless Light Pink (#08, hex #F6CADC)',
    tone: 'the signature nudio pink backdrop',
  },
  'primary-red': {
    id: 'primary-red',
    description: 'Savage Seamless Primary Red (#08R, hex #CE1126)',
    tone: 'a vivid primary red backdrop with high contrast',
  },
  crimson: {
    id: 'crimson',
    description: 'Savage Seamless Crimson (#06, hex #8C1B2F)',
    tone: 'a rich crimson backdrop with dramatic depth',
  },
  evergreen: {
    id: 'evergreen',
    description: 'Savage Seamless Evergreen (#18, hex #2E5339)',
    tone: 'a rich forest green backdrop (hex #2E5339) with natural depth and zero pink cast',
  },
  bone: {
    id: 'bone',
    description: 'Savage Seamless Bone (#51, hex #E8DCC9)',
    tone: 'a warm, neutral bone backdrop',
  },
  'fashion-grey': {
    id: 'fashion-grey',
    description: 'Savage Seamless Fashion Grey (#56, hex #90969B)',
    tone: 'a soft city-fog grey backdrop with studio neutrality',
  },
  'deep-yellow': {
    id: 'deep-yellow',
    description: 'Savage Seamless Deep Yellow (#71, hex #FFB300)',
    tone: 'a glowing amber yellow backdrop with sunshine warmth',
  },
  canary: {
    id: 'canary',
    description: 'Savage Seamless Canary (#38, hex #FFF44F)',
    tone: 'a light yellow backdrop with playful energy',
  },
  'blue-mist': {
    id: 'blue-mist',
    description: 'Savage Seamless Blue Mist (#41, hex #7CAFD6)',
    tone: 'a cool powder blue backdrop with airy vibrancy',
  },
  ultramarine: {
    id: 'ultramarine',
    description: 'Savage Seamless Ultramarine (#05, hex #2B3D8C)',
    tone: 'a deep ocean blue backdrop with gallery depth',
  },
  'thunder-grey': {
    id: 'thunder-grey',
    description: 'Savage Seamless Thunder Grey (#27, hex #4A4C4E)',
    tone: 'a dramatic charcoal grey backdrop with soft shadow falloff',
  },
  'mint-green': {
    id: 'mint-green',
    description: 'Savage Seamless Mint Green (#40, hex #BEE7B8)',
    tone: 'a fresh pale green backdrop with modern calm',
  },
  black: {
    id: 'black',
    description: 'Savage Seamless Black (#20, hex #000000)',
    tone: 'a midnight black backdrop with polished studio contrast',
  },
  chesnut: {
    id: 'chesnut',
    description: 'Savage Seamless Chestnut (#16, hex #6B3F2E)',
    tone: 'a warm brown backdrop with organic depth',
  },
  purple: {
    id: 'purple',
    description: 'Savage Seamless Purple (#62, hex #6F2DA8)',
    tone: 'a deep purple backdrop with stylish depth',
  },
};
