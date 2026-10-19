// permissoes.ts - Quem pode configurar o pool: só Administrador do servidor.
// (O pool é aberto a todos os membros pra se oferecerem; só o painel do canal
// é restrito.) Função PURA, testada.

const PERMISSAO_ADMINISTRADOR = 1n << 3n;

// Administrador (o dono do servidor vem com todos os bits ligados).
export function ehAdministrador(permissoes?: string): boolean {
  if (!permissoes) return false;
  try {
    return (BigInt(permissoes) & PERMISSAO_ADMINISTRADOR) !== 0n;
  } catch {
    return false; // valor mal formado nunca vira permissão
  }
}
