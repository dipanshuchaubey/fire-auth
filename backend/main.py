from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import resources_router, users_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (update this for production!)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods including OPTIONS
    allow_headers=["*"],
)

app.router.prefix = "/api"
app.include_router(resources_router)
app.include_router(users_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}