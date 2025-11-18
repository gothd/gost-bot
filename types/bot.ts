import type { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * 🤖 Status do Bot e Handoff. Define quem está no controle da conversa.
 */
export type BotStatus =
  | "IDLE" // O bot não está esperando resposta específica.
  | "WORKFLOW" // O bot está em um fluxo (Quiz) e espera uma resposta para 'currentStep'.
  | "HUMAN_PENDING" // O usuário solicitou transferência. Bot está mutado, aguardando agente.
  | "HUMAN_ACTIVE" // O agente humano assumiu a conversa. Bot está mutado.
  | "CLOSED"; // A conversa foi encerrada pelo agente.

/**
 * 👤 Interface principal do documento 'contacts/{from}'.
 * Armazena o estado atual da conversa.
 */
export interface ContactData {
  phoneNumber: string;
  name?: string;
  botStatus: BotStatus;
  currentStep?: string | null; // ID da etapa atual do Quiz (apenas usado em WORKFLOW)
  activeTalkId?: string | null; // ID do documento Talk atual (contacts/{from}/talks/{talkId})
  lastInboundAt?: Timestamp; // 🕒 Timestamp da última mensagem recebida (Crucial para a política de 24h)
  createdAt?: Timestamp;
}

/**
 * 💬 Interface do documento 'talks/{talkId}'.
 * Representa uma sessão de conversa.
 */
export interface TalkData {
  quizData?: Record<string, string>; // Respostas estruturadas do Quiz
  updatedAt?: FieldValue;
  // createdAt, closedAt, source, etc. (Outros campos opcionais)
}

/**
 * 📄 Interface para o documento 'messages/{messageId}' (na subcoleção da Talk).
 * Armazena o histórico da conversa.
 */
export interface MessageData {
  messageId: string;
  direction: "INBOUND" | "OUTBOUND"; // Se a mensagem veio do cliente ou foi enviada pelo bot/humano
  type: string; // Ex: text, interactive, image, etc.
  content: string; // Conteúdo da mensagem (texto ou JSON/URI)
  timestamp: Timestamp;
  // Qualquer metadado extra (lida, falhou, etc.)
}
