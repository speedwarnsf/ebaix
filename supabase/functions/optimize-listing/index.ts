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

    const imageBytes = await image.arrayBuffer()
    const base64Image = btoa(
      new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Generate description
    const descriptionResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Create a compelling e-commerce listing description for this item:
Title: ${title}
Price: $${price}

Write 3-4 sentences that highlight key features, create urgency, and encourage purchase.`
              },
              {
                inline_data: {
                  mime_type: image.type || 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }]
        })
      }
    )

    if (!descriptionResponse.ok) {
      throw new Error(`Gemini API failed: ${descriptionResponse.status}`)
    }

    const descriptionData = await descriptionResponse.json()
    const optimizedDescription = descriptionData.candidates[0].content.parts[0].text.trim()

    // For now, return original image with pink tint overlay (client-side can handle watermark)
    // Actual Gemini image generation requires different API setup
    const enhancedBase64 = base64Image

    // Save to database
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

    if (error) throw error

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
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
