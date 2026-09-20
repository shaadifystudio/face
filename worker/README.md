# Shaadify Face Worker

Python FastAPI worker for indexing wedding photos and searching a client's selfie.

## Production provider: CompreFace

Shaadify can use a self-hosted CompreFace server instead of a per-request cloud face API. CompreFace exposes REST endpoints for adding known images and recognizing faces; the worker maps each photo to a wedding-scoped subject (`wedding_id:photo_id`).

Set these worker variables:

```
FACE_PROVIDER=compreface
COMPRE_FACE_URL=https://face.yourdomain.com
COMPRE_FACE_API_KEY=YOUR_FACE_RECOGNITION_SERVICE_KEY
COMPRE_FACE_MIN_SIMILARITY=0.75
COMPRE_FACE_PREDICTION_COUNT=1000

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PHOTOS_BUCKET=wedding-photos
AI_WORKER_SECRET=...
```

CompreFace accepts image uploads up to 5 MB, so the worker automatically normalizes larger wedding images/selfies before sending them to the face service.

### Install CompreFace

CompreFace is distributed as Docker Compose and supports CPU deployments on x86 machines with AVX support.

Use the official CompreFace release/docker-compose package, create a Face Recognition Service, and copy its API key into `COMPRE_FACE_API_KEY`. The setup flow is: start CompreFace → create an application → create a Face Recognition Service → use its API key with the REST API.

For privacy, review the CompreFace `save_images_to_db` setting. It controls whether uploaded images are saved by CompreFace; Shaadify already keeps the original wedding files in Supabase Storage.

## How Shaadify maps photos

Each wedding photo is stored as a CompreFace subject:

```
<wedding_id>:<photo_id>
```

This means recognition results can be filtered to the current wedding even though one CompreFace service is shared across weddings. CompreFace also supports using a photo containing multiple people as a subject and then finding photos containing the searched person.

The worker stores the returned CompreFace `image_id` in `face_embeddings.provider_face_id`.

## Endpoints

```
GET  /health
POST /enqueue
POST /search
POST /search-image
POST /delete
```

- `/enqueue` indexes uploaded wedding photos in the background.
- `/search` searches from a signed selfie URL.
- `/search-image` searches directly from selfie bytes.
- `/delete` removes the CompreFace face records for one photo or an entire wedding.

## Development

For plumbing-only testing, `FACE_PROVIDER=mock` is still available. It is **not** facial recognition.

## Legacy AWS provider

The worker retains the previous `FACE_PROVIDER=aws` implementation, but production Shaadify should use `compreface` for the self-hosted deployment described above.

## Production scaling

The current FastAPI `BackgroundTasks` path is suitable for the MVP. At larger wedding volumes, replace it with a durable queue/worker system so thousands of photos can be processed reliably across restarts.
