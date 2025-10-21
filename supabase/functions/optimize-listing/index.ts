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

    // Read image bytes and convert to base64
    const imageBytes = await image.arrayBuffer()
    const base64Image = btoa(
      new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    
    console.log('Image converted to base64, length:', base64Image.length)

    // STEP 1: Generate AI-optimized description with Gemini Flash
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

    // STEP 2: Remove background with remove.bg API
    console.log('Calling remove.bg API for background removal...')
    
    const removeBgFormData = new FormData()
    removeBgFormData.append('image_file_b64', base64Image)
    removeBgFormData.append('bg_color', 'f5d5e0') // Pink backdrop
    removeBgFormData.append('size', 'auto')
    
    const removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': Deno.env.get('REMOVE_BG_API_KEY') ?? ''
      },
      body: removeBgFormData
    })

    if (!removeBgResponse.ok) {
      const errorText = await removeBgResponse.text()
      console.error('Remove.bg failed:', removeBgResponse.status, errorText)
      // Fallback to original image if remove.bg fails
      console.log('Falling back to original image')
      const enhancedBase64 = base64Image
      
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
          listing_id: listing.id,
          note: 'Background removal unavailable - using original image'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    const enhancedImageBuffer = await removeBgResponse.arrayBuffer()
    const enhancedBase64 = btoa(
      new Uint8Array(enhancedImageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    
    console.log('Image enhanced successfully')

    // Store in Supabase
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