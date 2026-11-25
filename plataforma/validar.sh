#!/usr/bin/env bash
# Guardrails del golden path: lo que el equipo de plataforma exige antes de
# generar infraestructura a partir de un workload.yaml (score.yaml).
#
# 1. Todo workload necesita un responsable (owner).
# 2. La base de datos solo puede pedirse en tamaños conocidos y soportados.
# 3. Las credenciales nunca se hardcodean: tienen que venir del provisioner.
#
# score-compose valida la sintaxis de Score. Esto valida las reglas propias
# de esta empresa, que Score no conoce.
set -euo pipefail

ARCHIVO="${1:-proyecto-platform/score.yaml}"
TAMANIOS_VALIDOS=("postgres-small" "postgres-medium")

fallar() {
  echo "✗ Guardrail incumplido: $1" >&2
  exit 1
}

[[ -f "$ARCHIVO" ]] || fallar "no se encontró $ARCHIVO"

echo "Validando guardrails de $ARCHIVO"

# 1. owner obligatorio en metadata.
LINEA_OWNER=$(grep -E '^\s*owner:\s*\S+' "$ARCHIVO" || true)
[[ -n "$LINEA_OWNER" ]] || fallar "falta 'owner' en metadata. Todo workload necesita un equipo responsable."
OWNER=$(echo "$LINEA_OWNER" | head -1 | sed -E 's/^\s*owner:\s*//')
echo "  ok owner: $OWNER"

# 2. Tamaño de base de datos dentro de lo que la plataforma ofrece.
LINEA_SIZE=$(grep -E '^\s*size:\s*\S+' "$ARCHIVO" || true)
[[ -n "$LINEA_SIZE" ]] || fallar "falta 'size' en resources.db.params. Usar uno de: ${TAMANIOS_VALIDOS[*]}"
TAMANIO=$(echo "$LINEA_SIZE" | head -1 | sed -E 's/^\s*size:\s*//')
VALIDO=0
for t in "${TAMANIOS_VALIDOS[@]}"; do
  [[ "$TAMANIO" == "$t" ]] && VALIDO=1
done
[[ "$VALIDO" -eq 1 ]] || fallar "tamaño de base '$TAMANIO' no soportado. Usar uno de: ${TAMANIOS_VALIDOS[*]}"
echo "  ok tamaño de base: $TAMANIO"

# 3. La contraseña nunca viene hardcodeada: tiene que resolverla el provisioner.
LINEA_PASSWORD=$(grep -E 'DB_PASSWORD:' "$ARCHIVO" || true)
[[ -n "$LINEA_PASSWORD" ]] || fallar "no se encontró DB_PASSWORD en el workload."
[[ "$LINEA_PASSWORD" == *'${resources.db.password}'* ]] || fallar "DB_PASSWORD no puede ser un valor fijo. Tiene que ser \${resources.db.password}."
echo "  ok password: la genera el provisioner, no está en el archivo"

echo "Guardrails OK."
