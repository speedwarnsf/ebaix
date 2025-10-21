import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const formData = await req.formData()
    const image = formData.get('image') as File
    const title = formData.get('title') as string
    const price = parseFloat(formData.get('price') as string)

    if (!image) {
      throw new Error('No image provided')
    }

    // Read image bytes and convert to base64
    const imageBytes = await image.arrayBuffer()
    const base64Image = btoa(
      new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    // STEP 1: Generate AI-optimized description with Gemini Flash
    const descriptionResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Create a compelling e-commerce listing description for:
Title: ${title}
Price: $${price}

Write 3-4 sentences that:
- Highlight key features and benefits
- Create urgency
- Build trust
- Encourage purchase

Return ONLY the description text, no other formatting.`
              },
              {
                inline_data: {
                  mime_type: image.type || 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300
          }
        })
      }
    )

    if (!descriptionResponse.ok) {
      throw new Error(`Gemini Flash API failed: ${descriptionResponse.status}`)
    }

    const descriptionData = await descriptionResponse.json()
    const optimizedDescription = descriptionData.candidates[0].content.parts[0].text.trim()

    // STEP 2: Use Gemini Flash Image (Nano Banana technique) for background removal + pink studio
    const imageEditResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Transform this product photo into a professional studio shot:

1. Remove all background distractions and clutter
2. Replace background with a clean pink studio backdrop (hex color #F5D5E0)
3. Center the product
4. Add professional studio lighting
5. Maintain product authenticity and details
6. Make it look like a professional e-commerce product photo

Generate the enhanced image with these exact specifications.`
              },
              {
                inline_data: {
                  mime_type: image.type || 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 8192,
            response_mime_type: 'image/jpeg'
          }
        })
      }
    )

    if (!imageEditResponse.ok) {
      const errorText = await imageEditResponse.text()
      throw new Error(`Gemini Flash Image API failed: ${imageEditResponse.status} - ${errorText}`)
    }

    const imageData = await imageEditResponse.json()
    
    // Extract enhanced image from response
    let enhancedBase64 = base64Image // Fallback to original
    
    if (imageData.candidates && imageData.candidates[0]?.content?.parts?.[0]?.inline_data) {
      enhancedBase64 = imageData.candidates[0].content.parts[0].inline_data.data
    }

    // Store in Supabase
    const { data: listing, error } = await supabaseClient
      .from('listings')
      .insert({
        title,
        price,
        original_image_url: `data:${image.type || 'image/jpeg'};base64,${base64Image}`,
        enhanced_image_url: `data:image/jpeg;base64,${enhancedBase64}`,
        original_description: title,
        optimized_description: optimizedDescription
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        enhanced_image: `data:image/jpeg;base64,${enhancedBase64}`,
        optimized_description: optimizedDescription,
        listing_id: listing.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})