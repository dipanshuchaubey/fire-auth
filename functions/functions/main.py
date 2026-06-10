# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

from firebase_functions import identity_fn, https_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# initialize_app()
initialize_app()

# For cost control, you can set the maximum number of containers that can be
# running at the same time. This helps mitigate the impact of unexpected
# traffic spikes by instead downgrading performance. This limit is a per-function
# limit. You can override the limit for each function using the max_instances
# parameter in the decorator, e.g. @https_fn.on_request(max_instances=5).
set_global_options(max_instances=10)

@identity_fn.before_user_created()
def before_created(event: identity_fn.AuthBlockingEvent) -> identity_fn.BeforeCreateResponse | None:
    """Validates if user was invited and injects custom claims."""
    user = event.data
    
    if not user.email:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="User must have an email address."
        )

    db = firestore.client(database_id="fire-auth")
    invitation_doc = db.collection("invitations").document(user.email).get()
    
    if not invitation_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="User is not invited."
        )
        
    invitation = invitation_doc.to_dict()
    
    return identity_fn.BeforeCreateResponse(
        custom_claims={
            "role": invitation.get("role"),
            "tenant_id": invitation.get("tenant_id")
        }
    )

@identity_fn.before_user_signed_in()
def before_signed_in(event: identity_fn.AuthBlockingEvent) -> identity_fn.BeforeSignInResponse | None:
    """Blocks any user from signing in if their email is not a @gmail.com address."""
    user = event.data
    
    if user.email and not user.email.endswith("@gmail.com"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Only @gmail.com accounts are allowed to sign in."
        )
    return None