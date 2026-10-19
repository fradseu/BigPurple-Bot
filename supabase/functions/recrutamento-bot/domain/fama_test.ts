import { assertEquals } from "@std/assert";
import { formatarFama, lerFamaDeclarada } from "./fama.ts";

Deno.test("lerFamaDeclarada: sufixos em português e inglês", () => {
  assertEquals(lerFamaDeclarada("1,33b"), 1_330_000_000);
  assertEquals(lerFamaDeclarada("1.33bn"), 1_330_000_000);
  assertEquals(lerFamaDeclarada("1,33 bi"), 1_330_000_000);
  assertEquals(lerFamaDeclarada("850m"), 850_000_000);
  assertEquals(lerFamaDeclarada("850 mi"), 850_000_000);
  assertEquals(lerFamaDeclarada("12,5k"), 12_500);
  assertEquals(lerFamaDeclarada("1,5 bilhões"), 1_500_000_000);
});

Deno.test("lerFamaDeclarada: número puro, com ou sem separador de milhar", () => {
  assertEquals(lerFamaDeclarada("166514438"), 166_514_438);
  assertEquals(lerFamaDeclarada("166.514.438"), 166_514_438);
  assertEquals(lerFamaDeclarada("1,330,000,000"), 1_330_000_000);
});

Deno.test("lerFamaDeclarada: separador de milhar + decimal com sufixo", () => {
  assertEquals(lerFamaDeclarada("1.234,5m"), 1_234_500_000);
});

Deno.test("lerFamaDeclarada: lixo vira null", () => {
  assertEquals(lerFamaDeclarada(""), null);
  assertEquals(lerFamaDeclarada("muita"), null);
  assertEquals(lerFamaDeclarada("1,33x"), null);
  assertEquals(lerFamaDeclarada("1,3,3,b"), null); // já virou 133 bilhões numa versão permissiva
  assertEquals(lerFamaDeclarada("1,b"), null);
  assertEquals(lerFamaDeclarada(",5m"), null);
});

Deno.test("lerFamaDeclarada: ambíguo sem sufixo não é adivinhado", () => {
  assertEquals(lerFamaDeclarada("1,33"), null); // 1,33 o quê?
  assertEquals(lerFamaDeclarada("1.234"), 1234); // com 3 casas, sem sufixo = milhar
});

Deno.test("lerFamaDeclarada: um separador com sufixo é sempre decimal", () => {
  assertEquals(lerFamaDeclarada("1.234m"), 1_234_000);
  assertEquals(lerFamaDeclarada("0,5b"), 500_000_000);
});

Deno.test("formatarFama: abrevia em pt-BR", () => {
  assertEquals(formatarFama(1_330_000_000), "1,33b");
  assertEquals(formatarFama(166_514_438), "166,51m");
  assertEquals(formatarFama(12_300), "12,3k");
  assertEquals(formatarFama(950), "950");
});
