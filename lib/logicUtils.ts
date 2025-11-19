import { QuestSummaryItem } from "@/types/bot";
import { quizDictionary } from "./quizFlow";

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

/**
 * Calcula a pontuação do Lead com base nas respostas
 */
export function calculateLeadScore(responses: Record<string, string>): number {
  let score = 0;

  // Regra 1: Orçamento (Q6) é o fator mais forte
  const budget = responses["q6"];
  if (budget === "q6_c") score += 50; // Acima de 5k
  else if (budget === "q6_b") score += 30; // 2k a 5k
  else if (budget === "q6_a") score += 10; // Até 2k

  // Regra 2: Prazo (Q4 - Texto)
  // Lógica simples de detecção de urgência em texto
  const deadline = normalizeText(responses["q4"] || "");
  if (
    deadline.includes("urgente") ||
    deadline.includes("ontem") ||
    deadline.includes("imediatamente")
  ) {
    score += 20;
  }

  // Regra 3: Conteúdo Pronto (Q2)
  const content = responses["q2"];
  if (content === "q2_sim") score += 10; // Projeto anda mais rápido

  return score;
}

/**
 * Categoriza o projeto
 */
export function categorizeProject(responses: Record<string, string>): string {
  const features = responses["q3"]; // Funcionalidades
  const objective = responses["q1"]; // Objetivo

  if (features === "q3_ecommerce" || objective === "q1_vendas") return "ECOMMERCE";
  if (features === "q3_blog") return "BLOG/NEWS";
  if (objective === "q1_leads") return "LANDING_PAGE";

  return "INSTITUCIONAL";
}

/**
 * 🔄 Converte um ID de resposta (ex: "q1_vendas") para o texto legível (ex: "Vender produtos").
 * Se for uma pergunta de texto livre ou o ID não for achado, retorna o próprio valor.
 */
export function getReadableResponse(questionId: string, answerId: string): string {
  const step = quizDictionary[questionId];

  // Se não achou a etapa ou não tem opções (é texto livre), retorna o próprio texto
  if (!step || !step.options) {
    return answerId;
  }

  // Procura a opção com esse ID
  const option = step.options.find((opt) => opt.id === answerId);

  // Retorna o título se achou, ou o ID como fallback
  return option ? option.title : answerId;
}

/**
 * 📸 Gera um Snapshot completo (Pergunta + Resposta Legível) para histórico.
 */
export function generateQuestSummary(responseIds: Record<string, string>): QuestSummaryItem[] {
  return Object.entries(responseIds)
    .filter(([stepId]) => {
      // 🛡️ FILTRO DE SEGURANÇA:
      // 1. Ignora explicitamente o campo de metadado 'updatedAt'
      if (stepId === "updatedAt") return false;

      // 2. Verifica se o ID realmente existe no dicionário (evita lixo)
      return !!quizDictionary[stepId];
    })
    .map(([stepId, answerId]) => {
      const step = quizDictionary[stepId];

      // Obtém a resposta legível usando sua função existente
      const readableAnswer = getReadableResponse(stepId, answerId);

      return {
        stepId: stepId,
        question: step?.question,
        answer: readableAnswer,
      };
    });
}
