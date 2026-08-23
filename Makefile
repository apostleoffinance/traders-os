.PHONY: up down logs migrate backend frontend test seed install

up:
	docker compose up -d postgres

down:
	docker compose down

logs:
	docker compose logs -f postgres

install:
	python3 -m venv backend/.venv
	. backend/.venv/bin/activate && pip install -r backend/requirements.txt
	cd frontend && npm install

migrate:
	cd backend && . .venv/bin/activate && alembic upgrade head

backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && . .venv/bin/activate && pytest -q

seed:
	cd backend && . .venv/bin/activate && python -m app.seed
