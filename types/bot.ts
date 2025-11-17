import { Timestamp } from "firebase-admin/firestore";

export type BotStatus = "IDLE" | "WORKFLOW" | "AGENT";

export interface ContactData {
  phoneNumber: string;
  name?: string;
  botStatus: BotStatus;
  currentStep?: string | null;
  activeTalkId?: string | null;
  lastInboundAt?: Timestamp; // 🕒 Novo campo crucial
  createdAt?: Timestamp;
}
