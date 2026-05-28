from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from firebase_admin import auth
from libs.auth import RoleChecker

router = APIRouter(tags=["users"], prefix="/users")

# Only allow admins to access these endpoints
allow_admin = RoleChecker(["admin"])

class InviteUserModel(BaseModel):
    email: str
    role: str

class UpdateRoleModel(BaseModel):
    role: str

@router.get("")
def list_users(user=Depends(allow_admin)):
    try:
        # Note: In a production app with thousands of users, you should handle pagination using page_token
        page = auth.list_users()
        users_list = []
        for u in page.users:
            users_list.append({
                "uid": u.uid,
                "email": u.email,
                "role": u.custom_claims.get("role") if u.custom_claims else "user",
                "disabled": u.disabled
            })
        return {"users": users_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/invite")
def invite_user(payload: InviteUserModel, user=Depends(allow_admin)):
    try:
        # 1. Create the user in Firebase (without setting a password so they can't log in yet)
        new_user = auth.create_user(email=payload.email)
        
        # 2. Assign the role immediately using custom claims
        auth.set_custom_user_claims(new_user.uid, {"role": payload.role})
        
        # 3. Generate a password reset link which acts as their invite link
        # They will click it, set a new password, and their account becomes fully active
        invite_link = auth.generate_password_reset_link(payload.email)
        
        # Note: Ideally, use an email service (like SendGrid/AWS SES) here to email the invite_link.
        # For now, we return it so your UI can display it or send it directly.
        return {
            "message": "User invited successfully",
            "uid": new_user.uid,
            "invite_link": invite_link
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{uid}/role")
def update_user_role(uid: str, payload: UpdateRoleModel, user=Depends(allow_admin)):
    try:
        # Update the target user's custom claim
        auth.set_custom_user_claims(uid, {"role": payload.role})
        
        # Optional: You might want to revoke refresh tokens so their new access takes effect sooner
        # auth.revoke_refresh_tokens(uid)
        
        return {"message": f"Role successfully updated to '{payload.role}' for user {uid}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
