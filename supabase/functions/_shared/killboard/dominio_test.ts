import { assertEquals } from "@std/assert";
import {
  classificarEvento,
  EventoAlbion,
  eventosParaPostar,
  formatarFama,
  idsPorNome,
  jogadoresDoEvento,
  lerSubcomando,
  montarEmbedEvento,
  montarEmbedRanking,
  montarRanking,
  podeConfigurar,
  nomesDosMembros,
  textoRanking,
} from "./dominio.ts";

function evento(over: Partial<EventoAlbion> = {}): EventoAlbion {
  return {
    EventId: 1,
    TimeStamp: "2026-11-01T12:00:00Z",
    TotalVictimKillFame: 152_340,
    numberOfParticipants: 3,
    Killer: { Id: "K", Name: "Matador", GuildName: "Big Purple", AverageItemPower: 1310.4 },
    Victim: {
      Id: "V",
      Name: "Vitima",
      GuildName: "Outra",
      AverageItemPower: 1200,
      Equipment: { MainHand: { Type: "T8_MAIN_SWORD@3" } },
    },
    Participants: [
      { Id: "K", Name: "Matador", DamageDone: 900 },
      { Id: "A", Name: "Ajudante", DamageDone: 300 },
      { Id: "H", Name: "Curandeiro", DamageDone: 0, SupportHealingDone: 500 },
      { Id: "X", Name: "Parado", DamageDone: 0, SupportHealingDone: 0 },
    ],
    ...over,
  };
}

Deno.test("kill: matador é membro, assistentes membros vão junto", () => {
  const c = classificarEvento(evento(), new Map([["K", "d1"], ["A", "d2"]]));
  assertEquals(c, { tipo: "kill", membros: ["K", "A"] });
});

Deno.test("morte: vítima é membro", () => {
  const c = classificarEvento(evento(), new Map([["V", "d1"]]));
  assertEquals(c, { tipo: "morte", membros: ["V"] });
});

Deno.test("assistência: só ajudou (dano ou cura)", () => {
  const c = classificarEvento(evento(), new Map([["A", "d1"], ["H", "d2"]]));
  assertEquals(c, { tipo: "assistencia", membros: ["A", "H"] });
});

Deno.test("quem estava no evento sem dano nem cura não é assistência", () => {
  assertEquals(classificarEvento(evento(), new Map([["X", "d1"]])), null);
});

Deno.test("sem membro acompanhado, nada", () => {
  assertEquals(classificarEvento(evento(), new Map()), null);
});

Deno.test("jogadores do evento sem repetição", () => {
  assertEquals(jogadoresDoEvento(evento()), ["K", "V", "A", "H", "X"]);
});

Deno.test("eventos para postar: tira os já postados e os antigos, ordena e limita", () => {
  const lista = [
    evento({ EventId: 3, TimeStamp: "2026-11-01T12:03:00Z" }),
    evento({ EventId: 2, TimeStamp: "2026-11-01T12:02:00Z" }),
    evento({ EventId: 1, TimeStamp: "2026-11-01T12:01:00Z" }),
    evento({ EventId: 0, TimeStamp: "2026-11-01T11:00:00Z" }),
  ];
  const r = eventosParaPostar(lista, new Set([2]), new Date("2026-11-01T12:00:00Z"), 10);
  assertEquals(r.map((e) => e.EventId), [1, 3]);
  assertEquals(eventosParaPostar(lista, new Set(), new Date(0), 2).map((e) => e.EventId), [0, 1]);
});

Deno.test("fama formatada", () => {
  assertEquals(formatarFama(152_340), "152,3k");
  assertEquals(formatarFama(2_500_000), "2,5M");
  assertEquals(formatarFama(900), "900");
  assertEquals(formatarFama(undefined), "0");
});

Deno.test("kill: menção no texto da mensagem, nome do jogo no embed, link do evento", () => {
  const acompanhados = new Map([["K", "111"], ["A", "222"]]);
  const e = evento();
  const c = classificarEvento(e, acompanhados)!;
  assertEquals(nomesDosMembros(e, c), ["Matador", "Ajudante"]);
  const embed = montarEmbedEvento(e, c);
  assertEquals(embed.title, "⚔️ Matador matou Vitima");
  assertEquals(embed.description, "Kill de **Matador**, **Ajudante**");
  assertEquals(embed.url, "https://albiononline.com/killboard/kill/1");
  assertEquals(embed.color, 0x2ecc71);
  assertEquals(embed.image?.url, "https://qroosefyfxefjrlhogrh.supabase.co/functions/v1/killboard-imagem/1.png?v=2");
});

Deno.test("embed de morte", () => {
  const acompanhados = new Map([["V", "222"]]);
  const e = evento();
  const c = classificarEvento(e, acompanhados)!;
  const embed = montarEmbedEvento(e, c);
  assertEquals(embed.title, "💀 Vitima morreu para Matador");
  assertEquals(embed.color, 0xe74c3c);
});

Deno.test("lê subcomando e valores", () => {
  const r = lerSubcomando([
    { name: "ativar", type: 1, options: [{ name: "canal", type: 7, value: "123" }] },
  ]);
  assertEquals(r, { nome: "ativar", valores: { canal: "123" } });
  assertEquals(lerSubcomando(undefined), null);
});

Deno.test("permissão: administrador ou gerenciar servidor", () => {
  assertEquals(podeConfigurar("8"), true);
  assertEquals(podeConfigurar("32"), true);
  assertEquals(podeConfigurar("2048"), false);
  assertEquals(podeConfigurar(undefined), false);
});

Deno.test("ranking: kill conta pro matador e assistência pros demais; mortes separadas", () => {
  const r = montarRanking([
    { tipo: "kill", fama: 100, discordIds: ["a", "b"], nomes: ["Ana", "Beto"] },
    { tipo: "kill", fama: 300, discordIds: ["b"], nomes: ["Beto"] },
    { tipo: "kill", fama: 50, discordIds: ["a"], nomes: [] },
    { tipo: "assistencia", fama: 70, discordIds: ["c"], nomes: ["Caio"] },
    { tipo: "morte", fama: 900, discordIds: ["a"], nomes: ["Ana"] },
  ]);
  assertEquals(r.kills, [
    { discordId: "b", nome: "Beto", quantidade: 1, fama: 300 },
    { discordId: "a", nome: "Ana", quantidade: 2, fama: 150 },
  ].sort((x, y) => y.quantidade - x.quantidade || y.fama - x.fama));
  assertEquals(r.assistencias.map((p) => p.discordId), ["b", "c"]);
  assertEquals(r.mortes, [{ discordId: "a", nome: "Ana", quantidade: 1, fama: 900 }]);
});

Deno.test("ranking: limita ao top N e mostra medalhas", () => {
  const linhas = Array.from({ length: 12 }, (_, i) => ({ tipo: "kill" as const, fama: i, discordIds: [`u${i}`], nomes: [`Jogador${i}`] }));
  const r = montarRanking(linhas);
  assertEquals(r.kills.length, 10);
  assertEquals(r.kills[0].discordId, "u11");
  const texto = textoRanking(r).split("\n");
  assertEquals(texto[0], "**⚔️ Top Kills**");
  assertEquals(texto[1], "🥇 **Jogador11** — 1 · 11 de fama");
  assertEquals(texto[4], "`4.` **Jogador8** — 1 · 8 de fama");
  assertEquals(texto[texto.length - 1], "_ninguém ainda_");
  assertEquals(montarEmbedRanking(30).title, "🏆 Ranking do Killboard — últimos 30 dias");
});

Deno.test("ids dos membros a partir dos nomes guardados", () => {
  assertEquals(idsPorNome(evento(), ["Matador", "Ajudante", "Sumiu"]), ["K", "A"]);
});
