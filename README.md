# Platform Engineering como evolución de DevOps

La misma API de lista de tareas, desplegada de dos maneras, en una laptop, con Docker.

| | DevOps | Platform Engineering |
| --- | --- | --- |
| Qué escribe quien desarrolla | Dockerfile, manifiestos de Kubernetes, Secret, pipeline | Un `score.yaml` |
| Qué genera la herramienta | Nada: cada archivo se mantiene a mano | `score-compose` genera el `compose.yaml` y levanta PostgreSQL |
| Dónde corre esta demo | No hace falta un cluster. Los YAML se muestran y se validan | Docker, en local |

La aplicación es una sola y vive en `app/`. Los dos enfoques la reutilizan.

```text
app/                  API Node.js. La comparten los dos lados.
proyecto-devops/      Lo que mantiene el desarrollador en el enfoque tradicional.
proyecto-platform/    Solo score.yaml. Compose y el estado de Score se generan acá.
scripts/contar.sh     Cuenta archivos y líneas de cada lado.
```

## 1. Requisitos previos

Hace falta Docker en marcha, Node.js 22 (para los tests y para leer la app) y `score-compose` 0.50.0, que es la versión con la que se probaron los comandos de abajo (14 de noviembre de 2026).

### Docker

Instalación en Windows: [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/).

```bash
docker info
```

Tiene que responder con datos del servidor. Si dice que no encuentra el motor, abrí Docker Desktop y esperá a que arranque.

### Node.js

La imagen usa `node:22-alpine`. Instalación: [nodejs.org](https://nodejs.org/), rama 22.

```bash
node -v
npm -v
```

### score-compose

Instrucciones oficiales: [instalación de score-compose](https://docs.score.dev/docs/score-implementation/score-compose/installation/).

En macOS, con Homebrew:

```bash
brew install score-spec/tap/score-compose
```

Con Go, en cualquier sistema:

```bash
go install -v github.com/score-spec/score-compose/cmd/score-compose@latest
```

En Windows la documentación pide bajar el zip de la [página de releases](https://github.com/score-spec/score-compose/releases), descomprimirlo y dejar el ejecutable en el `PATH`. El zip de la 0.50.0 para Windows amd64 es este:

```bash
mkdir -p "$HOME/bin"
curl -L -o score-compose.zip https://github.com/score-spec/score-compose/releases/download/0.50.0/score-compose_0.50.0_windows_amd64.zip
unzip -o score-compose.zip -d "$HOME/bin"
export PATH="$HOME/bin:$PATH"
score-compose --version
```

Tiene que imprimir `score-compose 0.50.0`. En PowerShell, si `unzip` no existe, clic derecho sobre el zip y "Extraer todo", y agregá esa carpeta al `PATH`.

La misma documentación ofrece la imagen `scorespec/score-compose`. Para esta demo conviene el binario: `docker compose` y el build corren en el Docker del host.

## 2. Correr el lado Platform

Terminal en la raíz del repo. Git Bash o PowerShell. Estos comandos están tomados de la guía [Get started](https://docs.score.dev/docs/get-started/), de la [referencia del CLI](https://docs.score.dev/docs/score-implementation/score-compose/cli/) y del ejemplo [NodeJS and PostgreSQL](https://docs.score.dev/docs/examples/nodejs-postgres/).

```bash
cd proyecto-platform

score-compose init --no-sample

score-compose generate score.yaml --build 'web={"context":"..","dockerfile":"proyecto-devops/Dockerfile","tags":["lista-tareas:local"]}' --publish 8080:lista-tareas:8080

docker compose up --build -d
```

Qué hace cada uno:

1. `init --no-sample` crea `.score-compose/` con los provisioners por defecto y no pisa el `score.yaml` que ya está. Sin `init`, `generate` falla.
2. `generate` valida `score.yaml`, provisiona el recurso `postgres` y escribe `compose.yaml`.
3. `docker compose up --build -d` construye la imagen y levanta la API y PostgreSQL. La [guía de overrides](https://docs.score.dev/docs/how-to/overrides/) pide `--build` cuando la imagen se construye desde el código.

El `--build` usa la forma documentada `--build=contenedor={"context":"./dir"}`. El contenedor se llama `web`, como la clave en `score.yaml`. `tags` está en el ejemplo oficial de Node.js. `dockerfile` no aparece como ejemplo en la documentación de Score: en la 0.50.0 el JSON se copia al `build` de Compose, y esta demo lo usa para no duplicar `proyecto-devops/Dockerfile`. Si una versión futura lo rechazara, el camino documentado al pie de la letra es copiar ese Dockerfile a `app/Dockerfile` (ajustando los `COPY` a ese contexto) y correr:

```bash
score-compose generate score.yaml --build web=../app --publish 8080:lista-tareas:8080
```

`--publish 8080:lista-tareas:8080` sigue el ejemplo del CLI: `PUERTO_HOST:NOMBRE_DEL_WORKLOAD:PUERTO_DEL_CONTENEDOR`. El nombre es `metadata.name`. El proceso escucha en el 8080. Hay que incluirlo en el `generate` que corre justo antes del `up`: el propio proyecto de `score-compose` avisa que este flag no queda guardado en el estado. Sin él, Compose no publica puertos en el host.

La guía de inicio usa, en lugar de `--publish`, los recursos `dns` y `route`. Eso levanta un Nginx en el puerto 8080 y un host `*.localhost`. En Windows ese host muchas veces no resuelve fuera del navegador. `--publish` deja la URL en `http://localhost:8080`.

### Ver la URL

```bash
docker compose ps
curl http://localhost:8080
```

En el navegador: [http://localhost:8080](http://localhost:8080).

`docker compose ps` muestra el puerto `8080->8080` en el servicio `lista-tareas-web`. La primera vez el `up` descarga Node y PostgreSQL 17 y puede tardar varios minutos. En el ensayo conviene hacerlo una vez para que las imágenes queden en caché.

Para apagar y borrar los datos de la base:

```bash
docker compose down -v
```

## 3. Guion de unos 8 minutos

Zoom de VS Code grande. Terminal integrada abajo. El navegador, cerrado al empezar.

Contar antes de hablar, por si preguntan:

```bash
bash scripts/contar.sh
```

Salida esperada:

```text
DevOps (el desarrollador mantiene esto)
    25  proyecto-devops/Dockerfile
    75  proyecto-devops/k8s/deployment.yaml
    12  proyecto-devops/k8s/service.yaml
    23  proyecto-devops/k8s/ingress.yaml
    80  proyecto-devops/k8s/postgres.yaml
    13  proyecto-devops/k8s/secret.yaml
    65  proyecto-devops/.github/workflows/pipeline.yml
  ----
  7 archivos, 293 lineas

Platform (el desarrollador mantiene esto)
    19  proyecto-platform/score.yaml
  ----
  1 archivo, 19 lineas
```

El script no cuenta `app/` (es la misma de los dos lados), los README ni lo que genera Score.

### 0:00 a 0:45. La misma aplicación

Abrir `app/server.js`.

Decir: "La aplicación no cambia de un enfoque al otro. Es una API de tareas en Express. Lee cinco variables de entorno, crea la tabla si no existe y escucha en el 8080."

Señalar el arreglo `VARIABLES`, el `CREATE TABLE` y `PUERTO = 8080`. No leer el HTML.

### 0:45 a 3:20. Lado DevOps

Abrir el árbol de `proyecto-devops/`. Correr `bash scripts/contar.sh`.

Decir: "Para correr esta API en Kubernetes, el desarrollador mantiene 7 archivos y 293 líneas. Vamos a ver qué problema resuelve cada uno."

Abrir, en este orden, y no leerlos enteros:

1. `proyecto-devops/Dockerfile`. "Dos etapas, y al final el proceso no es root."
2. `proyecto-devops/k8s/deployment.yaml`. "Réplicas, tope de CPU y memoria, probes, y cada variable sale de un Secret."
3. `proyecto-devops/k8s/secret.yaml`. "La contraseña está en el repo de la demo, marcada como ejemplo. En un equipo real este archivo es un incidente."
4. `proyecto-devops/k8s/postgres.yaml`. "Además de la API hay que describir el disco, el Service y el proceso de la base."
5. `proyecto-devops/k8s/ingress.yaml`. "Host y TLS. El certificado ni siquiera está: lo pone el cluster."
6. `proyecto-devops/.github/workflows/pipeline.yml`. "Test, build y push. Y este archivo, para que GitHub lo ejecute, tiene que vivir en otra carpeta."

Cerrar con: "Nada de esto es la lista de tareas. Es el costo de operarla, puesto en el repositorio del equipo de producto."

### 3:20 a 6:20. Lado Platform

Abrir `proyecto-platform/score.yaml`.

Decir: "Del otro lado el desarrollador describe el workload. Un contenedor, el puerto 8080 y un recurso de tipo postgres. No escribe la contraseña: pide `${resources.db.username}` y los otros outputs. Score resuelve eso en el momento de generar."

Los outputs `host`, `port`, `name`, `username` y `password` son los del provisioner `postgres` de `score-compose`. `name` y `database` son la misma base. Acá se usa `name`, como en el ejemplo oficial de Node.js.

En la terminal, desde `proyecto-platform/`, correr los tres comandos de la sección 2. Mientras construye, abrir el `compose.yaml` que acaba de aparecer.

Decir: "Este archivo no está en git. Lo escribió `score-compose`. Ahí está PostgreSQL, el volumen, el usuario creado al iniciar y el build de nuestra imagen. El desarrollador no lo mantiene."

Cuando `docker compose ps` muestre el puerto 8080, abrir [http://localhost:8080](http://localhost:8080). Agregar "preparar la exposición". Borrarla.

Si queda un minuto, correr:

```bash
score-compose resources list
score-compose resources get-outputs postgres.default#lista-tareas.db --format '{{ .host }} {{ .name }}'
```

Decir: "El host y el nombre de la base los inventó el provisioner. El desarrollador no eligió esos valores." El `--format` es el de la documentación. No imprimas el JSON completo en el proyector: incluye la contraseña.

### 6:20 a 7:30. La complejidad no desapareció

Abrir `proyecto-platform/.score-compose/zz-default.provisioners.yaml` y buscar `type: postgres`.

Decir: "Estas 19 líneas funcionan porque alguien escribió el provisioner que convierte `type: postgres` en un contenedor, un volumen, un usuario y un script de creación. Ese alguien es el equipo de plataforma. El archivo se genera con `score-compose init` y no se commitea: es estado local. En una empresa, los golden paths viven en el repositorio de la plataforma, con dueño y revisión."

### 7:30 a 8:00. Cierre

"Misma API. Siete archivos y 293 líneas de un lado, un archivo y 19 del otro. Lo que el desarrollador deja de escribir no se evapora: pasa al equipo que mantiene el camino pavimentado. Score es la especificación del workload, no la plataforma."

## 4. Honestidad técnica

La demo achica lo que ve el desarrollador. No achica el sistema.

- La complejidad se traslada al equipo de plataforma. Ellos mantienen los golden paths: qué base se ofrece, con qué versión, qué backups, qué red, qué límites y cómo se inyectan las credenciales. En esta laptop eso está en los provisioners que instala `score-compose init`.
- Score es la especificación del workload. `score.yaml` dice qué necesita la aplicación. No dice cómo está hecho el cluster, ni el portal, ni la observabilidad, ni la política de seguridad.
- Score es una pieza de un Internal Developer Platform, no la plataforma completa. `score-compose` es la implementación de referencia para Docker Compose, pensada para desarrollo local. La otra implementación oficial es `score-k8s`, y esa sí emite manifiestos. Un IDP además tiene catálogo, entornos, permisos y un equipo que los opera.
- El `compose.yaml` generado no es un manifiesto para producción. Tiene contraseñas en texto plano porque `score-compose`, según la especificación, no modela secretos: es una referencia para la máquina local.
- Los YAML de `proyecto-devops/` son válidos y realistas, y tampoco son "todo DevOps". Falta el ingress controller, el emisor de certificados, el registro de imágenes y el cluster. Están para que se vea el contraste de lo que el desarrollador tendría que escribir.

## 5. Checklist de ensayo y plan B

La tarde anterior, con el mismo Docker que vas a usar en el aula:

- [ ] Docker Desktop abierto y `docker info` responde.
- [ ] `score-compose --version` imprime 0.50.0, o la versión que hayas vuelto a probar contra esta guía.
- [ ] `node -v` es 22 o más, y `npm test` dentro de `app/` pasa.
- [ ] El puerto 8080 está libre (`curl http://localhost:8080` no debería responder antes de levantar la demo).
- [ ] Corriste la sección 2 de punta a punta y agregaste una tarea en el navegador.
- [ ] Cronometraste el guion una vez, en voz alta, con el zoom de VS Code que vas a usar.
- [ ] Grabaste un video de ese ensayo.

Plan B: si en vivo Docker no arranca, `score-compose` no está en el `PATH` o el build falla, reproducís el video. No improvises manifiestos. El video tiene que mostrar el `score.yaml`, el `compose.yaml` generado, la página con una tarea agregada y el conteo de `scripts/contar.sh`.

Si solo falla el puerto porque algo ya usa el 8080, cambiá el primer número:

```bash
score-compose generate score.yaml --build 'web={"context":"..","dockerfile":"proyecto-devops/Dockerfile","tags":["lista-tareas:local"]}' --publish 8081:lista-tareas:8080
```

La página queda en [http://localhost:8081](http://localhost:8081). El proceso de adentro sigue en el 8080.

Para grabar en Windows alcanza la Game Bar (`Win + G`) o la grabación de OBS. Guardá el archivo en el pendrive, no solo en la laptop.

## Verificación hecha al armar el repo

En la máquina donde se armó la demo (Node v22.21.0, Docker 29.5.2, `score-compose` 0.50.0):

- `npm test` en `app/`: 2 tests, ok.
- `score-compose init --no-sample` y el `generate` de la sección 2. El CLI validó el workload. El `compose.yaml` generado apuntó a `proyecto-devops/Dockerfile` y publicó `8080->8080`.
- `docker compose up --build -d` construyó la imagen. PostgreSQL 17 quedó healthy. El contenedor de la API corrió con uid 10001 y recibió `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` desde el recurso `postgres`.
- Contra `http://localhost:8080`: `GET /` respondió 200, `POST /tareas` creó una tarea (201), un título vacío respondió 400, `DELETE` respondió 204 y `GET /salud` respondió `{"ok":true}`.
- En el navegador: estado vacío, alta de una tarea y borrado, de vuelta al estado vacío.
- `kubeconform -strict` sobre `proyecto-devops/k8s`: 7 recursos, todos válidos. PyYAML parseó además `score.yaml` y el workflow.
- `kubectl apply --dry-run=client` no llegó a validar: no hay un cluster configurado y el cliente intentó descargar el OpenAPI de `localhost:8080`.
- No se aplicaron los manifiestos en un cluster ni se ejecutó el workflow de GitHub.

Después de la prueba se bajó el stack con `docker compose down -v` y se borró `.score-compose/` y `compose.yaml`, porque ese estado tiene contraseñas de la base local. Se regeneran con la sección 2.
