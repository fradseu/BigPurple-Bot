// permissoes.ts - Quem pode fazer o quê. Funções PURAS (sem Discord, sem banco):
// recebem só os dados já extraídos, então dá pra testar todas as combinações.
//
//   Administrador         -> tudo (configurar, autorizar, aprovar/recusar)
//   Autorizado (usuário   -> configurar canal/cargo e postar o painel,
//   ou cargo da lista)       MAS não mexe na lista de autorizados
//   Cargo @Recrutador     -> aprovar / recusar / atualizar dossiê

const PERMISSAO_ADMINISTRADOR = 1n << 3n;

// Quem está agindo, já extraído da interação.
export interface ContextoMembro {
  userId: string;
  roles: string[];
  permissoes?: string; // bitfield como string (passa de 53 bits, por isso BigInt)
}

// O que nos interessa da configuração do servidor.
export interface ConfigPermissoes {
  cargoRecrutadorId: string | null;
  autorizadosUsuarios: string[];
  autorizadosCargos: string[];
}

// Administrador (o dono do servidor vem com todos os bits ligados).
export function ehAdministrador(permissoes?: string): boolean {
  if (!permissoes) return false;
  try {
    return (BigInt(permissoes) & PERMISSAO_ADMINISTRADOR) !== 0n;
  } catch {
    return false; // valor mal formado nunca vira permissão
  }
}

// Pode configurar (canal, cargo, painel): administrador ou autorizado.
export function podeConfigurar(ctx: ContextoMembro, config: ConfigPermissoes | null): boolean {
  if (ehAdministrador(ctx.permissoes)) return true;
  if (!config) return false;
  if (config.autorizadosUsuarios.includes(ctx.userId)) return true;
  return ctx.roles.some((r) => config.autorizadosCargos.includes(r));
}

// Pode mexer na lista de autorizados: SÓ administrador. Autorizado não
// delega — senão qualquer autorizado poderia promover outros (escalada).
export function podeGerenciarAutorizados(ctx: ContextoMembro): boolean {
  return ehAdministrador(ctx.permissoes);
}

// Pode decidir candidaturas: administrador ou quem tem o cargo @Recrutador.
export function ehRecrutador(ctx: ContextoMembro, config: ConfigPermissoes | null): boolean {
  if (ehAdministrador(ctx.permissoes)) return true;
  if (!config?.cargoRecrutadorId) return false;
  return ctx.roles.includes(config.cargoRecrutadorId);
}
