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
 * 📝 Representa uma linha do relatório final
 */
export interface QuestSummaryItem {
  stepId: string; // "q1"
  question: string; // "Qual é o principal objetivo do seu site?" (Contexto preservado)
  answer: string; // "Vender produtos" (Legível)
}

/**
 * 📋 Interface para o documento 'quests/{questId}'
 */
export interface QuestData {
  talkId: string;
  responses: Record<string, string>; // IDs (para lógica/score)

  // O relatório completo e imutável para o consultor
  summary: QuestSummaryItem[];

  // Analytics
  progress: string;
  totalSteps: number;
  score: number;
  category: "ECOMMERCE" | "INSTITUCIONAL" | "LANDING_PAGE" | "OUTROS";
  priority: "HIGH" | "MEDIUM" | "LOW";

  submittedAt: FieldValue | Timestamp;
  status: "COMPLETED" | "REVIEWED" | "ARCHIVED";
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
