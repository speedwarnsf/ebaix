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
    const { mode, imageBase64, productDescription } = body

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // MODE: IMAGE - Process with Gemini 2.5 Flash Image
    if (mode === 'image') {
      if (!imageBase64) {
        throw new Error('No image provided')
      }

      console.log('Processing image with Gemini 2.5 Flash Image...')

      // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64

      const imageEditResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: "Output a high-resolution image at maximum quality. Cut out the object from the uploaded iPhone photo and place it on a Savage Seamless Light Pink (#08, hex #F6CADC) paper background.\n\nFrame the shot closely around the object, filling the entire frame to maximize resolution and detail. The camera should be positioned to capture maximum detail of the product. Do not show any lighting equipment, studio gear, or other equipment in the frame - only the object and the seamless pink background.\n\nLight the object as if photographed in a professional studio with high-end equipment, creating realistic, flattering highlights and natural shadows. The lighting should be invisible - only its effect should be seen on the product.\n\nMaintain meticulous attention to detail. Preserve authentic color fidelity, texture, and every surface detail exactly as it appears in the original photo. Capture all visible imperfections, scuffs, scratches, wear patterns, and surface characteristics with extreme precision. Do not clean, smooth, enhance, or retouch the object in any way.\n\nRender with professional studio quality: soft shadow falloff on the pink seamless background, gentle gradient from light to mid-tone, and subtle depth of field to emphasize the object. Avoid artificial gloss, exaggerated reflections, or cartoonish edges. The result should look like an authentic professional product photograph on Savage #08 Light Pink seamless paper, with crisp yet natural realism and maximum detail preservation."
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.4,
              topP: 0.95,
              topK: 40
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
            return new Response(
              JSON.stringify({
                success: true,
                image: `data:image/png;base64,${part.inlineData.data}`,
                message: 'Image processed successfully'
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

      return new Response(
        JSON.stringify({
          success: true,
          description: optimizedDescription,
          message: 'Description generated successfully'
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
