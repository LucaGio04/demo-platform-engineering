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
  <title>Lista de tareas</title>
  <style>
    body { font-family: sans-serif; max-width: 36rem; margin: 2rem auto; padding: 0 1rem; background: #fff; color: #172033; }
    h1 { font-size: 1.8rem; }
    form { display: flex; gap: 0.5rem; }
    input, button { font: inherit; padding: 0.55rem 0.8rem; }
    input { flex: 1; border: 1px solid #c5ced9; }
    button { background: #1f4b99; color: #fff; border: 0; }
    li { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.55rem 0; border-bottom: 1px solid #e6ebf2; }
    li button { background: #f3f5f8; color: #172033; }
    .vacio { color: #5c6b80; border: 0; }
    .error { color: #9b1c1c; min-height: 1.2rem; }
  </style>
</head>
<body>
  <h1>Lista de tareas</h1>
  <form id="formulario">
    <input id="titulo" name="titulo" placeholder="Nueva tarea" autocomplete="off">
    <button type="submit">Agregar</button>
  </form>
  <p id="mensaje" class="error"></p>
  <ul id="lista"></ul>
  <script>
    const lista = document.getElementById("lista");
    const mensaje = document.getElementById("mensaje");

    function pintar(tareas) {
      lista.replaceChildren();
      if (tareas.length === 0) {
        const vacio = document.createElement("li");
        vacio.className = "vacio";
        vacio.textContent = "No hay tareas todavía.";
        lista.appendChild(vacio);
        return;
      }
      for (const tarea of tareas) {
        const item = document.createElement("li");
        const texto = document.createElement("span");
        texto.textContent = tarea.titulo;
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "Borrar";
        boton.addEventListener("click", () => borrar(tarea.id));
        item.append(texto, boton);
        lista.appendChild(item);
      }
    }

    async function cargar() {
      const respuesta = await fetch("/tareas");
      if (!respuesta.ok) {
        mensaje.textContent = "No se pudo cargar la lista.";
        return;
      }
      pintar(await respuesta.json());
    }

    async function borrar(id) {
      mensaje.textContent = "";
      const respuesta = await fetch("/tareas/" + id, { method: "DELETE" });
      if (!respuesta.ok) {
        mensaje.textContent = "No se pudo borrar.";
        return;
      }
      await cargar();
    }

    document.getElementById("formulario").addEventListener("submit", async (evento) => {
      evento.preventDefault();
      mensaje.textContent = "";
      const titulo = document.getElementById("titulo").value;
      const respuesta = await fetch("/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo })
      });
      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({}));
        mensaje.textContent = cuerpo.error || "No se pudo agregar.";
        return;
      }
      document.getElementById("titulo").value = "";
      await cargar();
    });

    cargar();
  </script>
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
