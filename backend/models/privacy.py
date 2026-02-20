from pydantic import BaseModel

class RequestUserInfo(BaseModel):
    user_info : str

class ScrubbedResponse(BaseModel):
    response : str
    is_scrubbed : bool

class SummaryResponse(BaseModel):
    scrubbed_text: str
    is_scrubbed: bool
    summary: str