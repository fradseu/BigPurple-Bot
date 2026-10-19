import { assertEquals } from "@std/assert";
import {
  ConfigPermissoes,
  ContextoMembro,
  ehAdministrador,
  ehRecrutador,
  podeConfigurar,
  podeGerenciarAutorizados,
} from "./permissoes.ts";

const ADMIN = "8"; // bit ADMINISTRATOR
const TUDO = "2199023255551"; // dono do servidor: todos os bits ligados
const GERENCIAR_SERVIDOR = "32"; // NÃO é administrador

const membro = (extra: Partial<ContextoMembro> = {}): ContextoMembro => ({
  userId: "100",
  roles: [],
  ...extra,
});

const config = (extra: Partial<ConfigPermissoes> = {}): ConfigPermissoes => ({
  cargoRecrutadorId: null,
  autorizadosUsuarios: [],
  autorizadosCargos: [],
  ...extra,
});

Deno.test("ehAdministrador: só o bit ADMINISTRATOR conta", () => {
  assertEquals(ehAdministrador(ADMIN), true);
  assertEquals(ehAdministrador(TUDO), true);
  assertEquals(ehAdministrador(GERENCIAR_SERVIDOR), false); // Gerenciar Servidor NÃO basta
  assertEquals(ehAdministrador("0"), false);
  assertEquals(ehAdministrador(undefined), false);
  assertEquals(ehAdministrador(""), false);
  assertEquals(ehAdministrador("lixo"), false); // BigInt lançaria; vira false
});

Deno.test("podeConfigurar: sem config, só administrador", () => {
  assertEquals(podeConfigurar(membro({ permissoes: ADMIN }), null), true);
  assertEquals(podeConfigurar(membro(), null), false);
  assertEquals(podeConfigurar(membro({ permissoes: GERENCIAR_SERVIDOR }), null), false);
});

Deno.test("podeConfigurar: usuário autorizado", () => {
  const c = config({ autorizadosUsuarios: ["100"] });
  assertEquals(podeConfigurar(membro({ userId: "100" }), c), true);
  assertEquals(podeConfigurar(membro({ userId: "200" }), c), false);
});

Deno.test("podeConfigurar: cargo autorizado (basta ter UM dos cargos da lista)", () => {
  const c = config({ autorizadosCargos: ["R1", "R2"] });
  assertEquals(podeConfigurar(membro({ roles: ["X", "R2"] }), c), true);
  assertEquals(podeConfigurar(membro({ roles: ["X", "Y"] }), c), false);
  assertEquals(podeConfigurar(membro({ roles: [] }), c), false);
});

Deno.test("podeGerenciarAutorizados: autorizado NÃO delega (só administrador)", () => {
  assertEquals(podeGerenciarAutorizados(membro({ permissoes: ADMIN })), true);
  // mesmo estando na lista de autorizados, não pode mexer na lista:
  const autorizado = membro({ userId: "100" });
  assertEquals(podeConfigurar(autorizado, config({ autorizadosUsuarios: ["100"] })), true);
  assertEquals(podeGerenciarAutorizados(autorizado), false);
});

Deno.test("ehRecrutador: administrador ou dono do cargo @Recrutador", () => {
  const c = config({ cargoRecrutadorId: "REC" });
  assertEquals(ehRecrutador(membro({ roles: ["REC"] }), c), true);
  assertEquals(ehRecrutador(membro({ permissoes: ADMIN }), c), true);
  assertEquals(ehRecrutador(membro({ roles: ["OUTRO"] }), c), false);
});

Deno.test("ehRecrutador: sem cargo configurado ninguém (além do admin) decide", () => {
  assertEquals(ehRecrutador(membro({ roles: ["REC"] }), config()), false);
  assertEquals(ehRecrutador(membro({ roles: ["REC"] }), null), false);
  assertEquals(ehRecrutador(membro({ permissoes: ADMIN }), null), true);
});

Deno.test("estar autorizado a configurar NÃO dá poder de aprovar candidaturas", () => {
  const c = config({ autorizadosUsuarios: ["100"], cargoRecrutadorId: "REC" });
  assertEquals(ehRecrutador(membro({ userId: "100" }), c), false);
});
