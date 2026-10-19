// aprovacao.ts - O que o bot FAZ no servidor quando uma candidatura é aprovada:
//   1. muda o apelido da pessoa pro nick do jogo (fica igual ao Albion, pra dar
//      pra comparar depois se ela ainda está na guilda)
//   2. dá o cargo de Membro (se configurado com /recrutamento-config membro)
//
// A decisão (aprovada) já foi gravada ANTES de chamar isso. Se algo falhar aqui
// (permissão, hierarquia de cargos, pessoa que saiu do servidor), a aprovação
// continua valendo e o recrutador recebe o motivo — nunca perde a decisão.
import { CandidaturaRow, ConfigRow } from "../db/client.ts";
import { registrarApelidoAplicado } from "../db/candidaturas.ts";
import { adicionarCargo, definirApelido } from "../discord/rest.ts";
import {
  apelidoParaMembro,
  nomeNoJogo,
  traduzirErroDiscord,
} from "../domain/aprovacao.ts";

export interface ResultadoAprovacao {
  apelido: string;
  apelidoAplicado: boolean;
  cargoAplicado: boolean | null; // null = cargo de Membro não configurado
  avisos: string[]; // o que o recrutador precisa saber / resolver
}

function textoDoErro(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function aplicarAprovacao(params: {
  guildId: string;
  candidatura: CandidaturaRow;
  config: ConfigRow | null;
  aprovadoPorNome: string;
}): Promise<ResultadoAprovacao> {
  const { guildId, candidatura, config, aprovadoPorNome } = params;
  const motivo = `Recrutamento: aprovado por ${aprovadoPorNome}`;
  const apelido = apelidoParaMembro(nomeNoJogo(candidatura));
  const avisos: string[] = [];

  if (candidatura.dossie?.status !== "ok") {
    avisos.push(
      "O nick não foi confirmado no Albion — o apelido foi aplicado com o que a pessoa digitou. Confira a grafia.",
    );
  }

  let apelidoAplicado = false;
  try {
    await definirApelido(guildId, candidatura.discord_user_id, apelido, motivo);
    apelidoAplicado = true;
    await registrarApelidoAplicado(candidatura.id, apelido);
  } catch (err) {
    console.error("Erro ao aplicar apelido na aprovação:", err);
    if (!apelidoAplicado) avisos.push(traduzirErroDiscord(textoDoErro(err), "apelido"));
  }

  let cargoAplicado: boolean | null = null;
  if (config?.cargo_membro_id) {
    try {
      await adicionarCargo(guildId, candidatura.discord_user_id, config.cargo_membro_id, motivo);
      cargoAplicado = true;
    } catch (err) {
      console.error("Erro ao dar o cargo de Membro na aprovação:", err);
      cargoAplicado = false;
      avisos.push(traduzirErroDiscord(textoDoErro(err), "cargo"));
    }
  } else {
    avisos.push("O cargo de Membro não está configurado — use `/recrutamento-config membro` e dê o cargo manualmente.");
  }

  return { apelido, apelidoAplicado, cargoAplicado, avisos };
}

// Trecho que entra no rodapé da mensagem aprovada: o que de fato foi aplicado.
export function resumoDaAplicacao(r: ResultadoAprovacao): string {
  const marca = (ok: boolean | null) => ok === null ? "—" : ok ? "✔" : "✖";
  return `Apelido “${r.apelido}” ${marca(r.apelidoAplicado)} · Cargo Membro ${marca(r.cargoAplicado)}`;
}
