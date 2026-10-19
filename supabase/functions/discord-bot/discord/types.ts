// types.ts - Definições mínimas da API do Discord que usamos.
// Sem discord.js aqui: só os formatos JSON crus que a API espera/devolve.
// Referência: https://discord.com/developers/docs/interactions/message-components

export enum ComponentType {
  ActionRow = 1,
  Button = 2,
  StringSelect = 3,
  TextInput = 4,
}

export enum ButtonStyle {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
}

export enum TextInputStyle {
  Short = 1,
  Paragraph = 2,
}

export enum InteractionType {
  Ping = 1,
  ApplicationCommand = 2,
  MessageComponent = 3,
  ApplicationCommandAutocomplete = 4,
  ModalSubmit = 5,
}

export enum InteractionResponseType {
  Pong = 1,
  ChannelMessageWithSource = 4,
  DeferredChannelMessageWithSource = 5,
  DeferredUpdateMessage = 6,
  UpdateMessage = 7,
  Modal = 9,
}

export interface DiscordEmoji {
  id?: string | null;
  name?: string | null;
  animated?: boolean;
}

export interface ButtonComponent {
  type: ComponentType.Button;
  style: ButtonStyle;
  label?: string;
  custom_id?: string;
  emoji?: DiscordEmoji;
  disabled?: boolean;
  url?: string;
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: DiscordEmoji;
  default?: boolean;
}

export interface StringSelectComponent {
  type: ComponentType.StringSelect;
  custom_id: string;
  options: SelectOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
}

export interface TextInputComponent {
  type: ComponentType.TextInput;
  custom_id: string;
  style: TextInputStyle;
  label: string;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
  placeholder?: string;
}

export type ActionRowChild =
  | ButtonComponent
  | StringSelectComponent
  | TextInputComponent;

export interface ActionRowComponent {
  type: ComponentType.ActionRow;
  components: ActionRowChild[];
}

export function actionRow(...components: ActionRowChild[]): ActionRowComponent {
  return { type: ComponentType.ActionRow, components };
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  image?: { url: string };
  footer?: { text: string; icon_url?: string };
}

export interface InteractionCallbackData {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: ActionRowComponent[];
  flags?: number;
  custom_id?: string;
  title?: string;
}

export interface InteractionResponse {
  type: InteractionResponseType;
  data?: InteractionCallbackData;
}

export const MESSAGE_FLAG_EPHEMERAL = 1 << 6;

// Payload cru que o Discord manda pra função (subset do que a gente usa)
export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: InteractionType;
  token: string;
  guild_id?: string;
  channel_id?: string;
  // Canal onde a interação aconteceu. Quando é um tópico (PT), `parent_id` é o canal de ping.
  channel?: { id: string; parent_id?: string | null };
  member?: { user: DiscordUser; nick?: string | null };
  user?: DiscordUser;
  data?: {
    id?: string;
    name?: string;
    custom_id?: string;
    component_type?: ComponentType;
    values?: string[];
    components?: Array<{
      type: ComponentType;
      components: Array<{ type: ComponentType; custom_id: string; value: string }>;
    }>;
  };
  message?: {
    id: string;
    content: string;
    components?: ActionRowComponent[];
    embeds?: DiscordEmbed[];
  };
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
}

export function getInteractionUserId(interaction: DiscordInteraction): string {
  const id = interaction.member?.user?.id ?? interaction.user?.id;
  if (!id) throw new Error("Interação sem user id (nem member.user nem user)");
  return id;
}
