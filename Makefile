# Comandos de la demo. Si "make" no está disponible, cada receta es un
# bash de 1-3 líneas: se puede copiar y pegar directo (ver README.md).

.PHONY: devops demo validar reset contar

# Página "Docker" (sin plataforma): build y compose a mano.
# Queda en http://localhost:8080
devops:
	docker compose -f proyecto-devops/docker-compose.yml up --build -d

# Página "Platform Engineering": valida guardrails, genera con score-compose
# y levanta. Queda en http://localhost:8081
demo: validar
	cd proyecto-platform && score-compose init --no-sample
	cd proyecto-platform && score-compose generate score.yaml --build 'web={"context":"..","dockerfile":"proyecto-devops/Dockerfile","tags":["lista-tareas:local"]}' --publish 8081:lista-tareas:8080
	cd proyecto-platform && docker compose up --build -d
	bash plataforma/resumen.sh

# Guardrails: se corren solos antes de "demo", o a mano contra cualquier yaml.
validar:
	bash plataforma/validar.sh proyecto-platform/score.yaml

# Apaga las dos páginas y borra lo que generó score-compose.
reset:
	-docker compose -f proyecto-devops/docker-compose.yml down -v
	-cd proyecto-platform && docker compose down -v
	rm -rf proyecto-platform/.score-compose proyecto-platform/compose.yaml

contar:
	bash scripts/contar.sh
