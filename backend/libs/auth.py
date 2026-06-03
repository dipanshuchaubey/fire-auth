import os
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Initialize Firebase Admin using service account if available, otherwise default credentials
if not firebase_admin._apps:
    key_path = None
    possible_keys = [
        "service-account.json",
        "../service-account.json",
        "firebase-key.json",
        "../firebase-key.json",
        "backend/service-account.json"
    ]
    for p in possible_keys:
        if os.path.exists(p):
            key_path = p
            break
            
    if key_path:
        try:
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
            print(f"Firebase Admin initialized using service account: {key_path}")
        except Exception as e:
            print(f"Error initializing Firebase with service account {key_path}: {e}")
            firebase_admin.initialize_app()
    else:
        try:
            firebase_admin.initialize_app()
            print("Firebase Admin initialized using default credentials.")
        except Exception as e:
            print(f"Firebase Admin failed to initialize: {e}")

security = HTTPBearer()

def get_auth_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Validates the Firebase ID token and returns the decoded token payload.
    """
    token = credentials.credentials
    try:
        # Verify the ID token, checking if it is valid, decoded, and NOT revoked/user disabled
        decoded_token = auth.verify_id_token(token, check_revoked=True)
        return decoded_token
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=401,
            detail="Token has been revoked.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.UserDisabledError:
        raise HTTPException(
            status_code=401,
            detail="User account has been disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: dict = Security(get_auth_user)):
        # We check the 'role' custom claim we expect to be attached to the user token
        user_role = user.get("role")
        if user_role not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return user