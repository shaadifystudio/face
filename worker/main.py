import hashlib
import io
import os
from typing import List

from PIL import Image

import boto3
import numpy as np
import requests
import face_recognition
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Body, Query
from pydantic import BaseModel
from supabase import create_client, Client

app = FastAPI(title='Shaadify Face AI Worker')

# dlib/face_recognition is the default self-hosted provider for the free MVP.
# Its bundled dlib recognition model is released to the public domain by its
# creator; review model/data provenance with counsel before commercial launch.
FACE_PROVIDER = os.getenv('FACE_PROVIDER', 'dlib').lower()

# Legacy/self-hosted providers retained behind the same interface.
COMPRE_FACE_URL = os.getenv('COMPRE_FACE_URL', '').rstrip('/')
COMPRE_FACE_API_KEY = os.getenv('COMPRE_FACE_API_KEY', '')
COMPRE_FACE_MIN_SIMILARITY = float(os.getenv('COMPRE_FACE_MIN_SIMILARITY', '0.75'))
COMPRE_FACE_PREDICTION_COUNT = int(os.getenv('COMPRE_FACE_PREDICTION_COUNT', '1000'))

AWS_REGION = os.getenv('AWS_REGION', 'ap-south-1')
BUCKET = os.getenv('SUPABASE_PHOTOS_BUCKET', 'wedding-photos')
COLLECTION_PREFIX = os.getenv('AWS_REKOGNITION_COLLECTION', 'shaadify-face-v1')
WORKER_SECRET = os.getenv('AI_WORKER_SECRET', '')
DLIB_MAX_DISTANCE = float(os.getenv('DLIB_MAX_DISTANCE', '0.6'))
DLIB_MAX_IMAGE_SIDE = int(os.getenv('DLIB_MAX_IMAGE_SIDE', '2400'))

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

rekognition = boto3.client('rekognition', region_name=AWS_REGION) if FACE_PROVIDER == 'aws' else None
supabase: Client | None = (
    create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    else None
)


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
    return (
        supabase.table('photos')
        .select('id,storage_path,original_name')
        .eq('id', photo_id)
        .eq('wedding_id', wedding_id)
        .single()
        .execute()
        .data
    )


def signed_photo_url(storage_path: str) -> str:
    if supabase is None:
        return ''
    signed = supabase.storage.from_(BUCKET).create_signed_url(storage_path, 3600)
    return signed.get('signedURL') or signed.get('signedUrl') or ''


def prepare_rgb_image(image: bytes) -> np.ndarray:
    try:
        source = Image.open(io.BytesIO(image)).convert('RGB')
    except Exception as exc:
        raise RuntimeError(f'Unsupported or unreadable image: {exc}')

    max_side = max(source.size)
    if max_side > DLIB_MAX_IMAGE_SIDE:
        scale = DLIB_MAX_IMAGE_SIDE / max_side
        source = source.resize(
            (max(1, round(source.width * scale)), max(1, round(source.height * scale))),
            Image.Resampling.LANCZOS,
        )
    return np.asarray(source, dtype=np.uint8)


def dlib_index_photo(wedding_id: str, photo_id: str, image: bytes):
    if supabase is None:
        raise RuntimeError('Supabase worker credentials are missing.')

    rgb = prepare_rgb_image(image)
    locations = face_recognition.face_locations(rgb, model='hog')
    encodings = face_recognition.face_encodings(
        rgb,
        known_face_locations=locations,
        num_jitters=1,
        model='small',
    )

    supabase.table('face_embeddings').delete().eq('photo_id', photo_id).execute()

    rows = []
    for index, (location, encoding) in enumerate(zip(locations, encodings)):
        top, right, bottom, left = location
        rows.append({
            'wedding_id': wedding_id,
            'photo_id': photo_id,
            'provider_face_id': f'{photo_id}:{index}',
            'bbox': {
                'top': int(top),
                'right': int(right),
                'bottom': int(bottom),
                'left': int(left),
            },
            'embedding': {
                'provider': 'dlib',
                'vector': encoding.astype(float).tolist(),
            },
        })

    if rows:
        supabase.table('face_embeddings').insert(rows).execute()

    return len(rows)


def dlib_search(image: bytes, wedding_id: str):
    if supabase is None:
        raise RuntimeError('Supabase worker credentials are missing.')

    rgb = prepare_rgb_image(image)
    locations = face_recognition.face_locations(rgb, model='hog')
    query_encodings = face_recognition.face_encodings(
        rgb,
        known_face_locations=locations,
        num_jitters=1,
        model='small',
    )

    if not query_encodings:
        return {}

    rows = (
        supabase.table('face_embeddings')
        .select('photo_id,embedding')
        .eq('wedding_id', wedding_id)
        .execute()
        .data
        or []
    )

    if not rows:
        return {}

    database = []
    photo_ids = []
    for row in rows:
        vector = (row.get('embedding') or {}).get('vector')
        if isinstance(vector, list) and len(vector) == 128:
            database.append(vector)
            photo_ids.append(row['photo_id'])

    if not database:
        return {}

    matrix = np.asarray(database, dtype=np.float32)
    matches = {}

    for query in query_encodings:
        distances = np.linalg.norm(matrix - query.astype(np.float32), axis=1)
        for index, distance in enumerate(distances):
            distance = float(distance)
            if distance <= DLIB_MAX_DISTANCE:
                photo_id = photo_ids[index]
                similarity = max(0.0, 1.0 - distance)
                matches[photo_id] = max(similarity, matches.get(photo_id, 0.0))

    return matches


def rekognition_safe_bytes(image: bytes) -> bytes:
    if len(image) <= 4_500_000:
        return image
    try:
        source = Image.open(io.BytesIO(image)).convert('RGB')
    except Exception as exc:
        raise RuntimeError(f'Unsupported or unreadable image: {exc}')
    source.thumbnail((6000, 6000), Image.Resampling.LANCZOS)
    quality = 90
    while quality >= 55:
        out = io.BytesIO()
        source.save(out, format='JPEG', quality=quality, optimize=True)
        data = out.getvalue()
        if len(data) <= 4_500_000:
            return data
        quality -= 5
    raise RuntimeError('Could not reduce image below the Rekognition 5 MB input limit.')


def compreface_headers():
    if not COMPRE_FACE_URL or not COMPRE_FACE_API_KEY:
        raise RuntimeError('CompreFace URL/API key are missing.')
    return {'x-api-key': COMPRE_FACE_API_KEY}


def compreface_url(path: str) -> str:
    return f"{COMPRE_FACE_URL}/api/v1/recognition/{path.lstrip('/')}"


def compreface_add(wedding_id: str, photo_id: str, image: bytes) -> str:
    subject = f'{wedding_id}:{photo_id}'
    response = requests.post(
        compreface_url('faces'),
        params={'subject': subject, 'det_prob_threshold': 0.7},
        headers=compreface_headers(),
        files={'file': ('photo.jpg', rekognition_safe_bytes(image), 'image/jpeg')},
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    image_id = data.get('image_id')
    if not image_id:
        raise RuntimeError(f'CompreFace did not return an image_id: {data}')
    return image_id


def compreface_delete_images(image_ids: List[str]):
    ids = [value for value in image_ids if value]
    for start in range(0, len(ids), 100):
        chunk = ids[start:start + 100]
        response = requests.post(
            compreface_url('faces/delete'),
            headers={**compreface_headers(), 'Content-Type': 'application/json'},
            json=chunk,
            timeout=120,
        )
        response.raise_for_status()


def index_compreface(wedding_id: str, photo_id: str, image: bytes):
    if supabase is None:
        raise RuntimeError('Supabase worker credentials are missing.')
    existing = (
        supabase.table('face_embeddings')
        .select('provider_face_id')
        .eq('photo_id', photo_id)
        .execute()
        .data
        or []
    )
    compreface_delete_images([row['provider_face_id'] for row in existing])
    supabase.table('face_embeddings').delete().eq('photo_id', photo_id).execute()
    image_id = compreface_add(wedding_id, photo_id, image)
    supabase.table('face_embeddings').insert({
        'wedding_id': wedding_id,
        'photo_id': photo_id,
        'provider_face_id': image_id,
        'bbox': None,
        'embedding': {'provider': 'compreface', 'subject': f'{wedding_id}:{photo_id}'},
    }).execute()


def search_compreface(image: bytes, wedding_id: str, threshold: float):
    minimum = threshold / 100 if threshold > 1 else threshold
    minimum = max(0.0, min(1.0, minimum))
    response = requests.post(
        compreface_url('recognize'),
        params={
            'limit': 0,
            'prediction_count': COMPRE_FACE_PREDICTION_COUNT,
            'det_prob_threshold': 0.7,
        },
        headers=compreface_headers(),
        files={'file': ('selfie.jpg', rekognition_safe_bytes(image), 'image/jpeg')},
        timeout=180,
    )
    response.raise_for_status()
    data = response.json()
    matches = {}
    prefix = f'{wedding_id}:'
    for face in data.get('result', []):
        for subject in face.get('subjects', []):
            name = subject.get('subject', '')
            similarity = float(subject.get('similarity', 0))
            if name.startswith(prefix) and similarity >= minimum:
                photo_id = name[len(prefix):]
                matches[photo_id] = max(similarity, matches.get(photo_id, 0))
    return matches


def mock_face_id(image: bytes) -> str:
    return 'mock-' + hashlib.sha256(image).hexdigest()[:32]


def index_mock(wedding_id: str, photo_id: str, image: bytes):
    face_id = mock_face_id(image)
    supabase.table('face_embeddings').delete().eq('photo_id', photo_id).execute()
    supabase.table('face_embeddings').insert({
        'wedding_id': wedding_id,
        'photo_id': photo_id,
        'provider_face_id': face_id,
        'bbox': None,
        'embedding': {'provider': 'mock', 'warning': 'not facial recognition'},
    }).execute()


def index_aws(wedding_id: str, photo_id: str, image: bytes):
    cid = collection_id(wedding_id)
    ensure_collection(cid)
    result = rekognition.index_faces(
        CollectionId=cid,
        Image={'Bytes': rekognition_safe_bytes(image)},
        ExternalImageId=photo_id,
        DetectionAttributes=[],
        MaxFaces=100,
        QualityFilter='AUTO',
    )
    rows = []
    for record in result.get('FaceRecords', []):
        face = record.get('Face', {})
        rows.append({
            'wedding_id': wedding_id,
            'photo_id': photo_id,
            'provider_face_id': face.get('FaceId'),
            'bbox': face.get('BoundingBox'),
            'embedding': None,
        })
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

        if FACE_PROVIDER == 'dlib':
            dlib_index_photo(wedding_id, photo_id, image)
        elif FACE_PROVIDER == 'aws':
            index_aws(wedding_id, photo_id, image)
        elif FACE_PROVIDER == 'compreface':
            index_compreface(wedding_id, photo_id, image)
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
        count = (
            supabase.table('face_embeddings')
            .select('id', count='exact', head=True)
            .eq('wedding_id', wedding_id)
            .execute()
            .count
            or 0
        )
        status = 'ready' if count else 'failed'
        supabase.table('weddings').update({
            'face_count': count,
            'status': status,
        }).eq('id', wedding_id).execute()


def build_search_results(wedding_id: str, photo_ids: List[str], scores: dict):
    if not photo_ids:
        return []

    photos = (
        supabase.table('photos')
        .select('id,storage_path,original_name')
        .eq('wedding_id', wedding_id)
        .in_('id', photo_ids)
        .execute()
        .data
        or []
    )

    results = []
    for photo in photos:
        signed = supabase.storage.from_(BUCKET).create_signed_url(
            photo['storage_path'],
            3600,
        )
        signed_url = signed.get('signedURL') or signed.get('signedUrl')
        results.append({
            'photoId': photo['id'],
            'name': photo['original_name'],
            'url': signed_url,
            'similarity': scores.get(photo['id']),
        })

    results.sort(key=lambda item: item.get('similarity') or 0, reverse=True)
    return results


@app.get('/health')
def health():
    return {
        'ok': True,
        'service': 'shaadify-face-worker',
        'provider': FACE_PROVIDER,
        'supabase': bool(supabase),
    }


@app.post('/enqueue')
def enqueue(
    req: EnqueueRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
    auth_or_401(authorization)
    if not req.photo_ids:
        return {'queued': 0}

    if supabase is None:
        raise HTTPException(
            status_code=500,
            detail='Worker Supabase credentials are missing.',
        )

    background_tasks.add_task(process_batch, req.wedding_id, req.photo_ids)
    return {
        'queued': len(req.photo_ids),
        'wedding_id': req.wedding_id,
        'provider': FACE_PROVIDER,
    }


@app.post('/search')
def search(
    req: SearchRequest,
    authorization: str | None = Header(default=None),
):
    auth_or_401(authorization)

    if supabase is None:
        raise HTTPException(
            status_code=500,
            detail='Worker Supabase credentials are missing.',
        )

    selfie = download(req.selfie_url)

    if FACE_PROVIDER == 'dlib':
        scores = dlib_search(selfie, req.wedding_id)
        photo_ids = list(scores.keys())
    elif FACE_PROVIDER == 'compreface':
        scores = search_compreface(selfie, req.wedding_id, req.threshold)
        photo_ids = list(scores.keys())
    elif FACE_PROVIDER == 'aws':
        cid = collection_id(req.wedding_id)
        try:
            result = rekognition.search_faces_by_image(
                CollectionId=cid,
                Image={'Bytes': rekognition_safe_bytes(selfie)},
                MaxFaces=100,
                FaceMatchThreshold=req.threshold,
            )
        except rekognition.exceptions.InvalidParameterException as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        matches = result.get('FaceMatches', [])
        photo_ids = [
            m.get('Face', {}).get('ExternalImageId')
            for m in matches
            if m.get('Face', {}).get('ExternalImageId')
        ]
        scores = {
            m.get('Face', {}).get('ExternalImageId'): m.get('Similarity')
            for m in matches
        }
    else:
        face_id = mock_face_id(selfie)
        rows = (
            supabase.table('face_embeddings')
            .select('photo_id')
            .eq('wedding_id', req.wedding_id)
            .eq('provider_face_id', face_id)
            .execute()
            .data
            or []
        )
        photo_ids = [r['photo_id'] for r in rows]
        scores = {pid: 100 for pid in photo_ids}

    return {
        'matches': build_search_results(req.wedding_id, photo_ids, scores),
        'provider': FACE_PROVIDER,
    }


@app.post('/search-image')
async def search_image(
    image: bytes = Body(..., media_type='application/octet-stream'),
    wedding_id: str = Query(...),
    threshold: float = Query(90),
    authorization: str | None = Header(default=None),
):
    auth_or_401(authorization)

    if supabase is None:
        raise HTTPException(
            status_code=500,
            detail='Worker Supabase credentials are missing.',
        )

    if not image:
        raise HTTPException(status_code=400, detail='Image is required.')

    if FACE_PROVIDER == 'dlib':
        scores = dlib_search(image, wedding_id)
        photo_ids = list(scores.keys())
    elif FACE_PROVIDER == 'compreface':
        scores = search_compreface(image, wedding_id, threshold)
        photo_ids = list(scores.keys())
    elif FACE_PROVIDER == 'aws':
        cid = collection_id(wedding_id)
        try:
            result = rekognition.search_faces_by_image(
                CollectionId=cid,
                Image={'Bytes': rekognition_safe_bytes(image)},
                MaxFaces=100,
                FaceMatchThreshold=threshold,
            )
        except rekognition.exceptions.InvalidParameterException as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        matches = result.get('FaceMatches', [])
        photo_ids = [
            m.get('Face', {}).get('ExternalImageId')
            for m in matches
            if m.get('Face', {}).get('ExternalImageId')
        ]
        scores = {
            m.get('Face', {}).get('ExternalImageId'): m.get('Similarity')
            for m in matches
        }
    else:
        face_id = mock_face_id(image)
        rows = (
            supabase.table('face_embeddings')
            .select('photo_id')
            .eq('wedding_id', wedding_id)
            .eq('provider_face_id', face_id)
            .execute()
            .data
            or []
        )
        photo_ids = [r['photo_id'] for r in rows]
        scores = {pid: 100 for pid in photo_ids}

    return {
        'matches': build_search_results(wedding_id, photo_ids, scores),
        'provider': FACE_PROVIDER,
    }


class DeleteRequest(BaseModel):
    wedding_id: str
    photo_id: str | None = None


@app.post('/delete')
def delete_faces(
    req: DeleteRequest,
    authorization: str | None = Header(default=None),
):
    auth_or_401(authorization)

    if supabase is None:
        raise HTTPException(
            status_code=500,
            detail='Worker Supabase credentials are missing.',
        )

    if FACE_PROVIDER == 'compreface':
        query = (
            supabase.table('face_embeddings')
            .select('provider_face_id')
            .eq('wedding_id', req.wedding_id)
        )
        if req.photo_id:
            query = query.eq('photo_id', req.photo_id)

        rows = query.execute().data or []
        ids = [row['provider_face_id'] for row in rows]
        compreface_delete_images(ids)

        return {
            'deleted': len(ids),
            'photo_id': req.photo_id,
            'wedding_id': req.wedding_id,
            'provider': FACE_PROVIDER,
        }

    # dlib and mock have no external index: deleting the Supabase
    # face_embeddings rows is sufficient and is handled by the photo/wedding
    # deletion cascade.
    return {
        'deleted': 0,
        'photo_id': req.photo_id,
        'wedding_id': req.wedding_id,
        'provider': FACE_PROVIDER,
    }
