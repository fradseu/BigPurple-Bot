import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { codigosParaPT } from "./codigoAnonimo.ts";

const DISP = "11111111-aaaa-bbbb-cccc-000000000001";

Deno.test("código anônimo: 3 caracteres, sem letras ambíguas", async () => {
  const c = (await codigosParaPT([DISP], "PT1")).get(DISP)!;
  assert(/^[A-HJKMNP-Z2-9]{3}$/.test(c), `código inválido: ${c}`);
});

Deno.test("código anônimo: estável dentro da mesma PT", async () => {
  const a = (await codigosParaPT([DISP], "PT1")).get(DISP);
  const b = (await codigosParaPT([DISP, "outra"], "PT1")).get(DISP);
  assertEquals(a, b);
});

Deno.test("código anônimo: a mesma pessoa tem códigos diferentes em PTs diferentes", async () => {
  const codigos = new Set<string>();
  for (let i = 0; i < 30; i++) codigos.add((await codigosParaPT([DISP], `PT${i}`)).get(DISP)!);
  assert(codigos.size > 20, `quase não varia entre PTs: ${[...codigos].join(",")}`);
});

Deno.test("código anônimo: dentro da PT cada candidato tem um código só dele", async () => {
  const ids = Array.from({ length: 200 }, (_, i) => `disp-${i}`);
  const mapa = await codigosParaPT(ids, "PT9");
  assertEquals(new Set(mapa.values()).size, ids.length);
});

Deno.test("código anônimo: não é o código da caixa (não dá pra se identificar com ele)", async () => {
  // O código interno da caixa vem de outro sorteio e nunca é mostrado; aqui só garantimos
  // que a derivação depende da PT: trocar a PT troca o código.
  assertNotEquals(
    (await codigosParaPT([DISP], "1561814168888287254")).get(DISP),
    (await codigosParaPT([DISP], "1561814168888287255")).get(DISP),
  );
});
