from fastapi import FastAPI
from models import health
from services import ai_service

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello"}

@app.get("/health")
async def check_ollama():
    status = await ai_service.is_ollama()
    if status:
        return health.HealthResponse(status="active", ollama_connection="connected")
    else:
        return health.HealthResponse(status="inactive", ollama_connection="disconnected")



