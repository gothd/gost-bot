// packages/lib/constants.ts

export const CONTACT_EMAIL = "contato@ruasvivas.com.br";

export const PLATFORM_NAME = "Gothd";
export const PROJECT_NAME = "Göst bot";
export const OWNER_NAME = process.env.NEXT_PUBLIC_OWNER_NAME || "Ruan";
export const BOT_NAME = process.env.NEXT_PUBLIC_AGENT_NAME || "Göst";

// URLs públicas
export const TERMS_URL = "/termos";
export const PRIVACY_URL = "/privacidade";

export const WINDOW_HOURS_MS = 24 * 60 * 60 * 1000; // 24 horas em milissegundos
export const EXIT_TO_AGENT_ID = "EXIT_TO_AGENT"; // ID constante para a ação de sair

export const PROGRESS_PREFIX = "✅ ";
export const TITLE_MAX_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 72;
