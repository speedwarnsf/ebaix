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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
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
      throw new Error(`Gemini Flash API failed: ${descriptionResponse.status}`)
    }

    const descriptionData = await descriptionResponse.json()
    console.log('Description generated successfully')
    const optimizedDescription = descriptionData.candidates[0].content.parts[0].text.trim()

    // STEP 2: Nano Banana - Image generation with Gemini 2.5 Flash Image
    console.log('Calling Gemini 2.5 Flash Image for nano banana background...')
    const imageEditResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Transform this product photo: Remove all background completely and replace with a clean, seamless pink studio backdrop (#F5D5E0). Professional e-commerce style with soft studio lighting, no shadows, product centered. Make it look like it was photographed in a high-end photo studio."
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
            temperature: 0.2,
            maxOutputTokens: 8192
          }
        })
      }
    )

    if (!imageEditResponse.ok) {
      const errorText = await imageEditResponse.text()
      console.error('Gemini 2.5 Flash Image failed:', imageEditResponse.status, errorText)
      throw new Error(`Nano Banana API failed: ${imageEditResponse.status}`)
    }

    const imageEditData = await imageEditResponse.json()
    console.log('Image enhanced with nano banana')
    
    // Extract the generated image from the response
    let enhancedBase64 = base64Image // fallback
    
    if (imageEditData.candidates && imageEditData.candidates[0]) {
      const parts = imageEditData.candidates[0].content.parts
      for (const part of parts) {
        if (part.inline_data && part.inline_data.data) {
          enhancedBase64 = part.inline_data.data
          console.log('Found nano banana enhanced image')
          break
        }
      }
    }

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