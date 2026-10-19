// wizard.ts - Estado do formulário "Ficar disponível" (áreas, atividades, classes,
// tier, duração) e as regras puras de validação. Cada lista do formulário é uma
// interação separada, então o estado acumula escolha por escolha.
import {
  AREAS,
  atividadesDasAreas,
  CLASSES,
  DURACOES_MIN,
  MAX_ATIVIDADES,
  MAX_CLASSES,
  TIERS,
} from "../config.ts";

export interface EstadoWizard {
  areas: string[];
  atividades: string[];
  classes: string[];
  tier: string | null;
  duracaoMin: number | null;
}

export type CampoWizard = "areas" | "atividades" | "classes" | "tier" | "duracao";

export const DURACAO_PADRAO_MIN = 120;

export function estadoInicial(): EstadoWizard {
  return { areas: [], atividades: [], classes: [], tier: null, duracaoMin: DURACAO_PADRAO_MIN };
}

// Aceita só valores que existem nas listas (o payload vem do cliente — nunca
// confiar) e respeita o máximo de escolhas de cada campo.
export function aplicarSelecao(
  estado: EstadoWizard,
  campo: CampoWizard,
  valores: string[],
): EstadoWizard {
  switch (campo) {
    case "areas": {
      const validas = new Set(AREAS.map((a) => a.value));
      const areas = unicos(valores).filter((v) => validas.has(v));
      // Trocar de área pode tornar algumas atividades já escolhidas sem sentido: poda.
      const permitidas = new Set(atividadesDasAreas(areas).map((a) => a.value));
      return { ...estado, areas, atividades: estado.atividades.filter((a) => permitidas.has(a)) };
    }
    case "atividades": {
      // Só as atividades das áreas escolhidas (ou todas, se ainda não escolheu área).
      const validas = new Set(atividadesDasAreas(estado.areas).map((a) => a.value));
      return { ...estado, atividades: unicos(valores).filter((v) => validas.has(v)).slice(0, MAX_ATIVIDADES) };
    }
    case "classes": {
      const validas = new Set(CLASSES);
      return { ...estado, classes: unicos(valores).filter((v) => validas.has(v)).slice(0, MAX_CLASSES) };
    }
    case "tier": {
      const tier = valores.find((v) => TIERS.includes(v)) ?? null;
      return { ...estado, tier: tier ?? estado.tier };
    }
    case "duracao": {
      const minutos = valores.map(Number).find((m) => DURACOES_MIN.some((d) => d.minutos === m));
      return { ...estado, duracaoMin: minutos ?? estado.duracaoMin };
    }
  }
}

function unicos(valores: string[]): string[] {
  return [...new Set(valores)];
}

// O que ainda falta escolher (em português, pra mostrar na tela).
export function itensFaltando(estado: EstadoWizard): string[] {
  const faltando: string[] = [];
  if (estado.areas.length === 0) faltando.push("área");
  if (estado.atividades.length === 0) faltando.push("atividade");
  if (estado.classes.length === 0) faltando.push("classe");
  if (!estado.tier) faltando.push("tier");
  if (!estado.duracaoMin) faltando.push("duração");
  return faltando;
}

export function wizardCompleto(estado: EstadoWizard): boolean {
  return itensFaltando(estado).length === 0;
}

export function calcularExpiracao(agoraMs: number, minutos: number): Date {
  return new Date(agoraMs + minutos * 60_000);
}

// Valida o JSON vindo do banco (jsonb) — se estiver corrompido, recomeça do zero.
// A ordem importa: áreas primeiro, porque as atividades válidas dependem delas.
export function lerEstado(bruto: unknown): EstadoWizard {
  if (!bruto || typeof bruto !== "object") return estadoInicial();
  const o = bruto as Record<string, unknown>;
  const lista = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  let estado = estadoInicial();
  estado = aplicarSelecao(estado, "areas", lista(o.areas));
  estado = aplicarSelecao(estado, "atividades", lista(o.atividades));
  estado = aplicarSelecao(estado, "classes", lista(o.classes));
  if (typeof o.tier === "string") estado = aplicarSelecao(estado, "tier", [o.tier]);
  if (typeof o.duracaoMin === "number") estado = aplicarSelecao(estado, "duracao", [String(o.duracaoMin)]);
  return estado;
}
