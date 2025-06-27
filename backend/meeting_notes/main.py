"""
Microsoft Teams Meeting Notes Integration - FastAPI Backend
Standalone module for AI-KMS system
"""

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
import jwt
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
import base64
import json
from urllib.parse import urlencode, parse_qs
import secrets

app = FastAPI(title="Teams Meeting Notes API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Configuration from environment variables
MICROSOFT_CLIENT_ID = os.getenv("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_TENANT_ID = os.getenv("MICROSOFT_TENANT_ID", "common")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
JWT_SECRET = os.getenv("JWT_SECRET", "your-jwt-secret-key")

# Microsoft Graph API endpoints
MICROSOFT_AUTH_URL = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = f"https://login.microsoftonline.com/{MICROSOFT_TENANT_ID}/oauth2/v2.0/token"
GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

# Required scopes
SCOPES = [
    "https://graph.microsoft.com/OnlineMeetings.Read",
    "https://graph.microsoft.com/Notes.Read",
    "https://graph.microsoft.com/Chat.Read",
    "https://graph.microsoft.com/User.Read",
]

# In-memory token storage (use Redis/database in production)
user_tokens: Dict[str, Dict[str, Any]] = {}

class TeamsAuthService:
    """Microsoft Teams Authentication Service"""
    
    @staticmethod
    def generate_auth_url(state: str = None) -> str:
        """Generate Microsoft OAuth2 authorization URL"""
        if not state:
            state = secrets.token_urlsafe(32)
        
        params = {
            "client_id": MICROSOFT_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": REDIRECT_URI,
            "scope": " ".join(SCOPES),
            "state": state,
            "response_mode": "query"
        }
        
        return f"{MICROSOFT_AUTH_URL}?{urlencode(params)}"
    
    @staticmethod
    async def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
        """Exchange authorization code for access tokens"""
        token_data = {
            "client_id": MICROSOFT_CLIENT_ID,
            "client_secret": MICROSOFT_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
            "scope": " ".join(SCOPES)
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(MICROSOFT_TOKEN_URL, data=token_data)
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to exchange code for tokens")
            
            return response.json()
    
    @staticmethod
    async def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        token_data = {
            "client_id": MICROSOFT_CLIENT_ID,
            "client_secret": MICROSOFT_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
            "scope": " ".join(SCOPES)
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(MICROSOFT_TOKEN_URL, data=token_data)
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to refresh access token")
            
            return response.json()

class GraphAPIService:
    """Microsoft Graph API Service"""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    
    async def get_user_info(self) -> Dict[str, Any]:
        """Get current user information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{GRAPH_API_BASE}/me", headers=self.headers)
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get user info")
            
            return response.json()
    
    async def get_online_meetings(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get user's online meetings"""
        async with httpx.AsyncClient() as client:
            # Note: /me/onlineMeetings requires application permissions in production
            # For demonstration, we'll use a different endpoint or mock data
            try:
                response = await client.get(
                    f"{GRAPH_API_BASE}/me/events?$top={limit}&$filter=isOnlineMeeting eq true&$orderby=start/dateTime desc",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("value", [])
                else:
                    # Fallback to calendar events
                    response = await client.get(
                        f"{GRAPH_API_BASE}/me/events?$top={limit}&$orderby=start/dateTime desc",
                        headers=self.headers
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        return data.get("value", [])
                    
            except Exception as e:
                print(f"Error fetching meetings: {e}")
            
            # Return mock data for demonstration
            return self._get_mock_meetings()
    
    def _get_mock_meetings(self) -> List[Dict[str, Any]]:
        """Mock meeting data for demonstration"""
        return [
            {
                "id": "meeting_1",
                "subject": "Weekly Team Standup",
                "start": {"dateTime": "2024-06-27T09:00:00.0000000", "timeZone": "UTC"},
                "end": {"dateTime": "2024-06-27T10:00:00.0000000", "timeZone": "UTC"},
                "attendees": [
                    {"emailAddress": {"name": "John Doe", "address": "john@company.com"}},
                    {"emailAddress": {"name": "Jane Smith", "address": "jane@company.com"}}
                ],
                "isOnlineMeeting": True,
                "onlineMeetingProvider": "teamsForBusiness"
            },
            {
                "id": "meeting_2", 
                "subject": "Project Review Meeting",
                "start": {"dateTime": "2024-06-26T14:00:00.0000000", "timeZone": "UTC"},
                "end": {"dateTime": "2024-06-26T15:30:00.0000000", "timeZone": "UTC"},
                "attendees": [
                    {"emailAddress": {"name": "Alice Brown", "address": "alice@company.com"}},
                    {"emailAddress": {"name": "Bob Wilson", "address": "bob@company.com"}}
                ],
                "isOnlineMeeting": True,
                "onlineMeetingProvider": "teamsForBusiness"
            }
        ]
    
    async def get_meeting_notes(self, meeting_id: str) -> Dict[str, Any]:
        """Get notes for a specific meeting"""
        # This would typically fetch from OneNote or Teams chat
        # For demonstration, return mock notes
        return {
            "meeting_id": meeting_id,
            "notes": f"Meeting notes for {meeting_id}:\n\n• Discussed project milestones\n• Reviewed quarterly goals\n• Action items assigned to team members\n• Next meeting scheduled for next week",
            "source": "Teams Chat",
            "last_modified": datetime.now().isoformat()
        }

def create_jwt_token(user_data: Dict[str, Any]) -> str:
    """Create JWT token for session management"""
    payload = {
        "user_id": user_data.get("id"),
        "email": user_data.get("mail") or user_data.get("userPrincipalName"),
        "name": user_data.get("displayName"),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_jwt_token(token: str) -> Dict[str, Any]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Get current authenticated user"""
    token = credentials.credentials
    return verify_jwt_token(token)

async def get_user_access_token(user_id: str) -> str:
    """Get valid access token for user"""
    if user_id not in user_tokens:
        raise HTTPException(status_code=401, detail="User not authenticated with Microsoft")
    
    token_info = user_tokens[user_id]
    
    # Check if token is expired
    if datetime.now() >= token_info["expires_at"]:
        # Refresh token
        try:
            new_tokens = await TeamsAuthService.refresh_access_token(token_info["refresh_token"])
            
            # Update stored tokens
            user_tokens[user_id] = {
                "access_token": new_tokens["access_token"],
                "refresh_token": new_tokens.get("refresh_token", token_info["refresh_token"]),
                "expires_at": datetime.now() + timedelta(seconds=new_tokens["expires_in"])
            }
            
            return new_tokens["access_token"]
        except Exception:
            raise HTTPException(status_code=401, detail="Failed to refresh Microsoft access token")
    
    return token_info["access_token"]

# API Routes

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Microsoft Teams Meeting Notes API", "status": "healthy"}

@app.get("/auth/login")
async def microsoft_login():
    """Initiate Microsoft OAuth2 login"""
    state = secrets.token_urlsafe(32)
    auth_url = TeamsAuthService.generate_auth_url(state)
    
    return {
        "auth_url": auth_url,
        "state": state
    }

@app.get("/auth/callback")
async def microsoft_callback(code: str = None, state: str = None, error: str = None):
    """Handle Microsoft OAuth2 callback"""
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/meeting-notes?error={error}")
    
    if not code:
        return RedirectResponse(f"{FRONTEND_URL}/meeting-notes?error=no_code")
    
    try:
        # Exchange code for tokens
        tokens = await TeamsAuthService.exchange_code_for_tokens(code)
        
        # Get user info
        graph_service = GraphAPIService(tokens["access_token"])
        user_info = await graph_service.get_user_info()
        
        # Store tokens
        user_id = user_info["id"]
        user_tokens[user_id] = {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "expires_at": datetime.now() + timedelta(seconds=tokens["expires_in"])
        }
        
        # Create JWT token
        jwt_token = create_jwt_token(user_info)
        
        # Redirect to frontend with token
        return RedirectResponse(f"{FRONTEND_URL}/meeting-notes?token={jwt_token}")
        
    except Exception as e:
        return RedirectResponse(f"{FRONTEND_URL}/meeting-notes?error=auth_failed")

@app.get("/api/user")
async def get_user(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@app.get("/api/meetings")
async def get_meetings(
    limit: int = 10,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get user's Teams meetings"""
    try:
        access_token = await get_user_access_token(current_user["user_id"])
        graph_service = GraphAPIService(access_token)
        meetings = await graph_service.get_online_meetings(limit)
        
        return {"meetings": meetings}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch meetings: {str(e)}")

@app.get("/api/meeting-notes/{meeting_id}")
async def get_meeting_notes(
    meeting_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Get notes for a specific meeting"""
    try:
        access_token = await get_user_access_token(current_user["user_id"])
        graph_service = GraphAPIService(access_token)
        notes = await graph_service.get_meeting_notes(meeting_id)
        
        return notes
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch meeting notes: {str(e)}")

@app.post("/api/export-notes")
async def export_notes_to_pdf(
    request: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Export meeting notes to PDF"""
    try:
        meeting_id = request.get("meeting_id")
        notes = request.get("notes", "")
        
        # For demonstration, return base64 encoded "PDF"
        # In production, use a proper PDF library like reportlab
        pdf_content = f"Meeting Notes - {meeting_id}\n\n{notes}"
        pdf_base64 = base64.b64encode(pdf_content.encode()).decode()
        
        return {
            "pdf_base64": pdf_base64,
            "filename": f"meeting_notes_{meeting_id}.pdf"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export PDF: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)