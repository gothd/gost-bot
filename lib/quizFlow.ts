import { ButtonOption, ListRow } from "@/types/whatsapp";

/** O tipo de pergunta: de múltipla escolha ou texto aberto */
export type QuestionType = "options" | "text";

/** A definição de uma única etapa do questionário */
export interface QuizStep {
  id: string; // O ID principal (ex: "q1", "q2")
  title: string; // O título que aparece no menu principal (ex: "Objetivo do site")
  question: string; // A pergunta real a ser feita (ex: "Qual é o principal objetivo?")
  type: QuestionType;
  options?: ButtonOption[]; // As opções de resposta (se o tipo for "options")
}

/**
 * O "DICIONÁRIO"
 * Aqui você define TODO o fluxo de perguntas.
 * A chave é o ID da etapa (ex: "q1").
 */
export const quizDictionary: Record<string, QuizStep> = {
  q1: {
    id: "q1",
    title: "Objetivo do site",
    question: "Qual é o principal objetivo do seu site?",
    type: "options",
    options: [
      { id: "q1_vendas", title: "Vender produtos" },
      { id: "q1_leads", title: "Gerar leads" },
      { id: "q1_portfolio", title: "Portfólio/Institucional" },
    ],
  },
  q2: {
    id: "q2",
    title: "Conteúdo pronto",
    question: "Você já tem os textos e imagens para o site?",
    type: "options",
    options: [
      { id: "q2_sim", title: "Sim, tudo pronto" },
      { id: "q2_parcial", title: "Tenho alguma coisa" },
      { id: "q2_nao", title: "Não, preciso de ajuda" },
    ],
  },
  q3: {
    id: "q3",
    title: "Funcionalidades",
    question: "Quais funcionalidades extras você precisa? (Selecione a principal)",
    type: "options",
    options: [
      { id: "q3_blog", title: "Blog" },
      { id: "q3_ecommerce", title: "Loja virtual" },
      { id: "q3_agendamento", title: "Agendamento" },
      { id: "q3_membros", title: "Área de membros" }, // > 3 opções, vai virar lista!
    ],
  },
  q4: {
    id: "q4",
    title: "Prazo",
    question: "Certo! E qual é o seu prazo ideal para o lançamento do site?",
    type: "text", // Pergunta de texto aberto
    // Sem 'options'
  },
  q5: {
    id: "q5",
    title: "Inspirações",
    question: "Me envie até 3 links de sites que você gosta (mesmo que de outro ramo).",
    type: "text",
  },
  q6: {
    id: "q6",
    title: "Orçamento",
    question: "Qual é a sua faixa de orçamento estimada para este projeto?",
    type: "options",
    options: [
      { id: "q6_a", title: "Até R$ 2.000" },
      { id: "q6_b", title: "R$ 2.000 - R$ 5.000" },
      { id: "q6_c", title: "Acima de R$ 5.000" },
    ],
  },
};

/**
 * Função auxiliar para gerar as linhas do menu principal
 * com base no dicionário.
 */
export function getMainMenuRows(): ListRow[] {
  return Object.values(quizDictionary).map((step) => ({
    id: step.id, // "q1", "q2", etc.
    title: step.title,
    description: "Toque para responder esta etapa",
  }));
}
