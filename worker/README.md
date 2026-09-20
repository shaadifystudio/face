# Shaadify Face Worker

Python FastAPI worker for indexing wedding photos and searching a client's selfie.

## Development
Set FACE_PROVIDER=mock. This is only a plumbing test and is not facial recognition.

## Real Face ID
Set FACE_PROVIDER=aws and configure AWS Rekognition credentials through the worker host secret manager or an IAM role. Never commit AWS secrets or put them in the Next.js frontend.

Required worker variables:
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_PHOTOS_BUCKET=wedding-photos
AI_WORKER_SECRET=LONG_RANDOM_SECRET
AWS_REGION=ap-south-1
AWS_REKOGNITION_COLLECTION=shaadify-face-v1
FACE_PROVIDER=aws
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

Run:
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

Endpoints:
GET /health
POST /enqueue
POST /search

For production at large wedding volumes, replace FastAPI BackgroundTasks with a durable queue/worker system.