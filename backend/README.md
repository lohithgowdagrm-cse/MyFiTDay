# MyFiTDay Backend

Django REST API for accounts, workouts, workout sessions, goals, progress photos, deterministic calorie estimates, Wger exercise lookup, and Ollama-powered coaching.

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

API docs: http://127.0.0.1:8000/api/docs/

## Open-source AI

Install Ollama from https://ollama.com/ and pull the model:

```bash
ollama pull gemma3
```

Start Ollama if needed:

```bash
ollama serve
```

The backend calls `POST /api/chat` on the local Ollama server. If Ollama is unavailable, MyFiTDay uses a deterministic fallback recommendation so the app remains usable.

## Production

Use PostgreSQL, object storage for media, HTTPS, a production secret key, restricted CORS/hosts, and a hosted GPU/inference service or self-hosted Ollama server. Do not expose a local Ollama endpoint directly to the public internet.
