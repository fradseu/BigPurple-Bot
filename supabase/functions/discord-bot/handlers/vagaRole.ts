// vagaRole.ts - Select "🎭 Sua função" do painel público. O jogador marca a função na própria
// vaga (igual aos bônus); o líder escolhe a função e, numa lista só pra ele, os jogadores.
import { deferredUpdate, reply } from "../discord/responses.ts";
import { buscarMembro, buscarMensagem, editarMensagem, editarRespostaOriginal, nomeExibicaoMembro } from "../discord/rest.ts";
import { DiscordInteraction, SelectOption, actionRow, getInteractionUserId } from "../discord/types.ts";
import { ROLES_PAINEL } from "../config.ts";
import { aplicarRole, linhasDosJogadores, listarJogadoresInscritos } from "../domain/vagas.ts";
import {
  HandlerResult,
  extrairLiderIdDoCriador,
  extrairLinhasVagasDoEmbed,
  extrairOpcoesDropdownInscricao,
  reconstruirEmbedVagas,
} from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

const PREFIXO_ALVO = "vaga_role_alvo:";
const SEM_ROLE = "-";

type Mensagem = DiscordInteraction["message"];

function roleValida(valor: string): string | null | undefined {
  if (valor === SEM_ROLE) return null;
  return ROLES_PAINEL.some((r) => r.value === valor) ? valor : undefined;
}

async function gravarRoles(canalId: string, mensagem: Mensagem, mencoes: string[], role: string | null, guildId?: string) {
  const linhas = extrairLinhasVagasDoEmbed(mensagem);
  for (const i of linhasDosJogadores(linhas, mencoes)) linhas[i] = aplicarRole(linhas[i], role);
  const componentes = await atualizarComponentesPainel(
    linhas,
    mensagem!.content,
    extrairOpcoesDropdownInscricao(mensagem),
    guildId,
  );
  await editarMensagem(canalId, mensagem!.id, {
    embeds: [reconstruirEmbedVagas(mensagem, linhas)],
    components: componentes,
  });
}

export function handleRolePainel(interaction: DiscordInteraction): HandlerResult {
  const role = roleValida(interaction.data?.values?.[0] ?? "");
  if (role === undefined) return { immediate: deferredUpdate() };

  const userId = getInteractionUserId(interaction);
  const mensagem = interaction.message!;
  const canalId = interaction.channel_id!;
  const guildId = interaction.guild_id;
  const linhas = extrairLinhasVagasDoEmbed(mensagem);
  const inscritos = listarJogadoresInscritos(linhas);
  const ehLider = extrairLiderIdDoCriador(mensagem.content) === userId;

  if (ehLider) {
    if (inscritos.length === 0) {
      return { immediate: reply("Ainda não tem ninguém inscrito nessa PT.", { ephemeral: true }) };
    }
    // Lista só pro líder: pra quem vai essa função.
    return {
      immediate: reply("Carregando os inscritos...", { ephemeral: true }),
      background: async () => {
        const opcoes: SelectOption[] = [];
        for (const { mention, cargo } of inscritos.slice(0, 25)) {
          const id = mention.replace(/[<@!>]/g, "");
          const nome = guildId ? nomeExibicaoMembro(await buscarMembro(guildId, id), id) : id;
          opcoes.push({ label: `${nome} — ${cargo}`.slice(0, 100), value: mention });
        }
        const rotulo = role ? ROLES_PAINEL.find((r) => r.value === role)!.label : "sem função";
        await editarRespostaOriginal(interaction.application_id, interaction.token, {
          content: `🎭 Marcar **${rotulo}** para quem?`,
          components: [
            actionRow({
              type: 3 as const,
              custom_id: `${PREFIXO_ALVO}${mensagem.id}:${role ?? SEM_ROLE}`,
              placeholder: "Escolha os jogadores",
              min_values: 1,
              max_values: opcoes.length,
              options: opcoes,
            }),
          ],
        });
      },
    };
  }

  if (!inscritos.some((j) => j.mention.replace(/[<@!>]/g, "") === userId)) {
    return { immediate: reply("⚠️ Entre em uma vaga antes de escolher sua função.", { ephemeral: true }) };
  }
  return {
    immediate: deferredUpdate(),
    background: () => gravarRoles(canalId, mensagem, [`<@${userId}>`], role, guildId),
  };
}

export function lerRoleAlvo(customId: string): { ptMsgId: string; role: string | null } | null {
  if (!customId.startsWith(PREFIXO_ALVO)) return null;
  const [ptMsgId, valor] = customId.slice(PREFIXO_ALVO.length).split(":");
  const role = roleValida(valor ?? "");
  if (!ptMsgId || role === undefined) return null;
  return { ptMsgId, role };
}

export function handleRoleAlvo(interaction: DiscordInteraction, alvo: { ptMsgId: string; role: string | null }): HandlerResult {
  const userId = getInteractionUserId(interaction);
  const canalId = interaction.channel_id!;
  const mencoes = interaction.data?.values ?? [];
  return {
    immediate: deferredUpdate(),
    background: async () => {
      const pt = (await buscarMensagem(canalId, alvo.ptMsgId)) as Mensagem | null;
      const fim = (content: string) =>
        editarRespostaOriginal(interaction.application_id, interaction.token, { content, components: [] });
      if (!pt) return void (await fim("Não encontrei o painel dessa PT."));
      if (extrairLiderIdDoCriador(pt.content) !== userId) return void (await fim("Só o líder pode marcar a função dos outros."));
      await gravarRoles(canalId, pt, mencoes, alvo.role, interaction.guild_id);
      const rotulo = alvo.role ? ROLES_PAINEL.find((r) => r.value === alvo.role)!.label : "sem função";
      await fim(`✅ ${rotulo} marcada para ${mencoes.length} jogador(es).`);
    },
  };
}
