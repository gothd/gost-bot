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
