import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Make sure you have set the GOOGLE_APPLICATION_CREDENTIALS environment variable 
# pointing to your service account key JSON file, or provide the credential explicitly.
default_app = firebase_admin.initialize_app()
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