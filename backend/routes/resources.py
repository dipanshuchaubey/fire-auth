from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from libs.auth import get_auth_user
from libs.abac import ABACChecker
from libs import db

router = APIRouter(tags=["resources"], prefix="/resources")

class CreateResourceModel(BaseModel):
    name: str
    is_public: bool = False

@router.get("")
def get_resources(user=Depends(get_auth_user)):
    try:
        uid = user.get("uid")
        tenant_id = user.get("tenant_id")
        
        # 1. Check if user is blocked or if tenant doesn't support read_resources
        user_db_attrs = db.get_user_attributes(uid)
        blocked = user_db_attrs.get("blocked_features", [])
        if "read_resource" in blocked:
            raise HTTPException(status_code=403, detail="ABAC Policy Denial: You are blocked from reading resources.")
            
        tenant = db.get_tenant(tenant_id)
        if "read_resources" not in tenant.get("features", []):
            raise HTTPException(status_code=403, detail="ABAC Policy Denial: Feature 'read_resources' is not enabled for your tenant plan.")
            
        # 2. Retrieve resources matching tenant
        resources = db.list_resources(tenant_id)
        
        # 3. Filter for non-admin/editor (regular 'user' role can only read resources they own or public ones)
        role = user.get("role", "user")
        if role not in ["admin", "editor"]:
            resources = [r for r in resources if r.get("owner_id") == uid or r.get("is_public", False)]
            
        return {"resources": resources}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
def create_resource(payload: CreateResourceModel, abac_ctx=Depends(ABACChecker("create_resource"))):
    import uuid
    try:
        subject = abac_ctx["subject"]
        res_id = f"res-{uuid.uuid4().hex[:8]}"
        db.set_resource(
            resource_id=res_id,
            name=payload.name,
            tenant_id=subject["tenant_id"],
            owner_id=subject["uid"],
            is_public=payload.is_public
        )
        return {"message": "Resource created successfully", "resource_id": res_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{resource_id}")
def delete_resource(resource_id: str, abac_ctx=Depends(ABACChecker("delete_resource", resource_id_param="resource_id"))):
    try:
        db.delete_resource(resource_id)
        return {"message": f"Resource '{resource_id}' deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/report")
def read_report(abac_ctx=Depends(ABACChecker("read_report"))):
    return {"message": "Report data loaded successfully!"}

@router.get("/analytics")
def get_analytics(abac_ctx=Depends(ABACChecker("premium_analytics"))):
    # Return mock analytics chart data
    import random
    return {
        "message": "Premium analytics loaded successfully!",
        "chart_data": [
            {"month": "Jan", "revenue": random.randint(10000, 20000)},
            {"month": "Feb", "revenue": random.randint(15000, 25000)},
            {"month": "Mar", "revenue": random.randint(20000, 35000)},
            {"month": "Apr", "revenue": random.randint(30000, 50000)},
        ]
    }

@router.get("/{resource_id}/export")
def export_resource(resource_id: str, abac_ctx=Depends(ABACChecker("export_data", resource_id_param="resource_id"))):
    resource = abac_ctx["resource"]
    csv_content = f"id,name,tenant_id,owner_id,is_public\n{resource['id']},{resource['name']},{resource['tenant_id']},{resource['owner_id']},{resource['is_public']}"
    return {
        "message": "Resource data exported successfully!",
        "csv": csv_content,
        "filename": f"export_{resource_id}.csv"
    }
