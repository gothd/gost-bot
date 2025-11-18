// packages/lib/textUtils.ts
export function isGreeting(text: string): boolean {
  const greetings = ["oi", "ola", "bom dia", "boa tarde", "boa noite", "salve"];
  return greetings.some((g) => normalizeText(text).includes(g));
}

export function normalizeText(text: string): string {
  return removeAccents(text).trim().toLowerCase();
}

export function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized.split(/\s+/).filter((word) => word.length > 2 && !stopwords.includes(word));
}

const stopwords = ["de", "do", "da", "e", "em", "com", "para", "por", "que", "o", "a", "os", "as"];

/**
 * ✂️ Trunca uma string para caber em um limite de caracteres específico do WhatsApp.
 * Adiciona reticências ao final se truncado e lida com prefixos (como emojis).
 * Limites do WhatsApp: Title (20 caracteres), Description (72 caracteres).
 * @param text O texto base a ser truncado.
 * @param maxLength O limite máximo de caracteres (20 ou 72).
 * @param prefix O prefixo a ser adicionado (ex: "✅ "). Deve ser incluído na contagem.
 * @returns O texto truncado com prefixo e reticências, se necessário.
 */
export function truncateWhatsAppText(text: string, maxLength: number, prefix: string = ""): string {
  const ELLIPSIS = "...";

  // 1. Calcula o espaço disponível para o texto base
  const availableLength = maxLength - prefix.length;

  // 2. Se o texto já couber, retorna com o prefixo
  if ((prefix + text).length <= maxLength) {
    return prefix + text;
  }

  // 3. Se precisar truncar, garante que haja espaço para as reticências
  const truncateTo = availableLength - ELLIPSIS.length;

  // 4. Se truncateTo for <= 0, limita o prefixo + reticências
  if (truncateTo <= 0) {
    return (prefix + ELLIPSIS).substring(0, maxLength);
  }

  // 5. Trunca o texto base e adiciona reticências
  const truncatedText = text.substring(0, truncateTo) + ELLIPSIS;

  return prefix + truncatedText;
}
