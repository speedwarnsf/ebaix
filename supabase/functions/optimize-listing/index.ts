import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
                  text: "Cut out the object from the uploaded iPhone photo and place it on a Savage Seamless Light Pink (#08, hex #F6CADC) paper background inside a professional photo studio.\n\nLight the scene with high-end Broncolor studio equipment — large softboxes, reflectors, and balanced overhead fills — to create realistic, flattering highlights and natural shadows.\n\nMaintain authentic color fidelity and texture. Preserve all visible imperfections, scuffs, and surface details exactly as they appear in the original photo. Do not clean, smooth, or retouch the object in any way.\n\nRender the image as though it were shot professionally: soft shadow falloff on the pink seamless background, gentle gradient from light to mid-tone, and subtle depth of field (f/4-style separation) to emphasize the object.\n\nAvoid artificial gloss, exaggerated reflections, or cartoonish edges. The result should look like a genuine studio product photograph illuminated by Broncolor lights, on authentic Savage #08 Light Pink seamless paper, with crisp yet natural realism."
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Data
                  }
                }
              ]
            }]
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

      const descriptionResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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

      if (!descriptionResponse.ok) {
        const errorText = await descriptionResponse.text()
        console.error('Description generation failed:', errorText)
        throw new Error(`Description generation failed: ${descriptionResponse.status}`)
      }

      const descriptionData = await descriptionResponse.json()
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
