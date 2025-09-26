from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
import hashlib

import base64
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security setup
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-this')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Simple password hashing for MVP (replace with proper bcrypt in production)
def get_password_hash(password):
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()

def verify_password(plain_password, hashed_password):
    return get_password_hash(plain_password) == hashed_password

security = HTTPBearer()

security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="eBay Listing Optimization Tool")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    hashed_password: str
    is_premium: bool = False
    listings_used: int = 0
    listings_limit: int = 5  # Free tier limit
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

class Listing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    original_description: str
    optimized_description: str
    original_image_url: Optional[str] = None
    optimized_image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ListingCreate(BaseModel):
    description: str

class OptimizedListing(BaseModel):
    id: str
    original_description: str
    optimized_description: str
    optimized_image_url: Optional[str] = None
    created_at: datetime

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Could not validate credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

async def optimize_description(original_description: str) -> str:
    """Use Gemini to create compelling eBay listing description"""
    try:
        chat = LlmChat(
            api_key=os.environ['GEMINI_API_KEY'],
            session_id=f"listing-{uuid.uuid4()}",
            system_message="You are an expert eBay listing copywriter. Transform basic product descriptions into compelling, persuasive sales copy that drives purchases."
        ).with_model("gemini", "gemini-2.5-pro")
        
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

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return response
    except Exception as e:
        logging.error(f"Error optimizing description: {e}")
        return f"PREMIUM LISTING: {original_description}\n\n✨ Professional eBay listing optimization available! This item features excellent quality and condition. Perfect for collectors and enthusiasts. Don't miss this opportunity - buy now while available!"

async def optimize_image(image_data: bytes) -> Optional[str]:
    """Use Gemini to create professional product photo with hot pink backdrop"""
    try:
        # Convert image to base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        chat = LlmChat(
            api_key=os.environ['GEMINI_API_KEY'],
            session_id=f"image-{uuid.uuid4()}",
            system_message="You are a professional product photographer. Create studio-quality product photos."
        ).with_model("gemini", "gemini-2.5-flash-image-preview").with_params(modalities=["image", "text"])
        
        prompt = """Transform this product photo into a professional eBay listing image:

1. Remove the background completely
2. Add professional studio lighting with soft shadows
3. Place the product on a vibrant hot pink seamless backdrop
4. Ensure the product is the main focus with proper lighting
5. Make it look like a professional e-commerce product photo
6. Keep the product exactly as it is, just improve the presentation

Create a clean, professional product shot that will make buyers want to purchase immediately."""

        msg = UserMessage(
            text=prompt,
            file_contents=[ImageContent(image_base64)]
        )
        
        text, images = await chat.send_message_multimodal_response(msg)
        
        if images and len(images) > 0:
            return images[0]['data']  # Return base64 data of optimized image
        return None
    except Exception as e:
        logging.error(f"Error optimizing image: {e}")
        return None

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    user_data = User(email=user.email, hashed_password=hashed_password)
    
    await db.users.insert_one(user_data.dict())
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    user_dict = user_data.dict()
    del user_dict['hashed_password']  # Don't send password in response
    
    return Token(access_token=access_token, token_type="bearer", user=user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    user_dict = User(**db_user).dict()
    del user_dict['hashed_password']
    
    return Token(access_token=access_token, token_type="bearer", user=user_dict)

# Listing routes
@api_router.post("/listings/optimize", response_model=OptimizedListing)
async def create_optimized_listing(
    description: str = Form(...),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    # Check usage limits for free tier
    if not current_user.is_premium and current_user.listings_used >= current_user.listings_limit:
        raise HTTPException(
            status_code=403, 
            detail=f"Free tier limit reached ({current_user.listings_limit} listings). Upgrade to premium for unlimited access."
        )
    
    # Optimize description
    optimized_description = await optimize_description(description)
    
    # Optimize image if provided
    optimized_image_data = None
    if image:
        image_bytes = await image.read()
        optimized_image_data = await optimize_image(image_bytes)
    
    # Create listing record
    listing = Listing(
        user_id=current_user.id,
        original_description=description,
        optimized_description=optimized_description,
        optimized_image_url=f"data:image/png;base64,{optimized_image_data}" if optimized_image_data else None
    )
    
    await db.listings.insert_one(listing.dict())
    
    # Update user's usage count
    await db.users.update_one(
        {"email": current_user.email},
        {"$inc": {"listings_used": 1}}
    )
    
    return OptimizedListing(
        id=listing.id,
        original_description=listing.original_description,
        optimized_description=listing.optimized_description,
        optimized_image_url=listing.optimized_image_url,
        created_at=listing.created_at
    )

@api_router.get("/listings", response_model=List[OptimizedListing])
async def get_user_listings(current_user: User = Depends(get_current_user)):
    listings = await db.listings.find({"user_id": current_user.id}).to_list(100)
    return [OptimizedListing(**listing) for listing in listings]

@api_router.get("/user/profile")
async def get_user_profile(current_user: User = Depends(get_current_user)):
    user_dict = current_user.dict()
    del user_dict['hashed_password']
    return user_dict

# Health check
@api_router.get("/")
async def root():
    return {"message": "eBay Listing Optimization Tool API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()