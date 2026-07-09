from pydantic import BaseModel


class Query(BaseModel):
    query: str
    collection_id: str