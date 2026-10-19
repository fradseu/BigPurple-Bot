// Testes da fase 3 do catálogo: outras classes (agregar/substituir), envio em massa,
// IDs dos novos botões e os textos que o líder lê depois de enviar.
import { assert, assertEquals } from "@std/assert";
import {
  CandidatoBruto,
  formatarEspera,
  idAgregarOk,
  idMassa,
  idMassaOk,
  idMenuSubstituir,
  idSelecaoOutras,
  idSelecaoRemocao,
  idSubstituirOk,
  lerAgregarOk,
  lerMassa,
  lerMassaOk,
  lerMenuSubstituir,
  lerSelecaoOutras,
  lerSelecaoRemocao,
  lerSubstituirOk,
  MAX_CONVITES_EM_MASSA,
  montarOutrasClasses,
  montarTelaCatalogo,
  montarTelaConfirmarSubstituir,
  montarTelaEscolhaOutra,
  montarTelaMassa,
  montarTelaMenuSubstituir,
  OpcaoCatalogo,
  resumirEnvio,
  selecionarParaMassa,
  vagasAbertas,
} from "./catalogo.ts";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const PT = "1561785526485262489";
const AGORA = 1_800_000_000_000;

const candidato = (extra: Partial<CandidatoBruto> = {}): CandidatoBruto => ({
  id: UUID,
  userId: "111111111111111111",
  codigo: "M24",
  classes: ["FURA-BRUMA"],
  tier: "T7",
  areas: ["PVE"],
  criadoEmMs: AGORA - 5 * 60_000,
  ...extra,
});

const LINHAS = [
  "📊 **Vagas:** (1/4)",
  "",
  "(1/1) <:defensivo:1> TANK <@999999999999999999> ",
  "(0/1) <:arcolongo:2> BADÔNICO ",
  "(0/1) <:curandeiro:4> MAIN HEALER ",
];
const ABERTAS = vagasAbertas(LINHAS); // BADÔNICO e MAIN HEALER
const base = { abertas: ABERTAS, liderId: "1", naPT: new Set<string>(), jaConvidados: new Set<string>(), agoraMs: AGORA };

const uuid = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const opcao = (n: number, classe = "BADÔNICO"): OpcaoCatalogo => ({
  disponibilidadeId: uuid(n), codigo: "AAA", classe, tier: "T7", areas: ["PVE"], minutosDisponivel: 1,
});

// ------------------------------------------------------------ outras classes

Deno.test("outras classes: só quem NÃO joga nenhuma classe com vaga livre", () => {
  const r = montarOutrasClasses({ ...base, candidatos: [candidato({ classes: ["FURA-BRUMA"] })] });
  assertEquals(r.map((o) => o.classe), ["FURA-BRUMA"]);
});

Deno.test("outras classes: classe que TEM vaga livre fica de fora (é caso do convite normal)", () => {
  const r = montarOutrasClasses({ ...base, candidatos: [candidato({ classes: ["BADÔNICO"] })] });
  assertEquals(r.length, 0);
});

Deno.test("outras classes: quem joga uma classe com vaga E outra sem vaga aparece só na sem vaga", () => {
  const r = montarOutrasClasses({ ...base, candidatos: [candidato({ classes: ["BADÔNICO", "FURA-BRUMA"] })] });
  assertEquals(r.map((o) => o.classe), ["FURA-BRUMA"]);
});

Deno.test("outras classes: classe de vaga OCUPADA (TANK) conta como 'sem vaga livre'", () => {
  const r = montarOutrasClasses({ ...base, candidatos: [candidato({ classes: ["TANK"] })] });
  assertEquals(r.map((o) => o.classe), ["TANK"]);
});

Deno.test("outras classes: exclui líder, quem já está na PT e quem já foi convidado", () => {
  const cand = candidato({ userId: "LID" });
  assertEquals(montarOutrasClasses({ ...base, liderId: "LID", candidatos: [cand] }).length, 0);
  assertEquals(montarOutrasClasses({ ...base, naPT: new Set(["LID"]), candidatos: [cand] }).length, 0);
  assertEquals(montarOutrasClasses({ ...base, jaConvidados: new Set([UUID]), candidatos: [cand] }).length, 0);
});

Deno.test("outras classes: não repete a mesma classe do mesmo candidato (BADÔNICO e badônico)", () => {
  const r = montarOutrasClasses({ ...base, candidatos: [candidato({ classes: ["FURA-BRUMA", "fura-bruma"] })] });
  assertEquals(r.length, 1);
});

Deno.test("outras classes: respeita o limite de 25 opções e não carrega o id do usuário", () => {
  const muitos = Array.from({ length: 40 }, (_, i) => candidato({ id: uuid(i), userId: `9${i}00000000000000` }));
  const r = montarOutrasClasses({ ...base, candidatos: muitos });
  assertEquals(r.length, 25);
  assert(!JSON.stringify(r).includes("9000000000000000"));
});

// ------------------------------------------------------------ em massa

Deno.test("massa: uma pessoa recebe UM convite só, mesmo casando com duas vagas", () => {
  const dupla = [opcao(1, "BADÔNICO"), opcao(1, "MAIN HEALER")];
  assertEquals(selecionarParaMassa(dupla).map((o) => o.classe), ["BADÔNICO"]);
});

Deno.test("massa: no máximo 5 convites por envio (anti-flood)", () => {
  const muitas = Array.from({ length: 12 }, (_, i) => opcao(i + 1));
  assertEquals(selecionarParaMassa(muitas).length, MAX_CONVITES_EM_MASSA);
  assertEquals(MAX_CONVITES_EM_MASSA, 5);
});

Deno.test("massa: sem ninguém, lista vazia", () => {
  assertEquals(selecionarParaMassa([]), []);
});

Deno.test("massa: mantém a ordem (quem espera há mais tempo primeiro)", () => {
  const ordem = [opcao(3), opcao(1), opcao(2)];
  assertEquals(selecionarParaMassa(ordem).map((o) => o.disponibilidadeId), [uuid(3), uuid(1), uuid(2)]);
});

// ------------------------------------------------------------ IDs dos botões

Deno.test("IDs novos: ida e volta", () => {
  assertEquals(lerSelecaoOutras(idSelecaoOutras(PT)), { ptMsgId: PT });
  assertEquals(lerMassa(idMassa(PT)), { ptMsgId: PT });
  assertEquals(lerMassaOk(idMassaOk(PT)), { ptMsgId: PT });
  assertEquals(lerAgregarOk(idAgregarOk(UUID, PT, 3)), { dispId: UUID, ptMsgId: PT, ci: 3 });
  assertEquals(lerMenuSubstituir(idMenuSubstituir(UUID, PT, 3, "M24")), { dispId: UUID, ptMsgId: PT, ci: 3, codigo: "M24" });
  assertEquals(lerSelecaoRemocao(idSelecaoRemocao(UUID, PT, 3, "M24")), { dispId: UUID, ptMsgId: PT, ci: 3, codigo: "M24" });
  assertEquals(lerSubstituirOk(idSubstituirOk(UUID, PT, 3, 22, "M24")), { dispId: UUID, ptMsgId: PT, ci: 3, cr: 22, codigo: "M24" });
});

Deno.test("IDs novos: rejeitam lixo e prefixos trocados", () => {
  assertEquals(lerMassa("ptmass:abc"), null);
  assertEquals(lerMassa(idMassaOk(PT)), null); // ptmassok não é ptmass
  assertEquals(lerAgregarOk(`ptagrok:${UUID}:${PT}:999`), null); // índice com 3 dígitos
  assertEquals(lerAgregarOk(`ptagrok:nao-uuid:${PT}:3`), null);
  assertEquals(lerSubstituirOk(`ptsubok:${UUID}:${PT}:3:22`), null); // faltou o código
  assertEquals(lerSubstituirOk(`ptsubok:${UUID}:${PT}:3:22:<s>`), null);
  assertEquals(lerMenuSubstituir(idSelecaoRemocao(UUID, PT, 3, "M24")), null); // ptsub não é ptsubm
});

Deno.test("todos os custom_id cabem nos 100 caracteres do Discord (pior caso)", () => {
  const todos = [
    idSelecaoOutras(PT),
    idMassa(PT),
    idMassaOk(PT),
    idAgregarOk(UUID, PT, 22),
    idMenuSubstituir(UUID, PT, 22, "ZZZ"),
    idSelecaoRemocao(UUID, PT, 22, "ZZZ"),
    idSubstituirOk(UUID, PT, 22, 22, "ZZZ"),
  ];
  for (const id of todos) assert(id.length <= 100, `${id.length} caracteres: ${id}`);
});

// ------------------------------------------------------------ telas

const componentesDe = (t: { components: Array<{ components: unknown[] }> }) => t.components.flatMap((l) => l.components);

Deno.test("tela do catálogo: só vaga aberta -> 1 lista; com outras classes -> 2 listas", () => {
  const so1 = montarTelaCatalogo({ abertas: [opcao(1)], outras: [], ptMsgId: PT });
  assertEquals(so1.components.length, 1);
  const as2 = montarTelaCatalogo({ abertas: [opcao(1)], outras: [opcao(2, "FURA-BRUMA")], ptMsgId: PT });
  assertEquals(as2.components.length, 2);
});

Deno.test("tela do catálogo: botão 'Convidar todos' só aparece se há quem convidar em massa, e mostra quantos", () => {
  const sem = montarTelaCatalogo({ abertas: [opcao(1)], outras: [], ptMsgId: PT, qtdMassa: 0 });
  assertEquals(sem.components.length, 1);
  const com = montarTelaCatalogo({ abertas: [opcao(1)], outras: [], ptMsgId: PT, qtdMassa: 3 });
  assertEquals(com.components.length, 2);
  assert(JSON.stringify(com.components[1]).includes("Convidar todos (3)"));
});

Deno.test("tela do catálogo: só 'outras classes' (PT cheia) também funciona e explica que é agregar", () => {
  const t = montarTelaCatalogo({ abertas: [], outras: [opcao(1, "FURA-BRUMA")], ptMsgId: PT, aviso: "PT cheia" });
  assertEquals(t.components.length, 1);
  assert(t.embeds[0].description!.includes("PT cheia"));
  assert(t.embeds[0].description!.includes("1 por 1"));
});

Deno.test("tela do catálogo: nunca mostra menção nem id de usuário, nas duas listas", () => {
  const t = montarTelaCatalogo({ abertas: [opcao(1)], outras: [opcao(2, "FURA-BRUMA")], ptMsgId: PT, qtdMassa: 1 });
  assert(!/<@!?\d+>/.test(JSON.stringify(t)));
});

Deno.test("tela de escolha: oferece Agregar, Substituir e Voltar", () => {
  const t = montarTelaEscolhaOutra("M24", "FURA-BRUMA", UUID, PT, 3);
  assertEquals(componentesDe(t).length, 3);
  const txt = t.embeds[0].description!;
  assert(txt.includes("Agregar") && txt.includes("Substituir") && txt.includes("cresce") && txt.includes("mantém o tamanho"));
  assert(txt.includes("só é criada se a pessoa"), "tem que deixar claro que a vaga só nasce se ela aceitar");
});

Deno.test("tela de substituir: lista as vagas livres; sem nenhuma, oferece só agregar", () => {
  const com = montarTelaMenuSubstituir({
    codigo: "M24", classe: "FURA-BRUMA", dispId: UUID, ptMsgId: PT, ci: 3,
    livres: [{ rotulo: "BADÔNICO", indice: 0 }, { rotulo: "MAIN HEALER", indice: 4 }],
  });
  assert(JSON.stringify(com.components[0]).includes("Apagar uma vaga livre de BADÔNICO"));
  const sem = montarTelaMenuSubstituir({ codigo: "M24", classe: "FURA-BRUMA", dispId: UUID, ptMsgId: PT, ci: 3, livres: [] });
  assert(sem.embeds[0].description!.includes("Agregar"));
  assertEquals(componentesDe(sem).length, 2); // Agregar + Voltar, sem lista
});

Deno.test("tela de confirmar substituição: diz o que será apagado e que depende do aceite", () => {
  const t = montarTelaConfirmarSubstituir({ codigo: "M24", classe: "FURA-BRUMA", remover: "BADÔNICO", dispId: UUID, ptMsgId: PT, ci: 3, cr: 0 });
  const txt = t.embeds[0].description!;
  assert(txt.includes("FURA-BRUMA") && txt.includes("apagando uma vaga livre de BADÔNICO") && txt.includes("aceitar"));
  assert(JSON.stringify(t).includes(idSubstituirOk(UUID, PT, 3, 0, "M24")));
});

Deno.test("tela da massa: lista quem recebe e avisa que gasta UMA tentativa (5 por PT, 1 a cada 5 min)", () => {
  const t = montarTelaMassa([{ codigo: "M24", classe: "BADÔNICO" }, { codigo: "K7P", classe: "MAIN HEALER" }], PT);
  const txt = t.embeds[0].description!;
  assert(txt.includes("#M24") && txt.includes("#K7P"));
  assert(txt.includes("1 tentativa") && txt.includes("5 minutos") && txt.includes("5 tentativas"));
});

// ------------------------------------------------------------ o que o líder lê depois

// Os textos usam **negrito** do Discord; os testes olham o conteúdo, não a formatação.
const semNegrito = (texto: string) => texto.replace(/\*\*/g, "");

Deno.test("formatarEspera: segundos, minutos e combinação", () => {
  assertEquals(formatarEspera(45), "45 s");
  assertEquals(formatarEspera(120), "2 min");
  assertEquals(formatarEspera(272), "4 min 32 s");
});

Deno.test("resumo: 1 enviado mostra a validade e as tentativas usadas", () => {
  const t = semNegrito(resumirEnvio({ resultados: [{ status: "enviado" }], tentativas: { usadas: 2, max: 5 } }));
  assert(t.includes("1 convite enviado") && t.includes("3 minutos") && t.includes("2/5") && t.includes("5 minutos"));
});

Deno.test("resumo: em massa mistura enviados e não enviados, explicando cada motivo", () => {
  const t = semNegrito(resumirEnvio({
    resultados: [{ status: "enviado" }, { status: "enviado" }, { status: "indisponivel" }, { status: "ja_convidado" }],
  }));
  assert(t.includes("2 convites enviados"));
  assert(t.includes("já não está mais disponível") && t.includes("já foi convidada"));
});

Deno.test("resumo: ninguém recebeu -> diz o porquê, sem fingir sucesso", () => {
  const t = resumirEnvio({ resultados: [{ status: "indisponivel" }] });
  assert(t.startsWith("😕 Nenhum convite foi enviado"));
  assert(!t.includes("enviado!"));
});

Deno.test("resumo: bloqueio por tempo diz quanto esperar", () => {
  const t = resumirEnvio({ resultados: [], bloqueio: { motivo: "espere", esperaSeg: 272, tentativas: 2 } });
  assert(t.includes("4 min 32 s") && t.includes("1 envio a cada 5 minutos") && t.includes("2/5"));
});

Deno.test("resumo: bloqueio pelo limite manda pro chat (sem prometer 'tente de novo')", () => {
  const t = semNegrito(resumirEnvio({ resultados: [], bloqueio: { motivo: "limite", esperaSeg: 0, tentativas: 5 } }));
  assert(t.includes("5 tentativas") && t.includes("chat"));
  assert(!/aguarde|espere/i.test(t), "esperar não resolve depois do limite");
});

Deno.test("resumo: Pool fora do ar não vira 'convite enviado'", () => {
  assert(resumirEnvio(null).startsWith("⚠️ Não consegui falar com o Pool"));
});
