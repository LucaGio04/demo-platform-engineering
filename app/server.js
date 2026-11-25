// API de lista de tareas.
// Variables de entorno: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
// El proceso no abre el puerto 8080 hasta poder hablar con PostgreSQL.

const express = require("express");
const { Pool } = require("pg");

const PUERTO = 8080;
const VARIABLES = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];

function leerConfig() {
  const faltan = VARIABLES.filter((nombre) => !process.env[nombre]);
  if (faltan.length > 0) {
    throw new Error("Faltan variables: " + faltan.join(", "));
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

function tituloValido(titulo) {
  if (typeof titulo !== "string") {
    return false;
  }
  const limpio = titulo.trim();
  return limpio.length > 0 && limpio.length <= 200;
}

function ruta(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      console.error(error);
      res.status(500).json({ error: "Error interno" });
    });
  };
}

function crearApp(pool) {
  const app = express();
  app.use(express.json());

  app.get("/salud", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/", (_req, res) => {
    res.type("html").send(HTML);
  });

  app.get(
    "/tareas",
    ruta(async (_req, res) => {
      const resultado = await pool.query(
        "SELECT id, titulo FROM tareas ORDER BY id"
      );
      res.json(resultado.rows);
    })
  );

  app.post(
    "/tareas",
    ruta(async (req, res) => {
      const titulo = req.body && req.body.titulo;
      if (!tituloValido(titulo)) {
        res.status(400).json({ error: "El título es obligatorio (máximo 200)" });
        return;
      }
      const resultado = await pool.query(
        "INSERT INTO tareas (titulo) VALUES ($1) RETURNING id, titulo",
        [titulo.trim()]
      );
      res.status(201).json(resultado.rows[0]);
    })
  );

  app.delete(
    "/tareas/:id",
    ruta(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        res.status(400).json({ error: "Id inválido" });
        return;
      }
      const resultado = await pool.query("DELETE FROM tareas WHERE id = $1", [id]);
      if (resultado.rowCount === 0) {
        res.status(404).json({ error: "No existe" });
        return;
      }
      res.status(204).end();
    })
  );

  return app;
}

async function prepararBase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tareas (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL
    )
  `);
}

async function conectarConReintentos(config) {
  const pool = new Pool(config);
  for (let intento = 1; intento <= 30; intento++) {
    try {
      await pool.query("SELECT 1");
      return pool;
    } catch (error) {
      console.log(`Esperando a PostgreSQL (${intento}/30): ${error.message}`);
      await new Promise((resolver) => setTimeout(resolver, 1000));
    }
  }
  await pool.end();
  throw new Error("No se pudo conectar a PostgreSQL");
}

async function main() {
  const pool = await conectarConReintentos(leerConfig());
  await prepararBase(pool);
  crearApp(pool).listen(PUERTO, "0.0.0.0", () => {
    console.log(`Lista de tareas en el puerto ${PUERTO}`);
  });
}

const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Metodologías Ágiles · Grupo 11 · DevOps</title>
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f2f66, #15509e 55%, #2aa8e0);
      color: #fff;
      text-align: center;
    }
    .portada {
      padding: 2.5rem 3rem;
      max-width: 40rem;
      transform: translateY(-12%);
    }
    .materia { font-size: 1.2rem; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.85; }
    h1 { margin: 0.5rem 0 1.8rem; font-size: 3.6rem; }
    .grupo strong { display: block; font-size: 1.8rem; margin-bottom: 0.6rem; }
    .integrantes { opacity: 0.9; font-size: 1.4rem; }
  </style>
</head>
<body>
  <main class="portada">
    <div class="materia">Metodologías Ágiles</div>
    <h1>DevOps</h1>
    <div class="grupo">
      <strong>Grupo 11</strong>
      <span class="integrantes">Bellizzi Tomás · Devida Facundo · Giordani Luca · Rodríguez Joaquín</span>
    </div>
  </main>
</body>
</html>
`;

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { crearApp, tituloValido };
