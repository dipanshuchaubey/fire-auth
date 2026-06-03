from fastapi import Depends, HTTPException, Security, Request
from libs.auth import get_auth_user
from libs import db

# Mapping actions to required tenant features
ACTION_TO_TENANT_FEATURE = {
    "read_resource": "read_resources",
    "create_resource": "read_resources",
    "delete_resource": "read_resources",
    "premium_analytics": "premium_analytics",
    "export_data": "export_data",
    "read_report": "read_resources",
}

def evaluate_policy(subject: dict, resource: dict | None, action: str) -> tuple[bool, str]:
    """
    Evaluates the ABAC policy based on Subject, Resource, and Action attributes.
    Returns (is_authorized: bool, reason_message: str)
    """
    uid = subject.get("uid")
    role = subject.get("role", "user")
    tenant_id = subject.get("tenant_id")
    blocked_features = subject.get("blocked_features", [])

    # Rule 1: User Blocklist check
    if action in blocked_features:
        return False, f"Feature '{action}' is explicitly blocked for this user by an administrator."

    # Rule 2: Tenant Feature check (if mapped)
    if tenant_id:
        tenant = db.get_tenant(tenant_id)
        tenant_features = tenant.get("features", [])
        required_feature = ACTION_TO_TENANT_FEATURE.get(action)
        if required_feature and required_feature not in tenant_features:
            return False, f"Feature '{action}' (requires tenant feature '{required_feature}') is not enabled for tenant plan '{tenant_id}'."
    else:
        return False, "User has no tenant assigned."

    # Rule 3: Role-based permissions within the tenant context
    # Admin can perform any action on resources in their tenant
    # Editor can read, create, and delete resources in their tenant
    # User can only read resources they own, and cannot export or view premium analytics unless they own them (if applicable)
    
    if action == "read_report":
        if role not in ["admin", "editor", "user"]:
            return False, "Insufficient permissions: Your role cannot read reports."
        return True, "Authorized"

    if action == "invite_user":
        if role != "admin":
            return False, "Only tenant administrators can invite users."
        return True, "Authorized"

    if action == "manage_tenant":
        if role != "admin":
            return False, "Only tenant administrators can manage tenant settings."
        return True, "Authorized"

    # Rule 4: Resource-specific check
    if resource:
        resource_tenant = resource.get("tenant_id")
        resource_owner = resource.get("owner_id")
        is_public = resource.get("is_public", False)

        # Tenant Isolation check
        if not is_public and resource_tenant != tenant_id:
            return False, "Access Denied: Resource belongs to another tenant."

        # Ownership/Role checks
        if action == "delete_resource":
            if role == "admin":
                return True, "Authorized"
            if role == "editor" and resource_owner == uid:
                return True, "Authorized"
            return False, "Insufficient permissions: Only admins, or editors who own the resource, can delete it."

        if action == "read_resource":
            if is_public:
                return True, "Authorized"
            if role in ["admin", "editor"]:
                return True, "Authorized"
            if role == "user" and resource_owner == uid:
                return True, "Authorized"
            return False, "Access Denied: You do not own this private resource."

        if action == "export_data":
            if role not in ["admin", "editor"]:
                return False, "Insufficient permissions: Only admins and editors can export resource data."
            return True, "Authorized"

    return True, "Authorized"

class ABACChecker:
    def __init__(self, action: str, resource_id_param: str | None = None):
        self.action = action
        self.resource_id_param = resource_id_param

    async def __call__(self, request: Request, user: dict = Depends(get_auth_user)):
        # 1. Fetch DB attributes for the user (Subject context)
        uid = user.get("uid")
        user_db_attrs = db.get_user_attributes(uid)
        
        subject = {
            "uid": uid,
            "role": user.get("role", "user"),
            "tenant_id": user.get("tenant_id"),
            "blocked_features": user_db_attrs.get("blocked_features", [])
        }

        # 2. Fetch Resource context if a resource ID parameter is provided
        resource = None
        if self.resource_id_param:
            # Resolve the parameter from path or query params
            resource_id = request.path_params.get(self.resource_id_param) or request.query_params.get(self.resource_id_param)
            if resource_id:
                resource = db.get_resource(resource_id)
                if not resource:
                    raise HTTPException(status_code=404, detail=f"Resource '{resource_id}' not found.")
            else:
                raise HTTPException(status_code=400, detail=f"Required parameter '{self.resource_id_param}' missing from request.")

        # 3. Evaluate policies
        authorized, reason = evaluate_policy(subject, resource, self.action)
        if not authorized:
            raise HTTPException(status_code=403, detail=f"ABAC Access Denied: {reason}")
            
        return {
            "user": user,
            "subject": subject,
            "resource": resource
        }
