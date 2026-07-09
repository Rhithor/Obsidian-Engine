from pydantic import BaseModel


class IngestResponse(BaseModel):
    message: str
    collection_id: str
    filename: str


class CollectionInfo(BaseModel):
    collection_id: str
    filename: str
    chunk_count: int
