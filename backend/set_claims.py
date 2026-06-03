import argparse
import sys
import os

# Adjust Python path so we can import local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from libs.auth import auth
from libs.db import set_user_attributes

def main():
    parser = argparse.ArgumentParser(description="Manually add custom claims to a Firebase user.")
    parser.add_argument("uid", help="The Firebase User ID (UID) of the user")
    parser.add_argument("--role", default="admin", help="The role to assign (e.g., admin, editor, user). Default: admin")
    parser.add_argument("--tenant", default="tenant-enterprise", help="The tenant ID to assign (e.g., tenant-starter, tenant-enterprise). Default: tenant-enterprise")
    
    args = parser.parse_args()
    
    claims = {
        "role": args.role,
        "tenant_id": args.tenant
    }
    
    print(f"Setting custom claims for UID: {args.uid}")
    print(f"Claims: {claims}")
    
    try:
        # Update Firebase Custom Claims
        auth.set_custom_user_claims(args.uid, claims)
        print("✅ Firebase Auth custom claims updated successfully.")
        
        # Also initialize their backend database attributes so they have an entry
        set_user_attributes(args.uid, [])
        print("✅ Database user attributes (blocked features) initialized to empty.")
        
        print(f"\nSuccessfully configured user {args.uid} with role '{args.role}' for tenant '{args.tenant}'.")
    except Exception as e:
        print(f"\n❌ Error setting claims: {e}")

if __name__ == "__main__":
    main()
