from io import BytesIO
from pathlib import Path
import os
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document
from supabase import create_client

app = FastAPI(title='Atlas Support AI API', version='1.0.0')
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
ALLOWED = {'.pdf', '.docx', '.txt'}
THRESHOLD = float(os.getenv('RAG_SCORE_THRESHOLD', '0.76'))

class ChatRequest(BaseModel):
    conversation_id: str
    message: str

def extract_text(filename: str, payload: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(400, 'Only PDF, DOCX, and TXT files are supported.')
    if suffix == '.pdf':
        return '\n'.join(page.extract_text() or '' for page in PdfReader(BytesIO(payload)).pages)
    if suffix == '.docx':
        return '\n'.join(paragraph.text for paragraph in Document(BytesIO(payload)).paragraphs)
    return payload.decode('utf-8', errors='replace')

def chunks(text: str, size: int = 900, overlap: int = 120) -> list[str]:
    normalized = ' '.join(text.split())
    return [normalized[i:i + size] for i in range(0, len(normalized), size - overlap) if normalized[i:i + size].strip()]

@app.post('/ingest')
async def ingest(file: UploadFile = File(...)):
    payload = await file.read()
    parts = chunks(extract_text(file.filename or '', payload))
    if not parts:
        raise HTTPException(422, 'The document contains no readable text.')
    doc = supabase.table('knowledge_documents').insert({'name': file.filename, 'file_type': Path(file.filename or '').suffix[1:].upper(), 'file_size': len(payload), 'status': 'processing'}).execute().data[0]
    # Generate embeddings with the configured provider here, then insert vectors into knowledge_chunks.
    rows = [{'document_id': doc['id'], 'content': part, 'chunk_index': index, 'metadata': {'source': file.filename}} for index, part in enumerate(parts)]
    supabase.table('knowledge_chunks').insert(rows).execute()
    result = supabase.table('knowledge_documents').update({'status': 'ready', 'chunk_count': len(rows)}).eq('id', doc['id']).execute().data[0]
    return result

@app.post('/chat')
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(400, 'Message is required.')
    # Call the embedding provider, run pgvector similarity search, and pass only above-threshold chunks to the LLM.
    # The generation prompt must reject any claim not present in retrieved context.
    answer = "I don't know based on the current knowledge base."
    row = {'conversation_id': request.conversation_id, 'role': 'assistant', 'content': answer, 'citations': []}
    supabase.table('support_messages').insert(row).execute()
    return {'answer': answer, 'citations': [], 'grounded': False}
