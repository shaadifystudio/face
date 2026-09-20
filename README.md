# Shaadify Face

AI-powered wedding photo discovery for photographers and their clients.

Flow:
Create Wedding → signed upload URLs → browser uploads directly to private Supabase Storage → worker indexes faces → client selfie search → signed result URLs.

Vercel environment variables:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PHOTOS_BUCKET=wedding-photos
AI_WORKER_URL
AI_WORKER_SECRET

Worker variables:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PHOTOS_BUCKET=wedding-photos
AI_WORKER_SECRET
FACE_PROVIDER=aws
AWS_REGION
AWS_REKOGNITION_COLLECTION
AWS credentials or IAM role

Never expose the Supabase service-role key or AWS credentials to the browser. Keep wedding photos private and use short-lived signed URLs.

The included FastAPI worker is suitable for the first end-to-end test. At high wedding volumes, move indexing to a durable queue such as SQS/Celery/Cloud Tasks.

Face recognition is biometric processing: provide client disclosure/consent, deletion controls and an appropriate retention policy before production use.