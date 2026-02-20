import os
import jwt
import requests
from dotenv import load_dotenv
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

security = HTTPBearer()

CLERK_ISSUER_URL = os.getenv("CLERK_ISSUER_URL")
# If not set, we might default to None and skip verification or fail
# For now, let's just log a warning if not set.

def get_jwks_url():
    if not CLERK_ISSUER_URL:
        return None
    return f"{CLERK_ISSUER_URL}/.well-known/jwks.json"


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    jwks_url = get_jwks_url()
    
    if not jwks_url:
        print("Warning: CLERK_ISSUER_URL not set. Skipping token verification.")
        return {"sub": "dev_user", "warning": "verification_skipped"}

    try:
        jwks_client = jwt.PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=os.getenv("CLERK_AUDIENCE"), # Optional
            options={"verify_aud": False}, # Often Clerk tokens don't have aud set by default unless configured
            leeway=60 # Handle clock skew (1 minute)
        )
        return payload
    except jwt.PyJWTError as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid authentication credentials: {e}")
    except Exception as e:
        print(f"Auth Error (Generic): {e}")
        raise HTTPException(status_code=500, detail=f"Authentication error: {e}")

def get_current_user(token_payload: dict = Depends(verify_token)):
    return token_payload
