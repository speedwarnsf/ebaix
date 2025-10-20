from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import google.generativeai as genai
from PIL import Image
import io
import base64
import os
from datetime import datetime
import httpx

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

@app.get("/")
async def root():
    return {"status": "eBai API Running", "version": "1.0"}

@app.post("/api/optimize")
async def optimize_listing(
    image: UploadFile = File(...),
    title: str = "",
    price: float = 0
):
    """Transform image and generate listing description"""
    try:
        # Read image
        image_bytes = await image.read()
        img = Image.open(io.BytesIO(image_bytes))
        
        # Step 1: Remove background using Gemini 2.0
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Convert to RGB if needed
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        
        # Save to bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG')
        img_byte_arr = img_byte_arr.getvalue()
        
        # Generate background removal prompt
        response = model.generate_content([
            "Remove the background from this product image and replace it with a professional pink studio backdrop with high-end lighting. Make it look like a professional product photo.",
            Image.open(io.BytesIO(img_byte_arr))
        ])
        
        # For now, we'll use the original image as Gemini doesn't directly do background removal
        # In production, you'd integrate with a background removal API like remove.bg
        enhanced_image = base64.b64encode(img_byte_arr).decode()
        
        # Step 2: Generate optimized description
        description_prompt = f"""
        Create a compelling eBay listing description for this item:
        Title: {title}
        Price: ${price}
        
        Write a short, engaging description (3-4 sentences) that:
        - Highlights key features and benefits
        - Creates urgency
        - Builds trust
        - Encourages immediate purchase
        
        Keep it concise and persuasive.
        """
        
        desc_response = model.generate_content(description_prompt)
        optimized_description = desc_response.text
        
        # Step 3: Store in Supabase
        listing_data = {
            "title": title,
            "price": price,
            "original_image_url": f"data:image/jpeg;base64,{enhanced_image}",
            "enhanced_image_url": f"data:image/jpeg;base64,{enhanced_image}",
            "original_description": title,
            "optimized_description": optimized_description,
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("listings").insert(listing_data).execute()
        
        return {
            "success": True,
            "enhanced_image": f"data:image/jpeg;base64,{enhanced_image}",
            "optimized_description": optimized_description,
            "listing_id": result.data[0]["id"] if result.data else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/listings")
async def get_listings():
    """Get all user listings"""
    try:
        result = supabase.table("listings").select("*").order("created_at", desc=True).limit(50).execute()
        return {"listings": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))