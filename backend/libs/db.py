import os
import json
import logging
import firebase_admin
from firebase_admin import firestore

logger = logging.getLogger(__name__)

# Try to initialize Firestore
db_client = None
use_firestore = False

try:
    # Check if Firebase Admin is initialized. If not, initialize it.
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
            from firebase_admin import credentials
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
            print(f"Firebase Admin initialized in DB using service account: {key_path}")
        else:
            firebase_admin.initialize_app()
            print("Firebase Admin initialized in DB using default credentials.")
    
    # Try connecting to the database named 'fire-auth' (or environment override)
    db_name = os.environ.get("FIRESTORE_DATABASE", "fire-auth")
    try:
        # firebase-admin 6.5.0+ uses database_id
        db_client = firestore.client(database_id=db_name)
        print(f"Firestore client initialized successfully for database '{db_name}'!")
    except TypeError:
        db_client = firestore.client()
        print("Firestore client initialized successfully for default database!")
        
    use_firestore = True
except Exception as e:
    print(f"Firestore failed to initialize: {e}. Falling back to local JSON database.")

# Tenant Helpers
def get_tenant(tenant_id: str) -> dict:
    if use_firestore:
        try:
            doc = db_client.collection("tenants").document(tenant_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Firestore get_tenant error: {e}")
    # Return defaults if missing
    return {
        "name": f"Tenant {tenant_id}",
        "features": ["basic_dashboard", "read_resources"]
    }

def set_tenant_features(tenant_id: str, name: str, features: list[str]):
    if use_firestore:
        try:
            db_client.collection("tenants").document(tenant_id).set({
                "name": name,
                "features": features
            }, merge=True)
            return
        except Exception as e:
            print(f"Firestore set_tenant_features error: {e}")

def list_tenants() -> list[dict]:
    if use_firestore:
        try:
            docs = db_client.collection("tenants").stream()
            return [{"id": doc.id, **doc.to_dict()} for doc in docs]
        except Exception as e:
            print(f"Firestore list_tenants error: {e}")

# User Attributes Helpers
def get_user_attributes(uid: str) -> dict:
    if use_firestore:
        try:
            doc = db_client.collection("users").document(uid).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Firestore get_user_attributes error: {e}")
    return {}

def set_user_attributes(uid: str, blocked_features: list[str]):
    if use_firestore:
        try:
            db_client.collection("users").document(uid).set({
                "blocked_features": blocked_features
            }, merge=True)
            return
        except Exception as e:
            print(f"Firestore set_user_attributes error: {e}")

# Resource Helpers
def get_resource(resource_id: str) -> dict:
    if use_firestore:
        try:
            doc = db_client.collection("resources").document(resource_id).get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Firestore get_resource error: {e}")

def set_resource(resource_id: str, name: str, tenant_id: str, owner_id: str, is_public: bool):
    res_data = {
        "id": resource_id,
        "name": name,
        "tenant_id": tenant_id,
        "owner_id": owner_id,
        "is_public": is_public
    }
    if use_firestore:
        try:
            db_client.collection("resources").document(resource_id).set(res_data)
            return
        except Exception as e:
            print(f"Firestore set_resource error: {e}")

def list_resources(tenant_id: str = None) -> list[dict]:
    if use_firestore:
        try:
            query = db_client.collection("resources")
            if tenant_id:
                query = query.where("tenant_id", "==", tenant_id)
            docs = query.stream()
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            print(f"Firestore list_resources error: {e}")

def delete_resource(resource_id: str):
    if use_firestore:
        try:
            db_client.collection("resources").document(resource_id).delete()
            return
        except Exception as e:
            print(f"Firestore delete_resource error: {e}")

# Invitation Helpers
def create_invitation(email: str, role: str, tenant_id: str):
    if use_firestore:
        try:
            # Using the email as the document ID for faster lookup and uniqueness
            db_client.collection("invitations").document(email).set({
                "role": role,
                "tenant_id": tenant_id
            })
            return True
        except Exception as e:
            print(f"Firestore create_invitation error: {e}")
            raise e
    return False
