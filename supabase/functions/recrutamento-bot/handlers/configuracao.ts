// configuracao.ts - Comando /recrutamento-config (subcomandos: canal, cargo,
// autorizar, desautorizar, status).
//
//   Quem usa:      administradores do servidor + autorizados por eles.
//   Quem autoriza: SÓ administrador (autorizado não delega).
//
// A checagem de permissão lê o banco, então a resposta é "pensando..." na hora
// (só quem usou vê) e o resultado vem em seguida — igual ao resto do bot.
import {
  autorizar,
  definirCanal,
  definirCargoMembro,
  definirCargoRecrutador,
  desautorizar,
  obterConfig,
  permissoesDe,
  TipoAutorizado,
} from "../db/config.ts";
import { ConfigRow } from "../db/client.ts";
import { contextoDoMembro } from "../discord/membro.ts";
import { deferredReply } from "../discord/responses.ts";
import { editarRespostaOriginal } from "../discord/rest.ts";
import { DiscordInteraction, OpcaoComando } from "../discord/types.ts";
import { podeConfigurar, podeGerenciarAutorizados } from "../domain/permissoes.ts";
import { HandlerResult } from "./context.ts";

const SEM_PERMISSAO =
  "❌ Só **administradores** do servidor (ou pessoas autorizadas por eles) podem usar esse comando.";
const SO_ADMIN = "❌ Só um **administrador** do servidor pode autorizar ou remover autorizados.";

function valorDa(opcoes: OpcaoComando[] | undefined, nome: string): string | undefined {
  return opcoes?.find((o) => o.name === nome)?.value;
}

const lista = (ids: string[], marcador: (id: string) => string) =>
  ids.length > 0 ? ids.map(marcador).join(", ") : "nenhum";

export function formatarStatus(config: ConfigRow | null): string {
  const canal = config?.canal_recrutadores_id ? `<#${config.canal_recrutadores_id}>` : "❌ não definido";
  const cargo = config?.cargo_recrutador_id ? `<@&${config.cargo_recrutador_id}>` : "❌ não definido";
  const membro = config?.cargo_membro_id ? `<@&${config.cargo_membro_id}>` : "❌ não definido";

  let texto = `**⚙️ Configuração do recrutamento**\n` +
    `📥 Canal dos recrutadores: ${canal}\n` +
    `🛡️ Cargo @Recrutador: ${cargo}\n` +
    `🪪 Cargo de Membro (dado na aprovação): ${membro}\n\n` +
    `**👥 Autorizados a configurar** (além dos administradores)\n` +
    `• Usuários: ${lista(config?.autorizados_usuarios ?? [], (id) => `<@${id}>`)}\n` +
    `• Cargos: ${lista(config?.autorizados_cargos ?? [], (id) => `<@&${id}>`)}`;

  if (!config?.canal_recrutadores_id) {
    texto += `\n\n⚠️ Falta definir o **canal** — sem ele o formulário não consegue enviar candidaturas.`;
  }
  return texto;
}

export function handleConfig(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const ctx = contextoDoMembro(interaction);
  const sub = interaction.data?.options?.[0];

  return {
    immediate: deferredReply(true),
    background: async () => {
      // parse: [] = nenhuma menção dispara notificação (só aparecem como texto).
      const responder = (content: string) =>
        editarRespostaOriginal(applicationId, token, { content, allowed_mentions: { parse: [] } });

      if (!guildId) {
        await responder("⚠️ Esse comando só funciona dentro de um servidor.");
        return;
      }

      const config = await obterConfig(guildId);
      if (!podeConfigurar(ctx, permissoesDe(config))) {
        await responder(SEM_PERMISSAO);
        return;
      }

      switch (sub?.name) {
        case "canal": {
          const canalId = valorDa(sub.options, "canal");
          if (!canalId) return await responder("⚠️ Escolha um canal.");
          await definirCanal(guildId, canalId, ctx.userId);
          await responder(
            `✅ Canal dos recrutadores definido: <#${canalId}>\n` +
              `O bot precisa de **Ver Canal**, **Enviar Mensagens** e **Inserir Links** nesse canal.`,
          );
          return;
        }

        case "cargo": {
          const cargoId = valorDa(sub.options, "cargo");
          if (!cargoId) return await responder("⚠️ Escolha um cargo.");
          await definirCargoRecrutador(guildId, cargoId, ctx.userId);
          await responder(
            `✅ Cargo recrutador definido: <@&${cargoId}>\n` +
              `Quem tem esse cargo pode Aprovar/Recusar. Pra ele ser **notificado** a cada candidatura, ` +
              `o cargo precisa estar como "permitir que qualquer pessoa mencione este cargo".`,
          );
          return;
        }

        case "membro": {
          const cargoId = valorDa(sub.options, "cargo");
          if (!cargoId) return await responder("⚠️ Escolha um cargo.");
          await definirCargoMembro(guildId, cargoId, ctx.userId);
          await responder(
            `✅ Cargo de membro definido: <@&${cargoId}>\n` +
              `Quem for **aprovado** recebe esse cargo e o apelido do jogo. Para isso funcionar, o bot precisa das ` +
              `permissões **Gerenciar Cargos** e **Gerenciar Apelidos**, e o cargo do bot precisa estar ` +
              `**acima** desse cargo na lista de cargos do servidor.`,
          );
          return;
        }

        case "autorizar":
        case "desautorizar": {
          if (!podeGerenciarAutorizados(ctx)) return await responder(SO_ADMIN);

          const usuarioId = valorDa(sub.options, "usuario");
          const cargoId = valorDa(sub.options, "cargo");
          if ((usuarioId && cargoId) || (!usuarioId && !cargoId)) {
            return await responder("⚠️ Informe **um** alvo: ou o `usuario` ou o `cargo` (não os dois, não nenhum).");
          }
          const tipo: TipoAutorizado = usuarioId ? "usuario" : "cargo";
          const alvo = (usuarioId ?? cargoId)!;
          const mencao = usuarioId ? `<@${alvo}>` : `<@&${alvo}>`;

          if (sub.name === "autorizar") {
            await autorizar(guildId, tipo, alvo, ctx.userId);
            await responder(`✅ ${mencao} agora pode usar \`/recrutamento-config\` e \`/recrutamento-painel\`.`);
          } else {
            await desautorizar(guildId, tipo, alvo, ctx.userId);
            await responder(`✅ ${mencao} não está mais autorizado a configurar.`);
          }
          return;
        }

        case "status":
          await responder(formatarStatus(config));
          return;

        default:
          await responder("⚠️ Subcomando desconhecido.");
      }
    },
  };
}
