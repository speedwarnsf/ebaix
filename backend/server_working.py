from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import base64
import google.generativeai as genai
from supabase import create_client, Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure Gemini
genai.configure(api_key=os.environ['GEMINI_API_KEY'])

# Supabase setup
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Create the main app
app = FastAPI(title="eBai - eBay Listing Optimization Tool")
api_router = APIRouter(prefix="/api")

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class OptimizedListing(BaseModel):
    id: str
    original_description: str
    optimized_description: str
    optimized_image_url: Optional[str] = None
    created_at: datetime

# Auth dependency
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace('Bearer ', '')
    
    try:
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception as e:
        logging.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

async def optimize_description(original_description: str) -> str:
    """Use Gemini to create compelling eBay listing description"""
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        prompt = f"""Transform this basic product description into a compelling eBay listing that sells:

ORIGINAL: {original_description}

Create a persuasive eBay listing description that:
1. Starts with an attention-grabbing headline
2. Highlights key benefits and features
3. Creates emotional appeal and urgency
4. Uses power words that drive sales
5. Includes relevant keywords for search
6. Ends with a strong call-to-action

Format it professionally for eBay with proper formatting and bullet points where appropriate."""

        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        logging.error(f"Error optimizing description: {e}")
        return f"PREMIUM LISTING: {original_description}\\n\\n✨ Professional eBay listing optimization available! This item features excellent quality and condition. Perfect for collectors and enthusiasts. Don't miss this opportunity - buy now while available!"

async def optimize_image(image_data: bytes, description: str = "") -> Optional[str]:
    """Use Gemini to create professional product photo with hot pink backdrop"""
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Prepare image
        import PIL.Image
        import io
        image = PIL.Image.open(io.BytesIO(image_data))
        
        object_description = description if description else "the product shown in the image"
        
        prompt = f"""**TASK:** Re-render the user-supplied photo of the object with a **pink seamless studio backdrop** and **professional softbox lighting**.

**OBJECT:** {object_description}

**SOURCE IMAGE CONSTRAINTS (CRITICAL):** The re-rendered image **MUST** perfectly preserve all existing wear-and-tear, scratches, scuffs, and imperfections from the original photo. The goal is to change only the lighting and backdrop, not the object's condition.

**LIGHTING & ATMOSPHERE:** Studio quality, high-key lighting. Use **large, professional softboxes** to create soft, even, flattering illumination with gentle shadows. The light should reveal the object's texture and condition clearly without harshness or glare.

**BACKDROP & STYLING:** A **seamless pink backdrop** (e.g., Savage Widetone 'Coral' or similar) that extends into the foreground, providing a clean, professional, and modern e-commerce aesthetic.

**OUTPUT:** A single, high-resolution JPEG image suitable for a high-end eBay listing."""

        response = model.generate_content([prompt, image])
        
        # Check if response has images
        if hasattr(response, 'parts'):
            for part in response.parts:
                if hasattr(part, 'inline_data'):
                    logging.info("Successfully generated optimized image using Gemini")
                    return base64.b64encode(part.inline_data.data).decode('utf-8')
        
        logging.warning("No images generated by Gemini - image optimization not available")
        return None
        
    except Exception as e:
        logging.error(f"Image optimization failed: {e}")
        return None

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    try:
        auth_response = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        profile_data = {
            "id": auth_response.user.id,
            "email": user.email,
            "is_premium": False,
            "listings_used": 0,
            "listings_limit": 5,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        supabase.table('profiles').insert(profile_data).execute()
        
        return Token(
            access_token=auth_response.session.access_token,
            token_type="bearer",
            user={
                "id": auth_response.user.id,
                "email": user.email,
                "is_premium": False,
                "listings_used": 0,
                "listings_limit": 5
            }
        )
    except Exception as e:
        logging.error(f"Registration error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        profile = supabase.table('profiles').select("*").eq('id', auth_response.user.id).single().execute()
        
        return Token(
            access_token=auth_response.session.access_token,
            token_type="bearer",
            user=profile.data
        )
    except Exception as e:
        logging.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid email or password")

# Listing routes
@api_router.post("/listings/optimize", response_model=OptimizedListing)
async def create_optimized_listing(
    description: str = Form(...),
    image: Optional[UploadFile] = File(None),
    current_user = Depends(get_current_user)
):
    try:
        user_id = current_user.user.id
        
        profile = supabase.table('profiles').select("*").eq('id', user_id).single().execute()
        
        if not profile.data['is_premium'] and profile.data['listings_used'] >= profile.data['listings_limit']:
            raise HTTPException(
                status_code=403, 
                detail=f"Free tier limit reached ({profile.data['listings_limit']} listings). Upgrade to premium for unlimited access."
            )
        
        # Optimize description
        optimized_description = await optimize_description(description)
        
        # Optimize image if provided
        optimized_image_data = None
        if image:
            image_bytes = await image.read()
            optimized_image_data = await optimize_image(image_bytes, description)
        
        # Create listing record
        listing_id = str(uuid.uuid4())
        listing_data = {
            "id": listing_id,
            "user_id": user_id,
            "original_description": description,
            "optimized_description": optimized_description,
            "optimized_image_url": f"data:image/png;base64,{optimized_image_data}" if optimized_image_data else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        supabase.table('listings').insert(listing_data).execute()
        
        # Update usage count
        supabase.table('profiles').update({
            "listings_used": profile.data['listings_used'] + 1
        }).eq('id', user_id).execute()
        
        return OptimizedListing(**listing_data)
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Optimization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/listings", response_model=List[OptimizedListing])
async def get_user_listings(current_user = Depends(get_current_user)):
    try:
        user_id = current_user.user.id
        listings = supabase.table('listings').select("*").eq('user_id', user_id).order('created_at', desc=True).limit(100).execute()
        return listings.data
    except Exception as e:
        logging.error(f"Error fetching listings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/user/profile")
async def get_user_profile(current_user = Depends(get_current_user)):
    try:
        user_id = current_user.user.id
        profile = supabase.table('profiles').select("*").eq('id', user_id).single().execute()
        return profile.data
    except Exception as e:
        logging.error(f"Error fetching profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "eBai API - eBay Listing Optimization Tool", "status": "online"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
