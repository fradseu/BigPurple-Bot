// fama.ts - Ler e formatar valores de fama ("1,33b", "850m", "1.330.000.000").

const MULTIPLICADORES: Record<string, number> = {
  k: 1e3,
  mil: 1e3,
  m: 1e6,
  mi: 1e6,
  mm: 1e6,
  milhao: 1e6,
  milhoes: 1e6,
  b: 1e9,
  bi: 1e9,
  bn: 1e9,
  bilhao: 1e9,
  bilhoes: 1e9,
};

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Converte "1,33b" / "1.33bn" / "850 m" / "166500000" em número. null = não entendi.
export function lerFamaDeclarada(texto: string): number | null {
  const limpo = semAcento(texto.toLowerCase()).replace(/\s+/g, "");
  const m = limpo.match(/^([\d.,]+)([a-z]*)$/);
  if (!m) return null;

  const [, numeroBruto, sufixo] = m;
  const multiplicador = sufixo === "" ? 1 : MULTIPLICADORES[sufixo];
  if (multiplicador === undefined) return null;

  const numero = lerNumero(numeroBruto, sufixo !== "");
  if (numero === null) return null;
  return Math.round(numero * multiplicador);
}

const SO_DIGITOS = /^\d+$/; // 1330
const DECIMAL = /^\d+[.,]\d+$/; // 1,33 | 1.33 (UM separador)
const MILHAR = /^\d{1,3}([.,]\d{3})+$/; // 1.330.000 | 1,330,000
const MILHAR_E_DECIMAL = /^\d{1,3}([.,]\d{3})+[.,]\d+$/; // 1.234,5

// Só aceita formatos inequívocos — melhor devolver null (vira aviso pro
// recrutador) do que adivinhar errado ("1,3,3," já virou 133 bilhões numa
// versão mais permissiva).
function lerNumero(bruto: string, temSufixo: boolean): number | null {
  if (SO_DIGITOS.test(bruto)) return Number(bruto);

  if (!temSufixo) {
    // Sem sufixo, ponto/vírgula só podem ser separador de milhar.
    return MILHAR.test(bruto) ? Number(bruto.replace(/[.,]/g, "")) : null;
  }

  // Com sufixo ("1,33b"), UM separador é decimal — mesmo com 3 casas ("1.234m").
  if (DECIMAL.test(bruto)) return Number(bruto.replace(",", "."));
  if (MILHAR.test(bruto)) return Number(bruto.replace(/[.,]/g, ""));
  if (MILHAR_E_DECIMAL.test(bruto)) {
    const ultimo = Math.max(bruto.lastIndexOf("."), bruto.lastIndexOf(","));
    return Number(`${bruto.slice(0, ultimo).replace(/[.,]/g, "")}.${bruto.slice(ultimo + 1)}`);
  }
  return null;
}

// 1330000000 -> "1,33b" | 166514438 -> "166,51m" | 12300 -> "12,3k"
export function formatarFama(valor: number): string {
  const abreviar = (n: number, sufixo: string) =>
    `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${sufixo}`;

  if (valor >= 1e9) return abreviar(valor / 1e9, "b");
  if (valor >= 1e6) return abreviar(valor / 1e6, "m");
  if (valor >= 1e3) return abreviar(valor / 1e3, "k");
  return String(Math.round(valor));
}
