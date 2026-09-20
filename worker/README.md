# Shaadify Face Worker

Python FastAPI worker for indexing wedding photos and searching a client's selfie.

## Default free MVP provider: dlib

The free MVP uses the face_recognition Python library backed by dlib.

The dlib library is Boost-licensed and the dlib recognition model is released into the public domain by its creator. See the upstream model repository before commercial launch for provenance and any applicable obligations.

Set:

FACE_PROVIDER=dlib
DLIB_MAX_DISTANCE=0.6
DLIB_MAX_IMAGE_SIDE=2400

SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PHOTOS_BUCKET=wedding-photos
AI_WORKER_SECRET=...

The worker detects faces with dlib's CPU HOG detector and stores 128-dimensional face encodings in the server-only face_embeddings table. Client selfies are processed in memory and are not persisted by Shaadify.

## Important MVP limitation

The current dlib implementation performs a wedding-scoped linear scan over stored face embeddings. This is intentionally simple for the first free deployment and is suitable for testing/small galleries. Before large commercial weddings, move embeddings to a proper vector index (for example pgvector) and benchmark thresholds on representative wedding imagery.

## Cloud Run

The container is designed for Google Cloud Run:

- Port: 8080 (Cloud Run supplies PORT)
- CPU: 2
- Memory: 4 GiB
- Minimum instances: 0
- Maximum instances: 1 for the first free-tier test
- Region: asia-south1 (Mumbai)

Keep the worker protected with AI_WORKER_SECRET. Do not put SUPABASE_SERVICE_ROLE_KEY or AI_WORKER_SECRET in the frontend.

## Endpoints

GET  /health
POST /enqueue
POST /search
POST /search-image
POST /delete

- /enqueue indexes uploaded wedding photos in a background task.
- /search searches from a signed selfie URL.
- /search-image searches directly from selfie bytes.
- /delete is a no-op for dlib because its face index is the Supabase face_embeddings rows; photo/wedding deletion removes those rows through the database relationships.

## Legacy providers

The worker still contains the previous aws, compreface, and mock providers behind the same interface. They are not the default.

## Privacy

- Original wedding photos remain in the private Supabase Storage bucket.
- Face embeddings are server-side only.
- Client selfies are processed in memory and are not intentionally stored.
- Deleting a photo or wedding removes the associated database face records through the existing foreign-key cascades.