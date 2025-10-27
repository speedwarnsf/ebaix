import {
  ensureProfile,
  extractUserEmail,
  canConsumeCredit,
  consumeCredit,
  getUsageSummary,
} from '../_shared/usage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { mode, imageBase64, productDescription, userEmail: bodyEmail } = body

    const email = extractUserEmail({ userEmail: bodyEmail }, req)
    if (!email) {
      throw new Error('User email required')
    }

    const profile = await ensureProfile(email)
    const allowance = canConsumeCredit(profile)
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

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // MODE: IMAGE - Process photo with pink background
    if (mode === 'image') {
      if (!imageBase64) {
        throw new Error('No image provided')
      }

      console.log('Starting image transformation with pink studio background...')

      // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64

      // Use Gemini to analyze and process the image
      // Since Gemini Flash can't directly edit images, we'll use it to generate
      // instructions and return the original with pink background applied client-side
      const imageEditResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Analyze this product photo and confirm it's suitable for e-commerce listing. Respond with just "APPROVED" if the image shows a clear product suitable for sale.`
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }]
          })
        }
      )

      let transformInstructions = ''
      if (imageEditResponse.ok) {
        const editData = await imageEditResponse.json()
        if (editData.candidates && editData.candidates[0]) {
          transformInstructions = editData.candidates[0].content.parts[0].text
          console.log('Image analysis:', transformInstructions)
        }
      }

      // Return the base64 image for client-side pink background processing
      // The PhotoEnhancer component will add the pink background using canvas
      const consumption = await consumeCredit(profile)

      return new Response(
        JSON.stringify({
          success: true,
          image: imageBase64,
          message: 'Image ready for enhancement',
          usage: consumption.usage,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // MODE: TEXT - Generate SEO-optimized description
    if (mode === 'text') {
      if (!productDescription || !productDescription.trim()) {
        throw new Error('No product description provided')
      }

      console.log('Generating optimized description for:', productDescription)
      const textModels = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash'
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

      const consumption = await consumeCredit(profile)

      return new Response(
        JSON.stringify({
          success: true,
          description: optimizedDescription,
          message: 'Description generated successfully',
          usage: consumption.usage,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Invalid mode
    throw new Error(`Invalid mode: ${mode}. Expected 'image' or 'text'`)

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Processing failed',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
