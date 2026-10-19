import { assertEquals } from "@std/assert";
import { ehAdministrador } from "./permissoes.ts";

Deno.test("ehAdministrador: só o bit ADMINISTRATOR conta", () => {
  assertEquals(ehAdministrador("8"), true);
  assertEquals(ehAdministrador("2199023255551"), true); // dono: todos os bits
  assertEquals(ehAdministrador("32"), false); // Gerenciar Servidor não basta
  assertEquals(ehAdministrador(undefined), false);
  assertEquals(ehAdministrador("lixo"), false);
});
