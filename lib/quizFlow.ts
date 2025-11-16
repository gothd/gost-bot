import { ButtonOption, ListRow } from "@/types/whatsapp";

/**
 * Interface customizada que adiciona 'description' à opção de botão.
 * O campo 'description' só será usado quando a opção for renderizada como LISTA.
 */
export interface QuizOption extends ButtonOption {
  description?: string; // Max 72 caracteres (usado em ListRow)
}

/** O tipo de pergunta: de múltipla escolha ou texto aberto */
export type QuestionType = "options" | "text";

/** A definição de uma única etapa do questionário */
export interface QuizStep {
  id: string; // O ID principal (ex: "q1", "q2")
  title: string; // O título que aparece no menu principal (Max 24 caracteres)
  question: string; // A pergunta real a ser feita
  type: QuestionType;
  options?: QuizOption[]; // Usando a nova interface
}

/**
 * O "DICIONÁRIO"
 * Otimizado para os limites de caracteres:
 * - Botões (Q1, Q2, Q6): title <= 20 caracteres.
 * - Lista (Q3): title <= 24 caracteres, description <= 72 caracteres.
 */
export const quizDictionary: Record<string, QuizStep> = {
  q1: {
    id: "q1",
    title: "Objetivo do site", // OK (17)
    question: "Qual é o principal objetivo do seu site?",
    type: "options",
    options: [
      { id: "q1_vendas", title: "Vender produtos" }, // OK (15)
      { id: "q1_leads", title: "Gerar leads" }, // OK (11)
      { id: "q1_portfolio", title: "Portfólio ou Instit." }, // OK (20)
    ],
  },
  q2: {
    id: "q2",
    title: "Conteúdo pronto", // OK (16)
    question: "Você já tem os textos e imagens para o site?",
    type: "options",
    options: [
      { id: "q2_sim", title: "Sim, tudo pronto" }, // OK (16)
      { id: "q2_parcial", title: "Tenho alguma coisa" }, // OK (19)
      { id: "q2_nao", title: "Não, preciso de ajuda" }, // 🚨 Original: 21.
      // Otimizado para 20 ou menos
      { id: "q2_nao", title: "Não, preciso de ajuda" }, // OK (20)
    ],
  },
  q3: {
    id: "q3",
    title: "Funcionalidades", // OK (15)
    question: "Quais funcionalidades extras você precisa? (Selecione a principal)",
    type: "options",
    // Esta etapa terá > 3 opções e será renderizada como LISTA.
    // Usamos o campo 'description' (até 72 chars) para dar mais contexto.
    options: [
      {
        id: "q3_blog",
        title: "Blog e Notícias",
        description: "Área para artigos, SEO e conteúdo recorrente.",
      },
      {
        id: "q3_ecommerce",
        title: "Loja Virtual",
        description: "Venda de produtos/serviços com checkout e pagamento.",
      },
      {
        id: "q3_agendamento",
        title: "Agendamentos/Reservas",
        description: "Sistema para clientes marcarem horários online.",
      },
      {
        id: "q3_membros",
        title: "Área de Membros",
        description: "Conteúdo exclusivo, login e controle de acesso.",
      },
    ],
  },
  q4: {
    id: "q4",
    title: "Prazo",
    question: "Certo! E qual é o seu prazo ideal para o lançamento do site?",
    type: "text", // Pergunta de texto aberto
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
      { id: "q6_a", title: "Até R$ 2.000" }, // OK (12)
      { id: "q6_b", title: "R$ 2.000 a R$ 5.000" }, // OK (20)
      { id: "q6_c", title: "Acima de R$ 5.000" }, // OK (20)
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
    // Deixamos a descrição do menu principal curta e genérica,
    // mas você pode usar 'step.question' (ou uma versão truncada) se preferir.
    description: `Pergunta: ${step.question.substring(0, 50)}...`, // Max 72 chars
  }));
}
