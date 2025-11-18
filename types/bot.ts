import type { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * 🤖 Status do Bot e Handoff. Define quem está no controle da conversa.
 */
export type BotStatus = "IDLE" | "WORKFLOW" | "HUMAN_PENDING" | "HUMAN_ACTIVE" | "CLOSED";

/**
 * 👤 Interface principal do documento 'contacts/{from}'.
 */
export interface ContactData {
  phoneNumber: string;
  name?: string;
  botStatus: BotStatus;
  currentStep?: string | null;
  activeTalkId?: string | null;
  lastInboundAt?: Timestamp;
  createdAt?: Timestamp;
}

/**
 * 💬 Interface do documento 'talks/{talkId}'.
 */
export interface TalkData {
  quizData?: Record<string, string>;
  updatedAt?: FieldValue;
  hasSubmittedQuest?: boolean; // Flag opcional para saber se já virou lead
  questId?: string; // Link para o documento na coleção quests
}

/**
 * 📋 Interface para o documento 'quests/{questId}' (subcoleção de contacts).
 * Representa o formulário/lead finalizado ("snapshot" dos dados).
 */
export interface QuestData {
  talkId: string; // Rastreabilidade da conversa de origem
  responses: Record<string, string>; // As respostas consolidadas
  submittedAt: FieldValue | Timestamp; // Data do envio
  status: "COMPLETED" | "REVIEWED" | "ARCHIVED"; // Status do processamento do lead
}

/**
 * 📄 Interface para o documento 'messages/{messageId}'.
 */
export interface MessageData {
  messageId: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  content: string;
  timestamp: Timestamp | FieldValue;
}
