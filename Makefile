.PHONY: dev build start migrate test smoke up down logs clean

# Development with hot reload
dev:
	npm run dev

# Build TypeScript
build:
	npm run build

# Start production build
start:
	npm run start

# Run database migrations
migrate:
	npm run migrate

# Run tests
test:
	npm run test

# Run smoke tests
smoke:
	npm run smoke

# Start all services with docker-compose
up:
	docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5
	@docker-compose exec statemirror node dist/db/migrate.js || true
	@echo "StateMirror is running at http://localhost:8080"

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f statemirror

# Clean up
clean:
	docker-compose down -v
	rm -rf dist node_modules

# Local development setup (requires local postgres)
local-setup:
	npm install
	npm run migrate
	npm run dev
