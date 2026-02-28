from fastapi import FastAPI, File, BackgroundTasks, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from models import health, privacy, query
from services import ai_service, privacy_service
from database import db
import uuid
import os
import shutil 
import fitz

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins = ["*"], allow_methods = ["*"], allow_headers = ["*"])

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

def process_document(file_path: str, original_filename: str):
    text_chunks = []
    metadata = []
    uuids = []
    chunk_size, chunk_overlap = 1000, 200
    try:
        with fitz.open(file_path) as file:
            for page in file:
                text = page.get_text() # extracting the text from each page
                start_index = 0
                while start_index < len(text):
                    text_chunks.append(text[start_index: start_index + chunk_size])
                    metadata.append({"source": original_filename, "page": page.number})
                    uuids.append(uuid.uuid4().hex)
                    start_index += chunk_size - chunk_overlap
           
        if text_chunks:
            db.collection.add(documents = text_chunks, metadatas = metadata, ids = uuids)
            print(f"Success! Shredded and saved {len(text_chunks)} chunks to ChromaDB.")
    
    except Exception as e:
        print(f"Background error: {e}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
    
@app.post("/ingest")
async def ingest_data(file: UploadFile, dispatcher: BackgroundTasks):
    unique_name =f"{uuid.uuid4().hex}.pdf"
    file_path = os.path.join("./temp_uploads", unique_name)
    # opening the directory to which the file has to be temporarily uploaded in binary write mode
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    dispatcher.add_task(process_document, file_path, file.filename)
    return {"message": "File accepted. Processing in background."}

@app.post("/query")
async def user_query(request: query.Query):
    question_text = request.QueryRequest
    db_dict = db.retrieve_context(question_text)
    return db_dict

