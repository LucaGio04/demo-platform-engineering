# Platform Engineering como evolución de DevOps

La misma API de lista de tareas, desplegada de dos maneras, en una laptop, con Docker.

| | DevOps | Platform Engineering |
| --- | --- | --- |
| Qué escribe quien desarrolla | Dockerfile, manifiestos de Kubernetes, Secret, pipeline | Un `score.yaml` |
| Qué genera la herramienta | Nada: cada archivo se mantiene a mano | `score-compose` genera el `compose.yaml` y levanta PostgreSQL |
| Quién frena un workload mal armado | Nadie, hasta que falla en producción | Los guardrails de `plataforma/validar.sh`, antes de generar nada |
| Dónde corre esta demo | No hace falta un cluster. Los YAML se muestran y se validan | Docker, en local |

La aplicación es una sola y vive en `app/`. Los dos enfoques la reutilizan.

```text
app/                       API Node.js. La comparten los dos lados.
proyecto-devops/           Lo que mantiene el desarrollador en el enfoque tradicional.
  docker-compose.yml       Para levantar esa página sin Kubernetes. No cuenta en la comparación.
proyecto-platform/         Solo score.yaml. Compose y el estado de Score se generan acá.
  ejemplos-invalidos/      Dos workloads que los guardrails tienen que rechazar.
plataforma/                Guardrails y resumen: lo que hace de score-compose "una plataforma".
  validar.sh               Guardrails propios de la empresa, que Score no conoce.
  resumen.sh                Resumen legible al final de `make demo`.
scripts/contar.sh          Cuenta archivos y líneas de cada lado.
Makefile                   make devops / make demo / make reset / make contar.
```

Las dos páginas corren en puertos distintos para poder compararlas en vivo: `proyecto-devops/` (manual, con Docker) en el **8080** y `proyecto-platform/` (con Score) en el **8081**. La página que se ve en el navegador es a propósito idéntica en los dos puertos (ver sección 2): lo que cambia es todo lo que no se ve.

## 1. Requisitos previos

Hace falta Docker en marcha, Node.js 22 (para los tests y para leer la app) y `score-compose` 0.50.0, que es la versión con la que se probaron los comandos de abajo (14 de noviembre de 2026). `make` es opcional: todo lo que hace el `Makefile` está también como comandos de `bash` sueltos más abajo, así que si no lo tenés no hace falta instalarlo.

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

## 2. Paso a paso para levantar las dos páginas

Terminal en la raíz del repo. Git Bash o PowerShell. Las dos páginas son independientes: se puede levantar solo una, o las dos a la vez porque usan puertos distintos (8080 y 8081).

La página que sirve `GET /` es, a propósito, **la misma exacta en los dos puertos**: el mismo formulario de "Lista de Tareas" arriba, y abajo, como pie de página, la materia, el grupo y los integrantes. El servidor no abre el puerto hasta que logra conectarse a Postgres (ver `app/server.js`), así que la lista funcionando es en sí misma la prueba de que la base de datos de cada lado quedó arriba — no hace falta `curl` para demostrarlo, aunque sigue disponible (`/tareas`, `/salud`) por si lo prefieren para una prueba más rápida en terminal.

### 2.1 Página "Docker" (`proyecto-devops/`), sin plataforma

Esta es la que el equipo levantaría a mano, sin Kubernetes real (no hay cluster en la demo), usando el mismo Dockerfile que ya está documentado arriba. Compose, red, variables y contraseña están escritos a mano en `proyecto-devops/docker-compose.yml`.

```bash
docker compose -f proyecto-devops/docker-compose.yml up --build -d
```

Queda en [http://localhost:8080](http://localhost:8080). Para apagarla y borrar los datos:

```bash
docker compose -f proyecto-devops/docker-compose.yml down -v
```

Con `make` (hace lo mismo):

```bash
make devops
```

### 2.2 Página "Platform Engineering" (`proyecto-platform/`), con Score

Antes de generar nada, corren los guardrails (ver sección 3). Si pasan, se repiten los tres comandos de `score-compose` y se levanta con Compose. Estos comandos están tomados de la guía [Get started](https://docs.score.dev/docs/get-started/), de la [referencia del CLI](https://docs.score.dev/docs/score-implementation/score-compose/cli/) y del ejemplo [NodeJS and PostgreSQL](https://docs.score.dev/docs/examples/nodejs-postgres/).

```bash
bash plataforma/validar.sh proyecto-platform/score.yaml

cd proyecto-platform
score-compose init --no-sample
score-compose generate score.yaml --build 'web={"context":"..","dockerfile":"proyecto-devops/Dockerfile","tags":["lista-tareas:local"]}' --publish 8081:lista-tareas:8080
docker compose up --build -d
cd ..

bash plataforma/resumen.sh
```

Qué hace cada uno:

1. `validar.sh` corre los guardrails propios de esta empresa (sección 3). Si algo falta, corta ahí y no se genera nada.
2. `init --no-sample` crea `.score-compose/` con los provisioners por defecto y no pisa el `score.yaml` que ya está. Sin `init`, `generate` falla.
3. `generate` valida `score.yaml` contra la especificación de Score, provisiona el recurso `postgres` y escribe `compose.yaml`.
4. `docker compose up --build -d` construye la imagen y levanta la API y PostgreSQL. La [guía de overrides](https://docs.score.dev/docs/how-to/overrides/) pide `--build` cuando la imagen se construye desde el código.
5. `resumen.sh` imprime el estado de los contenedores, la URL y de dónde salió la base, para no tener que leer la salida cruda de `docker compose ps`.

El `--build` usa la forma documentada `--build=contenedor={"context":"./dir"}`. El contenedor se llama `web`, como la clave en `score.yaml`. `tags` está en el ejemplo oficial de Node.js. `dockerfile` no aparece como ejemplo en la documentación de Score: en la 0.50.0 el JSON se copia al `build` de Compose, y esta demo lo usa para no duplicar `proyecto-devops/Dockerfile`. Si una versión futura lo rechazara, el camino documentado al pie de la letra es copiar ese Dockerfile a `app/Dockerfile` (ajustando los `COPY` a ese contexto) y correr:

```bash
score-compose generate score.yaml --build web=../app --publish 8081:lista-tareas:8080
```

`--publish 8081:lista-tareas:8080` sigue el ejemplo del CLI: `PUERTO_HOST:NOMBRE_DEL_WORKLOAD:PUERTO_DEL_CONTENEDOR`. El nombre es `metadata.name`. El proceso escucha en el 8080 adentro del contenedor; `8081` es el puerto del host donde queda publicado. Hay que incluirlo en el `generate` que corre justo antes del `up`: el propio proyecto de `score-compose` avisa que este flag no queda guardado en el estado. Sin él, Compose no publica puertos en el host.

La guía de inicio usa, en lugar de `--publish`, los recursos `dns` y `route`. Eso levanta un Nginx y un host `*.localhost`. En Windows ese host muchas veces no resuelve fuera del navegador. `--publish` deja la URL en `http://localhost:8081`.

Queda en [http://localhost:8081](http://localhost:8081). La primera vez el `up` descarga Node y PostgreSQL 17 y puede tardar varios minutos; en el ensayo conviene hacerlo una vez para que las imágenes queden en caché. Para apagarla y borrar los datos de la base:

```bash
cd proyecto-platform && docker compose down -v
```

Con `make` (corre el guardrail, los tres comandos y el resumen):

```bash
make demo
```

### 2.3 Las dos a la vez, y apagar todo

```bash
make devops
make demo
# ... mostrar las dos páginas ...
make reset
```

Sin `make`, `reset` es:

```bash
docker compose -f proyecto-devops/docker-compose.yml down -v
cd proyecto-platform && docker compose down -v && cd ..
rm -rf proyecto-platform/.score-compose proyecto-platform/compose.yaml
```

## 3. Guardrails

`plataforma/validar.sh` corre antes de `score-compose generate` (a mano o con `make demo`) y aplica las reglas propias de esta empresa que Score no conoce:

1. **`owner` obligatorio.** Todo workload necesita un equipo responsable.
2. **Tamaño de base conocido.** Solo `postgres-small` o `postgres-medium`, los que la plataforma sabe operar. Se pide en `resources.db.params.size`.
3. **Nunca una contraseña fija.** `DB_PASSWORD` tiene que ser `${resources.db.password}`, nunca un valor literal.

`score-compose` valida la sintaxis de Score; esto valida la política de la plataforma, que es una capa aparte. Para mostrarlo rechazando algo:

```bash
bash plataforma/validar.sh proyecto-platform/ejemplos-invalidos/falta-owner.yaml
bash plataforma/validar.sh proyecto-platform/ejemplos-invalidos/tamanio-no-permitido.yaml
```

Los dos cortan con un mensaje claro y código de salida distinto de cero, sin tocar Docker. `params.size` es una convención de esta demo: el provisioner `postgres` de `score-compose` no la lee (siempre crea el mismo contenedor), así que ese dato por ahora es el guardrail, no una instrucción al provisioner. Se aclara otra vez en la sección 5.

## 4. Guion de unos 8 minutos

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
    22  proyecto-platform/score.yaml
  ----
  1 archivo, 22 lineas
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

### 3:20 a 4:00. Un guardrail rechazando un workload

Decir: "Antes de generar nada, la plataforma valida su propia política, no solo la sintaxis de Score."

```bash
bash plataforma/validar.sh proyecto-platform/ejemplos-invalidos/falta-owner.yaml
```

Señalar el mensaje de error y el corte sin tocar Docker. "Sin `owner` no hay a quién reclamarle este servicio a las tres de la mañana."

### 4:00 a 6:00. Lado Platform

Abrir `proyecto-platform/score.yaml`.

Decir: "Del otro lado el desarrollador describe el workload. Un contenedor, el puerto 8080 y un recurso de tipo postgres, con un tamaño conocido. No escribe la contraseña: pide `${resources.db.username}` y los otros outputs. Score resuelve eso en el momento de generar."

Los outputs `host`, `port`, `name`, `username` y `password` son los del provisioner `postgres` de `score-compose`. `name` y `database` son la misma base. Acá se usa `name`, como en el ejemplo oficial de Node.js.

En la terminal, desde la raíz del repo, correr `bash plataforma/validar.sh proyecto-platform/score.yaml` (pasa) y después los comandos de la sección 2.2. Mientras construye, abrir el `compose.yaml` que acaba de aparecer.

Decir: "Este archivo no está en git. Lo escribió `score-compose`. Ahí está PostgreSQL, el volumen, el usuario creado al iniciar y el build de nuestra imagen. El desarrollador no lo mantiene."

Cuando termine, va a aparecer el resumen de `plataforma/resumen.sh`.

### 6:00 a 6:30. Agregar una tarea en el navegador

Abrir [http://localhost:8081](http://localhost:8081). Escribir "preparar la exposición" y Agregar. Borrarla.

Decir: "El servidor no abre este puerto hasta que logra hablar con Postgres — si están viendo la página, ya hablaron. Y acá se ve: la tarea se guarda de verdad, en una base que nadie de nosotros configuró a mano."

### 6:30 a 6:50. Las dos páginas, lado a lado

Abrir otra pestaña con [http://localhost:8080](http://localhost:8080), al lado de la de 8081.

Decir: "Miren: es la misma página, pixel por pixel, mismo formulario, misma lista. No cambié ni una línea de la aplicación. Cada una tiene su propia base de datos atrás, pero lo único que cambió de verdad es todo lo que no se ve: cómo se construyó la imagen, cómo se conectó a esa base, cuánto código tuvo que escribir alguien para que esto llegue a funcionar."

### 6:50 a 7:40. La complejidad no desapareció

Abrir `proyecto-platform/.score-compose/zz-default.provisioners.yaml` y buscar `type: postgres`.

Decir: "Estas 22 líneas funcionan porque alguien escribió el provisioner que convierte `type: postgres` en un contenedor, un volumen, un usuario y un script de creación, y alguien de nuestro propio equipo escribió el guardrail que exige `owner` y un tamaño conocido. Eso lo mantiene el equipo de plataforma. El provisioner se genera con `score-compose init` y no se commitea: es estado local. En una empresa, los golden paths y sus guardrails viven en el repositorio de la plataforma, con dueño y revisión."

### 7:40 a 8:00. Cierre

"Misma API, misma página. Siete archivos y 293 líneas de un lado, un archivo y 22 del otro. Lo que el desarrollador deja de escribir no se evapora: pasa al equipo que mantiene el camino pavimentado, y esa complejidad ahora además se valida sola antes de llegar a Docker. Score es la especificación del workload, no la plataforma; los guardrails son la política que esta empresa le agrega encima."

## 5. Honestidad técnica

La demo achica lo que ve el desarrollador. No achica el sistema.

- La complejidad se traslada al equipo de plataforma. Ellos mantienen los golden paths: qué base se ofrece, con qué versión, qué backups, qué red, qué límites y cómo se inyectan las credenciales. En esta laptop eso está en los provisioners que instala `score-compose init`.
- Score es la especificación del workload. `score.yaml` dice qué necesita la aplicación. No dice cómo está hecho el cluster, ni el portal, ni la observabilidad, ni la política de seguridad.
- Score es una pieza de un Internal Developer Platform, no la plataforma completa. `score-compose` es la implementación de referencia para Docker Compose, pensada para desarrollo local. La otra implementación oficial es `score-k8s`, y esa sí emite manifiestos. Un IDP además tiene catálogo, entornos, permisos y un equipo que los opera.
- El `compose.yaml` generado no es un manifiesto para producción. Tiene contraseñas en texto plano porque `score-compose`, según la especificación, no modela secretos: es una referencia para la máquina local.
- Los YAML de `proyecto-devops/` son válidos y realistas, y tampoco son "todo DevOps". Falta el ingress controller, el emisor de certificados, el registro de imágenes y el cluster. Están para que se vea el contraste de lo que el desarrollador tendría que escribir.
- Los guardrails de `plataforma/validar.sh` son una demostración de la idea, no una implementación de producción. Son `grep` sobre el YAML, no un esquema versionado con validación semántica (JSON Schema, OPA/Conftest, un admission webhook). `resources.db.params.size` tampoco lo consume el provisioner `postgres` de `score-compose`: es un campo que esta demo agrega para que el guardrail tenga algo concreto que revisar, pero no cambia el tamaño real del contenedor que se levanta. En una plataforma real, esa política y esos provisioners conviven en el mismo repo del equipo de plataforma, con CI propio.

## 6. Checklist de ensayo y plan B

La tarde anterior, con el mismo Docker que vas a usar en el aula:

- [ ] Docker Desktop abierto y `docker info` responde.
- [ ] `score-compose --version` imprime 0.50.0, o la versión que hayas vuelto a probar contra esta guía.
- [ ] `node -v` es 22 o más, y `npm test` dentro de `app/` pasa.
- [ ] Los puertos 8080 y 8081 están libres (`curl` a ninguno de los dos debería responder antes de levantar la demo).
- [ ] Los dos guardrails inválidos de la sección 3 cortan con error, y `score.yaml` pasa.
- [ ] Corriste la sección 2 de punta a punta (las dos páginas) y confirmaste que se ven idénticas una al lado de la otra, y que `curl -X POST .../tareas` responde en las dos.
- [ ] Cronometraste el guion una vez, en voz alta, con el zoom de VS Code que vas a usar.
- [ ] Grabaste un video de ese ensayo.

Plan B: si en vivo Docker no arranca, `score-compose` no está en el `PATH` o el build falla, reproducís el video. No improvises manifiestos. El video tiene que mostrar el `score.yaml`, el `compose.yaml` generado, las dos páginas lado a lado y el conteo de `scripts/contar.sh`.

Si solo falla el puerto porque algo ya usa el 8081, cambiá el número en el `--publish` y en el `curl`:

```bash
score-compose generate score.yaml --build 'web={"context":"..","dockerfile":"proyecto-devops/Dockerfile","tags":["lista-tareas:local"]}' --publish 8082:lista-tareas:8080
```

La página queda en [http://localhost:8082](http://localhost:8082). El proceso de adentro sigue en el 8080.

Para grabar en Windows alcanza la Game Bar (`Win + G`) o la grabación de OBS. Guardá el archivo en el pendrive, no solo en la laptop.

## Verificación hecha al armar el repo

En la máquina donde se armó la demo (Node v22.21.0, Docker 29.5.2, `score-compose` 0.50.0):

- `npm test` en `app/`: 2 tests, ok.
- `score-compose init --no-sample` y el `generate` de la sección 2.2. El CLI validó el workload. El `compose.yaml` generado apuntó a `proyecto-devops/Dockerfile` y publicó `8080->8080`.
- `docker compose up --build -d` construyó la imagen. PostgreSQL 17 quedó healthy. El contenedor de la API corrió con uid 10001 y recibió `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` desde el recurso `postgres`.
- Contra `http://localhost:8080`: `GET /` respondió 200, `POST /tareas` creó una tarea (201), un título vacío respondió 400, `DELETE` respondió 204 y `GET /salud` respondió `{"ok":true}`.
- En el navegador: estado vacío, alta de una tarea y borrado, de vuelta al estado vacío.
- `kubeconform -strict` sobre `proyecto-devops/k8s`: 7 recursos, todos válidos. PyYAML parseó además `score.yaml` y el workflow.
- `kubectl apply --dry-run=client` no llegó a validar: no hay un cluster configurado y el cliente intentó descargar el OpenAPI de `localhost:8080`.
- No se aplicaron los manifiestos en un cluster ni se ejecutó el workflow de GitHub.

Después de la prueba se bajó el stack con `docker compose down -v` y se borró `.score-compose/` y `compose.yaml`, porque ese estado tiene contraseñas de la base local. Se regeneran con la sección 2.2.

### Verificación de los guardrails, el Makefile y `docker-compose.yml` (agregados después)

En la máquina donde se agregó esto, Docker Desktop no estaba corriendo durante la prueba, así que esto es lo que sí se verificó y lo que falta verificar antes de la exposición:

- `bash plataforma/validar.sh proyecto-platform/score.yaml`: pasa los tres guardrails (`owner`, tamaño de base, password no hardcodeada).
- `bash plataforma/validar.sh proyecto-platform/ejemplos-invalidos/falta-owner.yaml` y `.../tamanio-no-permitido.yaml`: los dos cortan con el mensaje esperado y código de salida distinto de cero.
- `bash scripts/contar.sh`: imprime 293 líneas del lado DevOps y 22 del lado Platform (subió de 19 a 22 al agregar `owner` y `params.size`).
- `npm test` en `app/`: 2 tests, ok (se corrió de nuevo al agregar esto).
- Se instaló `score-compose` 0.50.0 en esta máquina (antes no estaba) y respondió `--version` correctamente.
- **Las dos páginas, de punta a punta, con Docker Desktop ya abierto:**
  - `docker compose -f proyecto-devops/docker-compose.yml up --build -d`: construyó la imagen, PostgreSQL quedó healthy. Contra `http://localhost:8081`: `GET /` 200, `GET /salud` `{"ok":true}`, `POST /tareas` creó una tarea (201) y `GET /tareas` la devolvió.
  - `bash plataforma/validar.sh proyecto-platform/score.yaml`: pasó los tres guardrails.
  - `score-compose init --no-sample` y `generate` de la sección 2.2: validó el workload, provisionó Postgres con host/usuario/base/password generados (no elegidos por nadie) y escribió `compose.yaml`.
  - `docker compose up --build -d` en `proyecto-platform/`: levantó la API y Postgres. Contra `http://localhost:8080`: mismas pruebas que arriba, todas ok.
  - `bash plataforma/resumen.sh`: imprimió el resumen con el estado de los contenedores, la URL y el nombre/host real de la base que generó el provisioner.
- **No verificado todavía:** el `Makefile` en sí (`make devops`, `make demo`, `make reset`) porque `make` no está instalado en esta máquina. Lo que sí está probado es la lógica exacta que cada receta ejecuta (son los mismos comandos de `bash`, uno por uno, de arriba). Si vas a usar `make` en la presentación, instalalo antes (`choco install make`) y corré `make devops` y `make demo` una vez para confirmarlo; si no, los comandos de `bash` de la sección 2 ya están verificados tal cual están escritos.

### Cambio de página y de puertos (segunda vuelta)

Se cambió la portada (sin la lista de tareas en el navegador, sin el badge que distinguía las páginas) y se intercambiaron los puertos: ahora `proyecto-devops/` es el **8080** y `proyecto-platform/` es el **8081**. Se volvió a probar todo de punta a punta después del cambio:

- `npm test` en `app/`: 2 tests, ok (el segundo ahora busca "Grupo 11" en vez de "Lista de tareas").
- Las dos páginas, reconstruidas y levantadas de nuevo con los puertos nuevos: `http://localhost:8080` (DevOps manual) y `http://localhost:8081` (Platform Engineering) devuelven **el mismo HTML, byte por byte** (`diff` entre las dos respuestas: sin diferencias).
- Se verificó visualmente en el navegador: la tarjeta centrada, con fondo degradado, sin la lista de tareas.
- La API de tareas sigue funcionando en los dos puertos aunque no se muestre en la página (se puede probar con `curl -X POST .../tareas` como en la sección 4).

Para la próxima sesión: las dos páginas quedaron arriba (8080 y 8081) después de esta prueba. Bajalas con la sección 2.3 cuando termines de mirarlas, para no dejar contenedores corriendo de más.

### Volvió la lista de tareas, con otro diseño (tercera vuelta)

Se decidió volver a mostrar el CRUD en el navegador: el header ahora dice "Lista de Tareas" y tiene el formulario funcional en una tarjeta blanca; lo que antes era la portada (materia, grupo, integrantes) pasó a ser el pie de página, más chico. Sigue siendo fondo degradado azul y sigue siendo la misma página en los dos puertos.

- `npm test` en `app/`: 2 tests, ok.
- Contra `http://localhost:8080`: `POST /tareas` creó una tarea (201), se vio en la lista en el navegador, `DELETE` la borró (204) y la lista volvió a quedar vacía.
- `diff` entre `http://localhost:8080/` y `http://localhost:8081/`: sin diferencias (antes de agregar tareas — cada lado tiene su propia base, así que el contenido de la lista en sí puede divergir una vez que se usan; el HTML y el diseño son siempre idénticos).
