// Tipagens para o webhook do WhatsApp Business API v24.0

export interface WhatsAppText {
  body?: string;
}

export interface WhatsAppInteractiveButtonReply {
  id?: string;
  title?: string;
}

export interface WhatsAppInteractiveListReply {
  id?: string;
  title?: string;
  description?: string;
}

export interface WhatsAppInteractive {
  type?: "button_reply" | "list_reply";
  button_reply?: WhatsAppInteractiveButtonReply;
  list_reply?: WhatsAppInteractiveListReply;
}

export interface WhatsAppImage {
  id?: string;
  caption?: string;
  mime_type?: string;
  sha256?: string;
}

export interface WhatsAppAudio {
  id?: string;
  mime_type?: string;
  sha256?: string;
}

export interface WhatsAppVideo {
  id?: string;
  caption?: string;
  mime_type?: string;
  sha256?: string;
}

export interface WhatsAppDocument {
  id?: string;
  filename?: string;
  caption?: string;
  mime_type?: string;
  sha256?: string;
}

export interface WhatsAppSticker {
  id?: string;
  mime_type?: string;
  sha256?: string;
}

export interface WhatsAppMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: WhatsAppText;
  image?: WhatsAppImage;
  audio?: WhatsAppAudio;
  video?: WhatsAppVideo;
  document?: WhatsAppDocument;
  sticker?: WhatsAppSticker;
  interactive?: WhatsAppInteractive;
}

export interface WhatsAppValue {
  messages?: WhatsAppMessage[];
}

export interface WhatsAppChange {
  value?: WhatsAppValue;
}

export interface WhatsAppEntry {
  changes?: WhatsAppChange[];
}

export interface WhatsAppWebhookBody {
  entry?: WhatsAppEntry[];
}

export interface ListRow {
  id: string;
  title: string;
  description?: string; // opcional, pode dar mais contexto
}

// Tipagens para endpoint send do WhatsApp Business API v24.0

export interface ButtonOption {
  id: string;
  title: string;
}

export interface WhatsAppPayload {
  to: string;
  text: string;
  buttons?: ButtonOption[];
}
