from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from firebase_admin import auth
from libs.auth import get_auth_user, RoleChecker
from libs import db

router = APIRouter(tags=["users"], prefix="/users")

# Allow only admins to manage users
allow_admin = RoleChecker(["admin"])

class InviteUserModel(BaseModel):
    email: str
    role: str
    blocked_features: list[str] = []

class UpdateClaimsModel(BaseModel):
    role: str
    tenant_id: str
    blocked_features: list[str] = []

class UpdateTenantModel(BaseModel):
    name: str
    features: list[str]

@router.get("")
def list_users(user=Depends(allow_admin)):
    try:
        page = auth.list_users()
        users_list = []
        for u in page.users:
            claims = u.custom_claims or {}
            user_db_attrs = db.get_user_attributes(u.uid)
            users_list.append({
                "uid": u.uid,
                "email": u.email,
                "role": claims.get("role", "user"),
                "tenant_id": claims.get("tenant_id", "tenant-starter"),
                "blocked_features": user_db_attrs.get("blocked_features", []),
                "disabled": u.disabled
            })
        return {"users": users_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me/profile")
def get_my_profile(user=Depends(get_auth_user)):
    try:
        uid = user.get("uid")
        email = user.get("email")
        role = user.get("role", "user")
        tenant_id = user.get("tenant_id")

        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant ID is missing in user claims. Please contact support.")

        # Load database attributes
        user_db_attrs = db.get_user_attributes(uid)
        blocked_features = user_db_attrs.get("blocked_features", [])

        # Load tenant attributes
        tenant = db.get_tenant(tenant_id)
        tenant_features = tenant.get("features", [])

        return {
            "uid": uid,
            "email": email,
            "role": role,
            "tenant_id": tenant_id,
            "blocked_features": blocked_features,
            "tenant_features": tenant_features,
            "tenant_name": tenant.get("name", f"Tenant {tenant_id}")
        }
    except Exception as e:
        print(f"Error in get_my_profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invite")
def invite_user(payload: InviteUserModel, user=Depends(allow_admin)):
    try:
        # Get the inviting admin's tenant_id
        admin_tenant_id = user.get("tenant_id")
        if not admin_tenant_id:
            raise HTTPException(status_code=400, detail="Admin does not have a tenant_id assigned.")
            
        # Store the invitation in Firestore
        db.create_invitation(payload.email, payload.role, admin_tenant_id)
        
        return {
            "message": "User invited successfully. They can now sign in with Google."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{uid}/claims")
def update_user_claims(uid: str, payload: UpdateClaimsModel, user=Depends(allow_admin)):
    try:
        # Update Firebase Custom Claims (role and tenant)
        auth.set_custom_user_claims(uid, {
            "role": payload.role,
            "tenant_id": payload.tenant_id
        })
        
        # Update user attributes in database
        db.set_user_attributes(uid, payload.blocked_features)
        
        return {"message": f"Claims successfully updated for user {uid}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/tenants")
def get_tenants(user=Depends(get_auth_user)):
    return {"tenants": db.list_tenants()}

@router.post("/tenants/{tenant_id}")
def update_tenant(tenant_id: str, payload: UpdateTenantModel, user=Depends(allow_admin)):
    db.set_tenant_features(tenant_id, payload.name, payload.features)
    return {"message": f"Tenant '{tenant_id}' updated successfully"}

