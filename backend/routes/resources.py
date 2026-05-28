from fastapi import APIRouter, Depends
from libs.auth import get_auth_user, RoleChecker

router = APIRouter(tags=["resources"], prefix="/resources")

# Allow only users with the 'admin' or 'editor' role to access this endpoint
allow_admin_or_editor = RoleChecker(["admin", "editor"])

@router.get("")
def get_resources(user=Depends(allow_admin_or_editor)):
    return {"message": "This is the resources endpoint. You have access!", "role": user.get("role"), "user": user}

@router.get("/public")
def get_public_resources(user=Depends(get_auth_user)):
    return {"message": "This is a public authenticaded resources endpoint."}

