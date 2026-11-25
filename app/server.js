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
  <title>Lista de Tareas · Metodologías Ágiles · Grupo 11</title>
  <style>
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 2.5rem 1rem 1.5rem;
      background: linear-gradient(135deg, #0f2f66, #15509e 55%, #2aa8e0);
      color: #fff;
    }
    .pagina { width: 100%; max-width: 30rem; display: flex; flex-direction: column; align-items: center; }
    header { width: 100%; max-width: 50rem; text-align: center; padding: 1rem 0 3rem; }
    header h1 { margin: 0; font-size: 3.4rem; letter-spacing: 0.02em; }
    .tarjeta {
      width: 100%;
      background: #fff;
      color: #172033;
      border-radius: 1.25rem;
      padding: 1.75rem;
      box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.5);
    }
    form { display: flex; gap: 0.5rem; }
    input, button {
      font: inherit;
      padding: 0.7rem 1rem;
      border-radius: 0.6rem;
      border: 1px solid #c5ced9;
    }
    input { flex: 1; }
    input:focus, button:focus { outline: 2px solid #15509e; outline-offset: 1px; }
    button {
      background: linear-gradient(135deg, #15509e, #2aa8e0);
      color: #fff;
      border: 0;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { filter: brightness(1.08); }
    .error { color: #c0392b; min-height: 1.3rem; margin: 0.6rem 0 0; font-size: 0.9rem; }
    ul { list-style: none; padding: 0; margin: 0.6rem 0 0; }
    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.7rem 0.2rem;
      border-bottom: 1px solid #e6ebf2;
    }
    li:last-child { border-bottom: 0; }
    li button {
      background: #f3f5f8;
      color: #172033;
      font-weight: 500;
      padding: 0.4rem 0.8rem;
    }
    .vacio { color: #5c6b80; border: 0; justify-content: center; }
    footer {
      width: 100%;
      max-width: 70rem;
      margin-top: auto;
      padding: 3rem 1rem 1rem;
      text-align: center;
      opacity: 0.85;
    }
    footer .materia { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.1em; }
    footer .grupo { font-size: 1.1rem; font-weight: 600; margin-top: 0.5rem; }
    footer .integrantes { font-size: 0.95rem; display: block; margin-top: 0.3rem; }
  </style>
</head>
<body>
  <header>
    <h1>Lista de Tareas</h1>
  </header>
  <div class="pagina">
    <main class="tarjeta">
      <form id="formulario">
        <input id="titulo" name="titulo" placeholder="Nueva tarea" autocomplete="off">
        <button type="submit">Agregar</button>
      </form>
      <p id="mensaje" class="error"></p>
      <ul id="lista"></ul>
    </main>
  </div>
  <footer>
    <div class="materia">Metodologías Ágiles</div>
    <div class="grupo">Grupo 11</div>
    <span class="integrantes">Bellizzi Tomás · Devida Facundo · Giordani Luca · Rodríguez Joaquín</span>
  </footer>
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
