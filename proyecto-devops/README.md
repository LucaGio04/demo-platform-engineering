# Enfoque DevOps

Esta carpeta es el lado de alta carga cognitiva. La aplicación está en `../app`. Acá está todo lo demás que el desarrollador escribe y mantiene para llevarla a un cluster.

Estos YAML no se aplican en la demo: no hay cluster. La sintaxis se puede revisar con `kubectl` o con `kubeconform`.

## Dockerfile

Imagen en dos etapas. La primera instala dependencias con `npm ci`. La segunda copia solo `node_modules`, `package.json` y `server.js`, y corre con el usuario `10001` (no root).

El contexto de build es la raíz del repositorio, porque el código está en `app/`:

```bash
docker build -f proyecto-devops/Dockerfile .
```

## k8s/deployment.yaml

Dos réplicas de la API. Define límite e pedido de CPU y memoria, probes sobre `GET /salud` y las cinco variables de base leídas del Secret. `startupProbe` espera a que el proceso conecte a PostgreSQL antes de marcar el pod como fallido. El contenedor corre con `runAsUser: 10001`, el mismo usuario de la imagen.

## k8s/service.yaml

Dirección estable para los pods. El Ingress apunta a este Service, puerto 8080.

## k8s/ingress.yaml

Publica la API en el host `tareas.demo.local` con TLS. El certificado viviría en el Secret `tareas-tls`, que crea el cluster (por ejemplo cert-manager). No está en el repo.

`ingressClassName: nginx` es un ejemplo. En un cluster real la clase depende de qué ingress controller haya instalado el equipo de plataforma.

## k8s/postgres.yaml

Tres recursos en un solo archivo:

- `PersistentVolumeClaim` de 1Gi para los datos.
- `Service` llamado `postgres`. Ese nombre es el `DB_HOST` del Secret, para que la API lo resuelva dentro del cluster.
- `Deployment` de `postgres:17-alpine` (la misma línea mayor que provisiona `score-compose`), montando el disco y leyendo usuario, base y contraseña del Secret.

## k8s/secret.yaml

Usuario, contraseña, host, puerto y base de ejemplo. Sirve para leer el manifiesto en la exposición. No sirve para un entorno real: `stringData` se ve en texto plano y Kubernetes solo lo codifica, no lo cifra.

## .github/workflows/pipeline.yml

En un push o un pull request: instala Node 22, corre `npm ci` y `npm test` en `app/`, construye la imagen y, si el evento es un push, la publica en GHCR.

GitHub Actions solo ejecuta workflows que están en `/.github/workflows/` en la raíz del repositorio. Este archivo está acá para que la comparación de la demo lo cuente junto al resto. Para usarlo de verdad hay que moverlo a esa carpeta. Las rutas del workflow ya asumen la raíz del repo como contexto.
