from fastapi import FastAPI
from models import health, privacy
from services import ai_service, privacy_service

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

@app.post("/scrub")
async def scrub_data(user_response: privacy.RequestUserInfo):
    text = user_response.user_info
    results = await privacy_service.scrub_text(text=text)
    return privacy.ScrubbedResponse(response=results["response"], is_scrubbed=results["is_scrubbed"])


