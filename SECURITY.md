# Security

- Never commit `.env`, API keys, production secrets, or user photos.
- Keep Ollama behind the backend; do not expose port 11434 publicly.
- Use HTTPS in production.
- Restrict `ALLOWED_HOSTS` and CORS origins.
- Replace SQLite with PostgreSQL for multi-user production.
- Put user-uploaded photos in private object storage and serve through signed URLs when possible.
- Add rate limiting and abuse controls before opening AI endpoints to the public.
