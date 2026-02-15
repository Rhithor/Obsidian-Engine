from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    ollama_connection: str

