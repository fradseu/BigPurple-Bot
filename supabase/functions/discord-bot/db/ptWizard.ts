// ptWizard.ts - Estado do assistente de criação de PT (Passo 1 -> 2 -> 3).
// Substitui o `Map` em memória (`criacaoPT`) do v1: aqui cada passo lê e
// grava no Postgres, porque cada requisição da Edge Function é isolada.

import { obterClienteSupabase } from "./client.ts";

export interface DadosWizard {
  canalId: string;
  titulo: string;
  data: string;
  hora: string;
  atividades: string[];
  cidade: string;
  zona: string;
  temTier: boolean | null;
  tier: string;
  precisaSkip: boolean | null;
  classesAtivas: string[] | null;
  classeFocada: string | null;
  funcoes: Record<string, number>;
  // Passo 3 por árvore: árvore aberta no seletor de armas e se já está na tela de quantidades.
  // Opcionais: sessões criadas antes da troca não têm.
  arvoreAberta?: string | null;
  emQuantidades?: boolean;
}

export function estadoInicial(canalId: string): DadosWizard {
  return {
    canalId,
    titulo: "",
    data: "",
    hora: "",
    atividades: [],
    cidade: "",
    zona: "",
    temTier: null,
    tier: "Livre",
    precisaSkip: null,
    classesAtivas: null,
    classeFocada: null,
    funcoes: {},
  };
}

export async function criarEstadoWizard(
  liderId: string,
  canalId: string,
): Promise<DadosWizard> {
  const dados = estadoInicial(canalId);
  await salvarEstadoWizard(liderId, dados);
  return dados;
}

export async function obterEstadoWizard(liderId: string): Promise<DadosWizard | null> {
  const supabase = obterClienteSupabase();
  const { data, error } = await supabase
    .from("pt_wizard_state")
    .select("dados")
    .eq("lider_id", liderId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao ler estado do wizard: ${error.message}`);
  if (!data) return null;
  return data.dados as unknown as DadosWizard;
}

export async function salvarEstadoWizard(
  liderId: string,
  dados: DadosWizard,
): Promise<void> {
  const supabase = obterClienteSupabase();
  const { error } = await supabase
    .from("pt_wizard_state")
    .upsert({
      lider_id: liderId,
      dados: dados as unknown as Record<string, unknown>,
      atualizado_em: new Date().toISOString(),
    });

  if (error) throw new Error(`Erro ao salvar estado do wizard: ${error.message}`);
}

export async function apagarEstadoWizard(liderId: string): Promise<void> {
  const supabase = obterClienteSupabase();
  const { error } = await supabase.from("pt_wizard_state").delete().eq("lider_id", liderId);
  if (error) throw new Error(`Erro ao apagar estado do wizard: ${error.message}`);
}
