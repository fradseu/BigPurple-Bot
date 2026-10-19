// context.ts - Contrato de retorno dos handlers: o que responder AGORA (dentro
// dos 3s do Discord) e, opcionalmente, o trabalho pesado pra rodar depois.
import { InteractionResponse } from "../discord/types.ts";

export interface HandlerResult {
  immediate: InteractionResponse;
  background?: () => Promise<void>;
}
