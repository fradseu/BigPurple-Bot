import { assert, assertEquals } from "@std/assert";
import {
  compararMembros,
  dataDeEntrada,
  diaDeBrasilia,
  montarLinhaSnapshot,
  papelDe,
} from "./domain.ts";

const membro = {
  Id: "P1",
  Name: "FelipePikito",
  KillFame: 786193,
  DeathFame: 4823368,
  FameRatio: 0.16,
  LifetimeStatistics: {
    PvE: { Total: 166514438, Royal: 46417876, Outlands: 2860999, Avalon: 22685483, Hellgate: 0, CorruptedDungeon: 412954, Mists: 2418277 },
    Gathering: {
      All: { Total: 1938285, Royal: 1530910, Outlands: 198853, Avalon: 144227 },
      Fiber: { Total: 1245201 },
      Hide: { Total: 245997 },
      Ore: { Total: 153365 },
      Rock: { Total: 118473 },
      Wood: { Total: 175249 },
    },
    Crafting: { Total: 2416016, Royal: 760, Outlands: 0, Avalon: 0 },
    CrystalLeague: 0,
    FishingFame: 182886,
    FarmingFame: 886400,
    Timestamp: "2026-10-19T03:24:35.421664Z",
  },
};

Deno.test("retrato: mapeia PvE, coleta, craft e o resto da resposta do Albion", () => {
  const l = montarLinhaSnapshot("G1", "2026-10-19", membro);
  assertEquals(l.pve_avalon, 22685483);
  assertEquals(l.coleta_total, 1938285);
  assertEquals(l.coleta_fibra, 1245201);
  assertEquals(l.craft_total, 2416016);
  assertEquals(l.pesca, 182886);
  assertEquals(l.fazenda, 886400);
  assertEquals(l.estatisticas_em, "2026-10-19T03:24:35.421664Z");
  assertEquals(l.bruto, membro);
});

Deno.test("retrato: zero é zero, mas campo ausente fica null (não vira 0)", () => {
  assertEquals(montarLinhaSnapshot("G1", "2026-10-19", membro).crystal, 0);
  const vazio = montarLinhaSnapshot("G1", "2026-10-19", { Id: "P2", Name: "Novo" });
  assertEquals(vazio.pve_total, null);
  assertEquals(vazio.kill_fame, null);
  assertEquals(vazio.estatisticas_em, null);
});

Deno.test("dia: usa o horário de Brasília, não o UTC", () => {
  assertEquals(diaDeBrasilia(Date.UTC(2026, 9, 19, 2, 30)), "2026-10-18"); // 23:30 do dia 18 em Brasília
  assertEquals(diaDeBrasilia(Date.UTC(2026, 9, 19, 3, 30)), "2026-10-19");
});

Deno.test("entrada: na primeira execução, todo mundo entrou no dia seguinte à fundação", () => {
  assertEquals(dataDeEntrada(true, "2026-10-08T01:36:39.000Z", "2026-10-19"), {
    data: "2026-10-09",
    origem: "dia_seguinte_a_fundacao",
  });
});

Deno.test("entrada: depois da primeira execução, vale o dia em que o vimos pela primeira vez", () => {
  assertEquals(dataDeEntrada(false, "2026-10-08T01:36:39.000Z", "2026-10-25"), {
    data: "2026-10-25",
    origem: "primeiro_dia_visto",
  });
});

Deno.test("papel: fundador pelo id da API, conselheiros pelo nome (sem diferenciar maiúscula)", () => {
  assertEquals(papelDe("P1", "FelipePikito", "P1", ["SrEremidas", "Delrith"]), "fundador");
  assertEquals(papelDe("P2", "sreremidas", "P1", ["SrEremidas", "Delrith"]), "conselheiro");
  assertEquals(papelDe("P3", "Yumiyiyiy", "P1", ["SrEremidas", "Delrith"]), "player");
});

Deno.test("membros: separa novos, quem voltou e quem saiu", () => {
  const registrados = [
    { player_id: "A", nome: "A", ativo: true },
    { player_id: "B", nome: "B", ativo: true },
    { player_id: "C", nome: "C", ativo: false },
  ];
  const atuais = [{ Id: "A", Name: "A" }, { Id: "C", Name: "C" }, { Id: "D", Name: "D" }];
  const r = compararMembros(registrados, atuais);
  assertEquals(r.novos.map((m) => m.Id), ["D"]);
  assertEquals(r.voltaram, ["C"]);
  assertEquals(r.saiu, ["B"]);
  assert(!r.saiu.includes("C")); // já estava marcado como saído: não "sai" de novo
});
