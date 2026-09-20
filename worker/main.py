import hashlib
import io
import os
from typing import List

from PIL import Image

import boto3
import requests
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Body, Query
from pydantic import BaseModel
from supabase import create_client, Client

app = FastAPI(title='Shaadify Face AI Worker')
FACE_PROVIDER = os.getenv('FACE_PROVIDER', 'mock').lower()
AWS_REGION = os.getenv('AWS_REGION', 'ap-south-1')
BUCKET = os.getenv('SUPABASE_PHOTOS_BUCKET', 'wedding-photos')
COLLECTION_PREFIX = os.getenv('AWS_REKOGNITION_COLLECTION', 'shaadify-face-v1')
WORKER_SECRET = os.getenv('AI_WORKER_SECRET', '')
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
rekognition = boto3.client('rekognition', region_name=AWS_REGION) if FACE_PROVIDER == 'aws' else None
supabase: Client | None = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else None

class EnqueueRequest(BaseModel):
    wedding_id: str
    photo_ids: List[str]

class SearchRequest(BaseModel):
    wedding_id: str
    selfie_url: str
    threshold: float = 90

def auth_or_401(authorization: str | None):
    if WORKER_SECRET and authorization != f'Bearer {WORKER_SECRET}':
        raise HTTPException(status_code=401, detail='Unauthorized')

def collection_id(wedding_id: str) -> str:
    return f'{COLLECTION_PREFIX}-{wedding_id}'

def ensure_collection(cid: str):
    if FACE_PROVIDER != 'aws' or rekognition is None:
        return
    try:
        rekognition.describe_collection(CollectionId=cid)
    except rekognition.exceptions.ResourceNotFoundException:
        rekognition.create_collection(CollectionId=cid)

def download(url: str) -> bytes:
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    return response.content

def get_photo(photo_id: str, wedding_id: str):
    if supabase is None:
        raise RuntimeError('Supabase worker credentials are missing.')
    return supabase.table('photos').select('id,storage_path,original_name').eq('id', photo_id).eq('wedding_id', wedding_id).single().execute().data

def signed_photo_url(storage_path: str) -> str:
    if supabase is None:
        return ''
    signed = supabase.storage.from_(BUCKET).create_signed_url(storage_path, 3600)
    return signed.get('signedURL') or signed.get('signedUrl') or ''


def rekognition_safe_bytes(image: bytes) -> bytes:
    # Rekognition Image APIs accept raw image bytes up to 5 MB.
    if len(image) <= 4_500_000:
        return image
    try:
        source = Image.open(io.BytesIO(image)).convert("RGB")
    except Exception as exc:
        raise RuntimeError(f"Unsupported or unreadable image: {exc}")
    source.thumbnail((6000, 6000), Image.Resampling.LANCZOS)
    quality = 90
    while quality >= 55:
        out = io.BytesIO()
        source.save(out, format="JPEG", quality=quality, optimize=True)
        data = out.getvalue()
        if len(data) <= 4_500_000:
            return data
        quality -= 5
    raise RuntimeError("Could not reduce image below the Rekognition 5 MB input limit.")

def mock_face_id(image: bytes) -> str:
    return 'mock-' + hashlib.sha256(image).hexdigest()[:32]

def index_mock(wedding_id: str, photo_id: str, image: bytes):
    face_id = mock_face_id(image)
    supabase.table('face_embeddings').delete().eq('photo_id', photo_id).execute()
    supabase.table('face_embeddings').insert({'wedding_id': wedding_id,'photo_id': photo_id,'provider_face_id': face_id,'bbox': None,'embedding': {'provider': 'mock','warning': 'not facial recognition'}}).execute()

def index_aws(wedding_id: str, photo_id: str, image: bytes):
    cid = collection_id(wedding_id)
    ensure_collection(cid)
    result = rekognition.index_faces(CollectionId=cid, Image={'Bytes': rekognition_safe_bytes(image)}, ExternalImageId=photo_id, DetectionAttributes=[], MaxFaces=100, QualityFilter='AUTO')
    rows = []
    for record in result.get('FaceRecords', []):
        face = record.get('Face', {})
        rows.append({'wedding_id': wedding_id,'photo_id': photo_id,'provider_face_id': face.get('FaceId'),'bbox': face.get('BoundingBox'),'embedding': None})
    supabase.table('face_embeddings').delete().eq('photo_id', photo_id).execute()
    if rows:
        supabase.table('face_embeddings').insert(rows).execute()

def process_photo(wedding_id: str, photo_id: str):
    if supabase is None:
        raise RuntimeError('Supabase worker credentials are missing.')
    row = get_photo(photo_id, wedding_id)
    if not row:
        return
    supabase.table('photos').update({'status': 'processing'}).eq('id', photo_id).execute()
    try:
        url = signed_photo_url(row['storage_path'])
        if not url:
            raise RuntimeError('Could not create signed download URL.')
        image = download(url)
        if FACE_PROVIDER == 'aws':
            index_aws(wedding_id, photo_id, image)
        else:
            index_mock(wedding_id, photo_id, image)
        supabase.table('photos').update({'status': 'indexed'}).eq('id', photo_id).execute()
    except Exception:
        supabase.table('photos').update({'status': 'failed'}).eq('id', photo_id).execute()
        raise

def process_batch(wedding_id: str, photo_ids: List[str]):
    for photo_id in photo_ids:
        try:
            process_photo(wedding_id, photo_id)
        except Exception as exc:
            print(f'index failed {photo_id}: {exc}', flush=True)
    if supabase:
        count = supabase.table('face_embeddings').select('id', count='exact', head=True).eq('wedding_id', wedding_id).execute().count or 0
        status = 'ready' if count else 'failed'
        supabase.table('weddings').update({'face_count': count, 'status': status}).eq('id', wedding_id).execute()

@app.get('/health')
def health():
    return {'ok': True, 'service': 'shaadify-face-worker', 'provider': FACE_PROVIDER, 'supabase': bool(supabase)}

@app.post('/enqueue')
def enqueue(req: EnqueueRequest, background_tasks: BackgroundTasks, authorization: str | None = Header(default=None)):
    auth_or_401(authorization)
    if not req.photo_ids:
        return {'queued': 0}
    if supabase is None:
        raise HTTPException(status_code=500, detail='Worker Supabase credentials are missing.')
    background_tasks.add_task(process_batch, req.wedding_id, req.photo_ids)
    return {'queued': len(req.photo_ids), 'wedding_id': req.wedding_id, 'provider': FACE_PROVIDER}

@app.post('/search')
def search(req: SearchRequest, authorization: str | None = Header(default=None)):
    auth_or_401(authorization)
    if supabase is None:
        raise HTTPException(status_code=500, detail='Worker Supabase credentials are missing.')
    selfie = download(req.selfie_url)
    if FACE_PROVIDER == 'aws':
        cid = collection_id(req.wedding_id)
        try:
            result = rekognition.search_faces_by_image(CollectionId=cid, Image={'Bytes': rekognition_safe_bytes(selfie)}, MaxFaces=100, FaceMatchThreshold=req.threshold)
        except rekognition.exceptions.InvalidParameterException as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        matches = result.get('FaceMatches', [])
        photo_ids = [m.get('Face', {}).get('ExternalImageId') for m in matches if m.get('Face', {}).get('ExternalImageId')]
        scores = {m.get('Face', {}).get('ExternalImageId'): m.get('Similarity') for m in matches}
    else:
        face_id = mock_face_id(selfie)
        rows = supabase.table('face_embeddings').select('photo_id').eq('wedding_id', req.wedding_id).eq('provider_face_id', face_id).execute().data or []
        photo_ids = [r['photo_id'] for r in rows]
        scores = {pid: 100 for pid in photo_ids}
    if not photo_ids:
        return {'matches': [], 'provider': FACE_PROVIDER}
    photos = supabase.table('photos').select('id,storage_path,original_name').eq('wedding_id', req.wedding_id).in_('id', photo_ids).execute().data or []
    results = []
    for photo in photos:
        signed = supabase.storage.from_(BUCKET).create_signed_url(photo['storage_path'], 3600)
        signed_url = signed.get('signedURL') or signed.get('signedUrl')
        results.append({'photoId': photo['id'],'name': photo['original_name'],'url': signed_url,'similarity': scores.get(photo['id'])})
    return {'matches': results, 'provider': FACE_PROVIDER}
@app.post('/search-image')
async def search_image(image: bytes = Body(..., media_type='application/octet-stream'), wedding_id: str = Query(...), threshold: float = Query(90), authorization: str | None = Header(default=None)):
    auth_or_401(authorization)
    if supabase is None:
        raise HTTPException(status_code=500, detail='Worker Supabase credentials are missing.')
    if not image:
        raise HTTPException(status_code=400, detail='Image is required.')
    if FACE_PROVIDER != 'aws':
        face_id = mock_face_id(image)
        rows = supabase.table('face_embeddings').select('photo_id').eq('wedding_id', wedding_id).eq('provider_face_id', face_id).execute().data or []
        photo_ids = [r['photo_id'] for r in rows]
        scores = {pid: 100 for pid in photo_ids}
    else:
        cid = collection_id(wedding_id)
        try:
            result = rekognition.search_faces_by_image(CollectionId=cid, Image={'Bytes': image}, MaxFaces=100, FaceMatchThreshold=threshold)
        except rekognition.exceptions.InvalidParameterException as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        matches = result.get('FaceMatches', [])
        photo_ids = [m.get('Face', {}).get('ExternalImageId') for m in matches if m.get('Face', {}).get('ExternalImageId')]
        scores = {m.get('Face', {}).get('ExternalImageId'): m.get('Similarity') for m in matches}
    if not photo_ids:
        return {'matches': [], 'provider': FACE_PROVIDER}
    photos = supabase.table('photos').select('id,storage_path,original_name').eq('wedding_id', wedding_id).in_('id', photo_ids).execute().data or []
    results = []
    for photo in photos:
        signed = supabase.storage.from_(BUCKET).create_signed_url(photo['storage_path'], 3600)
        signed_url = signed.get('signedURL') or signed.get('signedUrl')
        results.append({'photoId': photo['id'], 'name': photo['original_name'], 'url': signed_url, 'similarity': scores.get(photo['id'])})
    return {'matches': results, 'provider': FACE_PROVIDER}
