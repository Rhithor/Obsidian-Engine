from pydantic import BaseModel

class RequestUserInfo(BaseModel):
    user_info : str

class ScrubbedResponse(BaseModel):
    response : str
    is_scrubbed : bool