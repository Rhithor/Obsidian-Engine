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

@app.post("/summary")
async def summary_data(user_response: privacy.RequestUserInfo):
    scrubbed_result = await scrub_data(user_response= user_response)
    ai_response = await ai_service.prompt_ollama(scrubbed_result.response)
    if ai_response:
        return privacy.SummaryResponse(scrubbed_text = scrubbed_result.response, is_scrubbed = scrubbed_result.is_scrubbed, summary=ai_response)
    else:
        return privacy.SummaryResponse(scrubbed_text = scrubbed_result.response, is_scrubbed = scrubbed_result.is_scrubbed, summary = "AI is currently offline")
