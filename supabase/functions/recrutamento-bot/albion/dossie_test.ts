import { assert, assertEquals } from "@std/assert";
import { EventoKillboard, JogadorDetalhe } from "./api.ts";
import { analisarDossie } from "./dossie.ts";

const AGORA = Date.UTC(2026, 9, 19); // 19/10/2026
const DIA = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

function jogador(extra: Partial<JogadorDetalhe> = {}): JogadorDetalhe {
  return {
    Id: "abc123",
    Name: "Fulano",
    GuildName: "",
    AllianceName: "",
    KillFame: 1_000_000,
    DeathFame: 4_000_000,
    FameRatio: 0.25,
    LifetimeStatistics: {
      PvE: { Total: 100_000_000 },
      Gathering: { All: { Total: 10_000_000 } },
      Crafting: { Total: 5_000_000 },
      FishingFame: 1_000_000,
      FarmingFame: 2_000_000,
    },
    ...extra,
  };
}

// Fama total esperada acima: 100M + 10M + 5M + 1M + 2M + 1M (PvP) = 119M

function kill(diasAtras: number, guildaDoJogador: string): EventoKillboard {
  return {
    EventId: 1,
    TimeStamp: iso(AGORA - diasAtras * DIA),
    TotalVictimKillFame: 10_000,
    Killer: { Name: "Fulano", GuildName: guildaDoJogador, AllianceName: null },
    Victim: { Name: "Vitima", GuildName: "Outra", AllianceName: null },
  };
}

function morte(diasAtras: number, guildaDoJogador: string): EventoKillboard {
  return {
    EventId: 2,
    TimeStamp: iso(AGORA - diasAtras * DIA),
    TotalVictimKillFame: 20_000,
    Killer: { Name: "Matador", GuildName: "Inimiga", AllianceName: null },
    Victim: { Name: "Fulano", GuildName: guildaDoJogador, AllianceName: null },
  };
}

Deno.test("analisarDossie: soma a fama de todas as fontes", () => {
  const d = analisarDossie({ jogador: jogador(), kills: [], mortes: [], famaDeclaradaTexto: "119m", agora: AGORA });
  assertEquals(d.jogador?.fama.total, 119_000_000);
  assertEquals(d.famaDeclarada, 119_000_000);
  assertEquals(d.diferencaFamaPct, 0);
});

Deno.test("analisarDossie: fama declarada muito diferente gera alerta", () => {
  const d = analisarDossie({ jogador: jogador(), kills: [kill(1, "")], mortes: [], famaDeclaradaTexto: "1,33b", agora: AGORA });
  assert(d.alertas.some((a) => a.includes("acima")), "esperava alerta de fama acima");
});

Deno.test("analisarDossie: fama dentro da tolerância não alerta", () => {
  const d = analisarDossie({ jogador: jogador(), kills: [kill(1, "")], mortes: [], famaDeclaradaTexto: "110m", agora: AGORA });
  assert(!d.alertas.some((a) => a.includes("Fama declarada")));
});

Deno.test("analisarDossie: fama ilegível gera alerta", () => {
  const d = analisarDossie({ jogador: jogador(), kills: [kill(1, "")], mortes: [], famaDeclaradaTexto: "bastante", agora: AGORA });
  assert(d.alertas.some((a) => a.includes("Não consegui entender")));
});

Deno.test("analisarDossie: guilda atual diferente da nossa gera alerta", () => {
  const d = analisarDossie({
    jogador: jogador({ GuildName: "Rival" }),
    kills: [kill(1, "Rival")],
    mortes: [],
    famaDeclaradaTexto: "119m",
    agora: AGORA,
  });
  assert(d.alertas.some((a) => a.includes("outra guilda")));
});

Deno.test("analisarDossie: já ser da nossa guilda é sinalizado (sem dizer 'outra')", () => {
  const d = analisarDossie({
    jogador: jogador({ GuildName: "Big Purple" }),
    kills: [kill(1, "Big Purple")],
    mortes: [],
    famaDeclaradaTexto: "119m",
    agora: AGORA,
  });
  assert(d.alertas.some((a) => a.includes("já consta") || a.includes("Já consta")));
  assert(!d.alertas.some((a) => a.includes("outra guilda")));
});

Deno.test("analisarDossie: 3+ guildas nos eventos gera alerta de rotatividade", () => {
  const d = analisarDossie({
    jogador: jogador(),
    kills: [kill(30, "A"), kill(20, "B")],
    mortes: [morte(10, "C")],
    famaDeclaradaTexto: "119m",
    agora: AGORA,
  });
  assertEquals(d.jogador?.guildasVistas.map((g) => g.guilda), ["C", "B", "A"]);
  assert(d.alertas.some((a) => a.includes("3 guildas")));
});

Deno.test("analisarDossie: sem eventos = alerta de pouco PvP; killboard fora = alerta diferente", () => {
  const semPvp = analisarDossie({ jogador: jogador(), kills: [], mortes: [], famaDeclaradaTexto: "119m", agora: AGORA });
  assert(semPvp.alertas.some((a) => a.includes("Nenhum evento de PvP")));

  const killboardFora = analisarDossie({ jogador: jogador(), kills: null, mortes: null, famaDeclaradaTexto: "119m", agora: AGORA });
  assert(killboardFora.alertas.some((a) => a.includes("Killboard indisponível")));
  assert(!killboardFora.alertas.some((a) => a.includes("Nenhum evento de PvP")), "não pode dizer 'sem PvP' quando na verdade falhou");
});

Deno.test("analisarDossie: último PvP há mais de 30 dias gera alerta de inatividade", () => {
  const d = analisarDossie({ jogador: jogador(), kills: [kill(45, "")], mortes: [], famaDeclaradaTexto: "119m", agora: AGORA });
  assert(d.alertas.some((a) => a.includes("Sem PvP há mais de")));
});

Deno.test("analisarDossie: últimas kills/mortes vêm da mais recente pra mais antiga, no máximo 3", () => {
  const d = analisarDossie({
    jogador: jogador(),
    kills: [kill(10, ""), kill(2, ""), kill(5, ""), kill(1, "")],
    mortes: [],
    famaDeclaradaTexto: "119m",
    agora: AGORA,
  });
  const quandos = d.jogador!.ultimasKills.map((k) => k.quando);
  assertEquals(quandos.length, 3);
  assertEquals(quandos, [...quandos].sort((a, b) => b - a));
});

Deno.test("analisarDossie: estatísticas ausentes não quebram (conta nova)", () => {
  const d = analisarDossie({
    jogador: jogador({ LifetimeStatistics: undefined, KillFame: 0 }),
    kills: [],
    mortes: [],
    famaDeclaradaTexto: "1m",
    agora: AGORA,
  });
  assertEquals(d.jogador?.fama.total, 0);
  assertEquals(d.diferencaFamaPct, null);
});
