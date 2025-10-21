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
    console.log('Starting image processing...')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const formData = await req.formData()
    const image = formData.get('image') as File
    const title = formData.get('title') as string
    const price = parseFloat(formData.get('price') as string)

    console.log('Received:', { title, price, imageType: image?.type, imageSize: image?.size })

    if (!image) {
      throw new Error('No image provided')
    }

    const imageBytes = await image.arrayBuffer()
    const base64Image = btoa(
      new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    
    console.log('Image converted to base64, length:', base64Image.length)

    // STEP 1: Generate AI-optimized description
    console.log('Calling Gemini for description...')
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
      const errorText = await descriptionResponse.text()
      console.error('Gemini Flash failed:', descriptionResponse.status, errorText)
      throw new Error(`Gemini Flash API failed: ${descriptionResponse.status} - ${errorText}`)
    }

    const descriptionData = await descriptionResponse.json()
    console.log('Description generated successfully')
    const optimizedDescription = descriptionData.candidates[0].content.parts[0].text.trim()

    // STEP 2: Nano Banana - Image editing with Gemini Imagen
    console.log('Calling Gemini Imagen for background removal (Nano Banana)...')
    const imageEditResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{
            prompt: "Remove background, replace with clean pink studio backdrop (#F5D5E0), product centered, professional lighting",
            image: {
              bytesBase64Encoded: base64Image
            }
          }],
          parameters: {
            sampleCount: 1,
            mode: "upscale"
          }
        })
      }
    )

    if (!imageEditResponse.ok) {
      const errorText = await imageEditResponse.text()
      console.error('Imagen failed:', imageEditResponse.status, errorText)
      throw new Error(`Imagen API failed: ${imageEditResponse.status}`)
    }

    const imageEditData = await imageEditResponse.json()
    console.log('Image enhanced with Nano Banana')
    
    const enhancedBase64 = imageEditData.predictions[0].bytesBase64Encoded

    console.log('Saving to database...')
    const { data: listing, error } = await supabaseClient
      .from('listings')
      .insert({
        title,
        price,
        original_image_url: `data:${image.type || 'image/jpeg'};base64,${base64Image}`,
        enhanced_image_url: `data:image/png;base64,${enhancedBase64}`,
        original_description: title,
        optimized_description: optimizedDescription
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    console.log('Success! Listing ID:', listing.id)

    return new Response(
      JSON.stringify({
        success: true,
        enhanced_image: `data:image/png;base64,${enhancedBase64}`,
        optimized_description: optimizedDescription,
        listing_id: listing.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('ERROR:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})