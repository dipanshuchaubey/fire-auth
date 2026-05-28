import firebase_admin
from firebase_admin import auth

# Initialize
app = firebase_admin.initialize_app(options={'projectId': 'carthage-fire'})

# Get your user by your email and set the admin claim
email = "dipanshuddc@gmail.com" # Put your email here!
user = auth.get_user_by_email(email)
auth.set_custom_user_claims(user.uid, {"role": "admin"})
print("Role set! You are now an Admin.")