from firebase_admin import initialize_app, _apps
if not _apps:
    initialize_app()
print("Initialized!")
