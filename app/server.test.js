const test = require("node:test");
const assert = require("node:assert");
const { crearApp, tituloValido } = require("./server");

test("el titulo vacio no sirve y uno corto si", () => {
  assert.equal(tituloValido(""), false);
  assert.equal(tituloValido("   "), false);
  assert.equal(tituloValido(null), false);
  assert.equal(tituloValido("preparar la exposicion"), true);
});

test("la pagina principal responde", async () => {
  const app = crearApp(null);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const respuesta = await fetch(`http://127.0.0.1:${port}/`);
    const cuerpo = await respuesta.text();
    assert.equal(respuesta.status, 200);
    assert.match(cuerpo, /Lista de tareas/);
  } finally {
    await new Promise((resolver) => server.close(resolver));
  }
});
