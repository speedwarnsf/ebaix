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

    // Check if API key exists
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }
    console.log('Gemini API key found')

    // STEP 1: Generate AI-optimized description using Gemini
    console.log('Calling Gemini for description...')
    const descriptionResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
- Encourage immediate purchase

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
      console.error('Gemini description failed:', descriptionResponse.status, errorText)
      throw new Error(`Gemini API failed: ${descriptionResponse.status} - ${errorText}`)
    }

    const descriptionData = await descriptionResponse.json()
    console.log('Description response:', JSON.stringify(descriptionData, null, 2))
    
    if (!descriptionData.candidates || !descriptionData.candidates[0]) {
      throw new Error('No description generated')
    }
    
    const optimizedDescription = descriptionData.candidates[0].content.parts[0].text.trim()

    // STEP 2: For now, just return the original image with a note about Nano Banana
    // The actual Gemini image generation endpoint requires different authentication
    console.log('Note: Nano Banana image generation requires Vertex AI setup')
    const enhancedBase64 = base64Image

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
      throw new Error(`Database error: ${error.message}`)
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
    console.error('ERROR:', error.message, error.stack)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
