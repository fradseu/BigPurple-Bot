// snapshot.ts - Tira o retrato do dia: lê a guilda e os membros no Albion, atualiza quem entrou
// ou saiu e grava uma linha por membro. Rodar duas vezes no mesmo dia só atualiza o retrato
// daquele dia (a última execução vale).
import { createClient } from "@supabase/supabase-js";
import { buscarGuilda, buscarKills, buscarMembros, buscarMortes } from "./albion.ts";
import {
  compararMembros,
  dataDeEntrada,
  diaDeBrasilia,
  montarLinhaSnapshot,
  papelDe,
  resumirKillboard,
} from "./domain.ts";

export interface ResultadoGuilda {
  guilda: string;
  dia: string;
  membros: number;
  novos: number;
  saidas: number;
  killboardFalhou?: number; // membros cujo killboard não veio (killboard_ok = false)
  erro?: string;
}

const LOTE_KILLBOARD = 4;

// Roda `fn` em todos os itens, `tamanho` por vez.
async function emLotes<T>(itens: T[], tamanho: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn));
  }
}

function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

async function tirarRetrato(guildId: string): Promise<ResultadoGuilda> {
  const supabase = db();
  const dia = diaDeBrasilia(Date.now());

  const { data: cfg, error: erroCfg } = await supabase
    .from("guilda_albion").select().eq("albion_guild_id", guildId).single();
  if (erroCfg || !cfg) throw new Error(`Guilda não cadastrada: ${erroCfg?.message}`);

  // As duas chamadas ao Albion ANTES de gravar qualquer coisa: se o Albion estiver fora do ar,
  // não fica retrato pela metade.
  const [guilda, atuais] = await Promise.all([buscarGuilda(guildId), buscarMembros(guildId)]);

  const { data: registrados, error: erroReg } = await supabase
    .from("guilda_membros").select("player_id, nome, ativo").eq("albion_guild_id", guildId);
  if (erroReg) throw new Error(`Erro ao ler membros: ${erroReg.message}`);

  const primeiraExecucao = (registrados ?? []).length === 0;
  const mudancas = compararMembros(registrados ?? [], atuais);
  const entrada = dataDeEntrada(primeiraExecucao, cfg.fundada_em, dia);

  if (mudancas.novos.length > 0) {
    const { error } = await supabase.from("guilda_membros").insert(
      mudancas.novos.map((m) => ({
        albion_guild_id: guildId,
        player_id: m.Id,
        nome: m.Name,
        papel: papelDe(m.Id, m.Name, guilda.FounderId, cfg.conselheiros_nomes ?? []),
        entrada_data: entrada.data,
        entrada_origem: entrada.origem,
      })),
    );
    if (error) throw new Error(`Erro ao registrar membros novos: ${error.message}`);
  }

  if (mudancas.voltaram.length > 0) {
    const { error } = await supabase.from("guilda_membros")
      .update({ ativo: true, saiu_em: null })
      .eq("albion_guild_id", guildId).in("player_id", mudancas.voltaram);
    if (error) throw new Error(`Erro ao reativar membros: ${error.message}`);
  }

  if (mudancas.saiu.length > 0) {
    const { error } = await supabase.from("guilda_membros")
      .update({ ativo: false, saiu_em: dia })
      .eq("albion_guild_id", guildId).in("player_id", mudancas.saiu);
    if (error) throw new Error(`Erro ao marcar saídas: ${error.message}`);
  }

  // Nome mudou no jogo? Mantém o cadastro em dia.
  for (const m of atuais) {
    const antigo = (registrados ?? []).find((r) => r.player_id === m.Id);
    if (antigo && antigo.nome !== m.Name) {
      await supabase.from("guilda_membros").update({ nome: m.Name })
        .eq("albion_guild_id", guildId).eq("player_id", m.Id);
    }
  }

  const { error: erroSnap } = await supabase.from("guilda_snapshots")
    .upsert(atuais.map((m) => montarLinhaSnapshot(guildId, dia, m)), {
      onConflict: "albion_guild_id,player_id,dia",
    });
  if (erroSnap) throw new Error(`Erro ao gravar retratos: ${erroSnap.message}`);

  // Segunda fase: o killboard de cada membro (o que o dossiê também usa). Vem DEPOIS de gravar o
  // retrato principal: se o killboard falhar pra alguém, esse alguém fica com `killboard_ok =
  // false` e o resto do retrato continua valendo. Poucas chamadas ao mesmo tempo, porque a API
  // do Albion é lenta.
  let killboardFalhou = 0;
  await emLotes(atuais, LOTE_KILLBOARD, async (m) => {
    const [kills, mortes] = await Promise.all([
      buscarKills(m.Id).catch(() => null),
      buscarMortes(m.Id).catch(() => null),
    ]);
    const resumo = resumirKillboard(kills, mortes, dia);
    if (!resumo.killboard_ok) killboardFalhou++;
    const { error } = await supabase.from("guilda_snapshots").update(resumo)
      .eq("albion_guild_id", guildId).eq("player_id", m.Id).eq("dia", dia);
    if (error) console.error(`Erro ao gravar killboard de ${m.Name}:`, error.message);
  });

  const { error: erroGuilda } = await supabase.from("guilda_snapshots_guilda").upsert({
    albion_guild_id: guildId,
    dia,
    membros: atuais.length,
    kill_fame: guilda.killFame ?? null,
    death_fame: guilda.DeathFame ?? null,
    ataques_vencidos: guilda.AttacksWon ?? null,
    defesas_vencidas: guilda.DefensesWon ?? null,
  }, { onConflict: "albion_guild_id,dia" });
  if (erroGuilda) throw new Error(`Erro ao gravar retrato da guilda: ${erroGuilda.message}`);

  await supabase.from("guilda_albion").update({ atualizado_em: new Date().toISOString() })
    .eq("albion_guild_id", guildId);

  return {
    guilda: guilda.Name,
    dia,
    membros: atuais.length,
    novos: mudancas.novos.length,
    saidas: mudancas.saiu.length,
    killboardFalhou,
  };
}

// Todas as guildas cadastradas. Uma guilda com erro não impede as outras.
export async function tirarRetratos(): Promise<ResultadoGuilda[]> {
  const { data, error } = await db().from("guilda_albion").select("albion_guild_id, nome");
  if (error) throw new Error(`Erro ao listar guildas: ${error.message}`);

  const resultados: ResultadoGuilda[] = [];
  for (const g of data ?? []) {
    try {
      resultados.push(await tirarRetrato(g.albion_guild_id));
    } catch (err) {
      console.error(`Erro no retrato da guilda ${g.nome}:`, err);
      resultados.push({
        guilda: g.nome,
        dia: diaDeBrasilia(Date.now()),
        membros: 0,
        novos: 0,
        saidas: 0,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return resultados;
}
