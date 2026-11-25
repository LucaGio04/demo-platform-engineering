#!/usr/bin/env bash
# Compara lo que escribe el desarrollador en cada enfoque.
# No cuenta la app (es la misma de los dos lados), los README
# ni lo que genera Score (compose.yaml y .score-compose/).
set -euo pipefail

cd "$(dirname "$0")/.."

contar() {
  local nombre="$1"
  shift
  local archivos=0
  local lineas=0
  local archivo lineas_archivo

  echo "$nombre"
  for archivo in "$@"; do
    lineas_archivo=$(wc -l < "$archivo" | tr -d '[:space:]')
    archivos=$((archivos + 1))
    lineas=$((lineas + lineas_archivo))
    printf "  %4s  %s\n" "$lineas_archivo" "$archivo"
  done
  echo "  ----"
  if [[ "$archivos" -eq 1 ]]; then
    echo "  1 archivo, ${lineas} lineas"
  else
    echo "  ${archivos} archivos, ${lineas} lineas"
  fi
  echo
}

contar "DevOps (el desarrollador mantiene esto)" \
  proyecto-devops/Dockerfile \
  proyecto-devops/k8s/deployment.yaml \
  proyecto-devops/k8s/service.yaml \
  proyecto-devops/k8s/ingress.yaml \
  proyecto-devops/k8s/postgres.yaml \
  proyecto-devops/k8s/secret.yaml \
  proyecto-devops/.github/workflows/pipeline.yml

contar "Platform (el desarrollador mantiene esto)" \
  proyecto-platform/score.yaml
