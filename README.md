# MyFiTDay — Full-Stack Fitness Product Foundation

MyFiTDay is a mobile-first fitness tracking product built to start as a personal/friends app and grow into a multi-user product.

## Stack

- Frontend: React 19 + Vite
- Backend: Django 5.2 + Django REST Framework
- Database: SQLite for development; PostgreSQL-ready for production
- AI: Ollama + Gemma 3 (open-weight/local inference)
- Exercise data: Wger API
- Photos: Django media storage in development; object storage recommended for production

Django REST Framework is used as the API layer for authentication, serializers, viewsets, permissions and API documentation. citeturn0search0turn0search3

Ollama exposes a local API at `http://localhost:11434/api`; its chat endpoint supports model selection and structured JSON output, which MyFiTDay uses for coaching responses. citeturn1search1turn1search0turn1search15

## Run locally

### Terminal 1 — backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### Terminal 2 — frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

### Terminal 3 — AI

Install Ollama, then:

```bash
ollama pull gemma3
ollama serve
```

Ollama's official documentation shows `gemma3` examples for `/api/chat`, and Gemma 3 supports vision as well, which leaves a path for future image-based features. citeturn1search0turn1search7

## Product architecture

```text
React / PWA
    |
    | HTTPS JSON + multipart
    v
Django REST API
    |
    +---- PostgreSQL
    +---- Object Storage
    +---- Wger API
    +---- Ollama / open model
```

## Safety and reliability

- Calories are deterministic planning estimates, not medical measurements.
- AI is advisory and must not diagnose or prescribe treatment.
- Ollama is never called directly from React; the backend owns model access.
- Local development uses SQLite and local media; production should use PostgreSQL and object storage.
- Keep secrets in environment variables.

## GitHub / deployment

The repository is intentionally split into `frontend/` and `backend/` so each can be deployed independently later. For the first public release, deploy the frontend as a static React app and the Django API to a server capable of running Python. Set `VITE_API_BASE_URL` to the public API URL.

## Next product milestones

1. Exercise CRUD endpoint + drag/drop ordering.
2. Full workout editor from React.
3. Daily session timer and automatic duration tracking.
4. Weekly/monthly ZIP photo export endpoint.
5. PostgreSQL production configuration.
6. S3-compatible object storage.
7. Email/social login and password reset.
8. AI structured recommendations with evaluation tests.
9. Rate limiting, audit logging, monitoring and backups.
10. PWA install/offline support and eventual native app wrapper.
