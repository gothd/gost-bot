// --- Componentes Reutilizáveis ---

export interface WhatsAppProfile {
  name: string;
}

export interface WhatsAppContact {
  profile: WhatsAppProfile;
  wa_id: string;
}

export interface WhatsAppText {
  body: string;
}

export interface WhatsAppInteractiveButtonReply {
  id: string;
  title: string;
}

export interface WhatsAppInteractiveListReply {
  id: string;
  title: string;
  description?: string;
}

// 🔴 AQUI ESTÁ A MUDANÇA MÁGICA
// Dividimos em duas interfaces estritas

export interface WhatsAppInteractiveButton {
  type: "button_reply";
  button_reply: WhatsAppInteractiveButtonReply; // Obrigatório aqui!
}

export interface WhatsAppInteractiveList {
  type: "list_reply";
  list_reply: WhatsAppInteractiveListReply; // Obrigatório aqui!
}

// Unimos as duas
export type WhatsAppInteractive = WhatsAppInteractiveButton | WhatsAppInteractiveList;

// Mídias
export interface WhatsAppImage {
  id: string;
  caption?: string;
  mime_type: string;
  sha256?: string;
}
export interface WhatsAppAudio {
  id: string;
  mime_type: string;
  sha256?: string;
}
export interface WhatsAppVideo {
  id: string;
  caption?: string;
  mime_type: string;
  sha256?: string;
}
export interface WhatsAppDocument {
  id: string;
  filename?: string;
  caption?: string;
  mime_type: string;
  sha256?: string;
}
export interface WhatsAppSticker {
  id: string;
  mime_type: string;
  sha256?: string;
}

// Template Button (Quick Reply em Templates)
export interface WhatsAppTemplateButton {
  payload: string;
  text: string;
}

// --- Interfaces Específicas por Tipo ---

// 1. Interface Base (campos comuns a todas)
interface WhatsAppMessageBase {
  from: string;
  id: string;
  timestamp: string;
  context?: { id: string; from: string }; // Contexto de resposta
}

// 2. Definições Específicas (Discriminated Unions)
export interface WhatsAppMessageText extends WhatsAppMessageBase {
  type: "text"; // 👈 O Discriminador
  text: WhatsAppText; // 👈 Agora é obrigatório!
}

export interface WhatsAppMessageInteractive extends WhatsAppMessageBase {
  type: "interactive";
  interactive: WhatsAppInteractive;
}

export interface WhatsAppMessageButton extends WhatsAppMessageBase {
  type: "button"; // Resposta de botão de Template
  button: WhatsAppTemplateButton;
}

export interface WhatsAppMessageImage extends WhatsAppMessageBase {
  type: "image";
  image: WhatsAppImage;
}

export interface WhatsAppMessageAudio extends WhatsAppMessageBase {
  type: "audio";
  audio: WhatsAppAudio;
}

export interface WhatsAppMessageVideo extends WhatsAppMessageBase {
  type: "video";
  video: WhatsAppVideo;
}

export interface WhatsAppMessageDocument extends WhatsAppMessageBase {
  type: "document";
  document: WhatsAppDocument;
}

export interface WhatsAppMessageSticker extends WhatsAppMessageBase {
  type: "sticker";
  sticker: WhatsAppSticker;
}

// Fallback para tipos que você não mapeou (location, reaction, system, etc.)
export interface WhatsAppMessageUnknown extends WhatsAppMessageBase {
  type: "unknown" | "reaction" | "location" | "system" | "order";
  // Deixa opcional para não quebrar se chegar algo novo
  [key: string]: any;
}

// --- A União Discriminada Final ---
export type WhatsAppMessage =
  | WhatsAppMessageText
  | WhatsAppMessageInteractive
  | WhatsAppMessageButton
  | WhatsAppMessageImage
  | WhatsAppMessageAudio
  | WhatsAppMessageVideo
  | WhatsAppMessageDocument
  | WhatsAppMessageSticker
  | WhatsAppMessageUnknown;

// --- Estruturas do Webhook ---

export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
  timestamp: string;
}

export interface WhatsAppValue {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[]; // 👈 Usa a União aqui
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppChange {
  field: "messages";
  value: WhatsAppValue;
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppWebhookBody {
  object: "whatsapp_business_account";
  entry: WhatsAppEntry[];
}

// --- Tipagens de Envio (Payload) (Mantidas) ---

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ButtonOption {
  id: string;
  title: string;
}

export interface WhatsAppPayload {
  to: string;
  text: string;
  buttons?: ButtonOption[];
}
