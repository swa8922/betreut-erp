# VBetreut ERP – Docker Befehle
# Verwendung: make <befehl>

.PHONY: dev build start stop restart logs shell clean

## Lokale Entwicklung (ohne Docker)
dev:
	npm run dev

## Docker Image bauen
build:
	docker compose build

## Container starten (im Hintergrund)
start:
	docker compose up -d
	@echo ""
	@echo "✅ VBetreut ERP läuft auf http://localhost:3000"

## Container starten mit Logs
up:
	docker compose up

## Container stoppen
stop:
	docker compose down

## Container neu starten
restart:
	docker compose restart app

## Logs anzeigen
logs:
	docker compose logs -f app

## Shell im Container öffnen
shell:
	docker exec -it vbetreut-erp sh

## Alles aufräumen (Container + Images)
clean:
	docker compose down --rmi all --volumes --remove-orphans

## Status anzeigen
status:
	docker compose ps
