#!/usr/bin/env bash
# Resumen legible de lo que la plataforma acaba de levantar.
# Se corre al final de "make demo", una vez que docker compose ya está arriba.
set -euo pipefail
cd "$(dirname "$0")/../proyecto-platform"

echo ""
echo "=========================================="
echo "  Plataforma lista"
echo "=========================================="
docker compose ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'
echo ""
echo "  Servicio:    http://localhost:8081"

SALIDA=$(score-compose resources get-outputs postgres.default#lista-tareas.db --format '{{ .host }} {{ .name }}' 2>/dev/null || echo "? ?")
read -r DB_HOST DB_NAME <<< "$SALIDA"
echo "  Base:        $DB_NAME en $DB_HOST (provisionada por score-compose, nadie eligió esos nombres)"
echo "=========================================="
echo ""
