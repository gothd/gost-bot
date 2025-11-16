import {
  sendDynamicTemplate,
  sendSubmenuCriarSite,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendWhatsAppMessage,
} from "./whatsappService";

import { ListRow } from "@/types/whatsapp";
import { getMainMenuRows, quizDictionary } from "./quizFlow"; // Importe seu novo dicionário

// ⚠️ GERENCIAMENTO DE ESTADO (Importante!)
// Para perguntas de 'type: "text"', você precisa saber
// qual pergunta o usuário está respondendo.
// Em produção, use um BD (Redis, Firestore, etc.)
// Aqui, vamos usar um Map simples para simular:
export const userState = new Map<string, { currentQuestion: string | null }>();

export const botConfig = {
  greetings: async (to: string, customerName: string) => {
    await sendDynamicTemplate({
      to: to,
      templateName: "welcome_gost_gothd",
      headerText: customerName,
    });
  },

  criar_site: async (to: string) => {
    await sendSubmenuCriarSite(to);
  },

  fallback: async (to: string, reason?: string, rawMessage?: any) => {
    // 🚨 Log de auditoria
    console.warn("[FALLBACK]", {
      from: to,
      reason: reason || "Texto/Interação não reconhecida",
      rawMessage,
    });

    // Reapresenta o menu
    await sendWhatsAppMessage(to, {
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: "Não entendi 🤔. Por favor, escolha uma das opções abaixo:",
        },
        action: {
          buttons: [{ type: "reply", reply: { id: "criar_site", title: "Criar site" } }],
        },
      },
    });
  },

  /**
   * 1. Inicia o questionário (chamado quando o usuário clica em "Começar agora")
   */
  startQuiz: async (to: string) => {
    const rows = getMainMenuRows(); // Pega as linhas do quizFlow.ts

    // Reseta o estado
    userState.set(to, { currentQuestion: null });

    // Usa sua função auxiliar diretamente
    await sendWhatsAppList(
      to,
      "Vamos começar! Selecione uma etapa para avançar nas perguntas.",
      "Ver etapas", // Label do botão
      "Etapas do projeto", // Título da seção
      rows
    );
  },

  /**
   * 2. Faz uma pergunta específica do quiz (chamado quando o usuário clica em "q1", "q2", etc.)
   */
  askQuizQuestion: async (to: string, questionId: string) => {
    const step = quizDictionary[questionId];
    if (!step) {
      await botConfig.fallback(to, "Etapa do quiz não encontrada");
      return;
    }

    // Se for pergunta de múltipla escolha
    if (step.type === "options" && step.options) {
      // Reutiliza a lógica que você tinha em sendQuestionMenu:
      // Se tiver 3 ou menos opções, envia botões
      if (step.options.length <= 3) {
        await sendWhatsAppButtons(to, step.question, step.options);
      } else {
        // Se tiver mais de 3, envia lista
        const rows: ListRow[] = step.options.map((o) => ({
          id: o.id,
          title: o.title,
          // 👉 Adicionar o mapeamento da descrição 👈
          description: o.description ?? undefined,
        }));

        await sendWhatsAppList(to, step.question, "Ver opções", "Escolha uma", rows);
      }
    }
    // Se for pergunta de texto aberto
    else if (step.type === "text") {
      // ⚠️ Salva o estado! Agora sabemos que o próximo texto é a resposta para "q4"
      userState.set(to, { currentQuestion: step.id });
      await sendWhatsAppMessage(to, {
        type: "text",
        text: { body: step.question },
      });
    }
  },

  /**
   * 3. Recebe a resposta de uma pergunta de OPÇÕES (ex: "q1_vendas")
   */
  handleQuizAnswer: async (to: string, answerId: string) => {
    // Ex: answerId = "q1_vendas"
    const questionId = answerId.split("_")[0]; // "q1"

    console.log(`[QUIZ] Resposta de ${to} para ${questionId}: ${answerId}`);
    // TODO: Salvar a resposta no seu banco de dados
    // (ex: saveUserAnswer(from, questionId, answerId))

    // Após salvar, envia o menu principal de volta
    // (Opcional: você pode incrementar para mostrar quais já foram respondidas)
    await sendWhatsAppMessage(to, { type: "text", text: { body: "✅ Resposta salva!" } });
    await botConfig.startQuiz(to); // Volta ao menu principal
  },

  /**
   * 4. Recebe a resposta de uma pergunta de TEXTO
   */
  handleFreeTextAnswer: async (to: string, text: string, rawMessage: any) => {
    const state = userState.get(to);
    const currentQuestionId = state?.currentQuestion; // Ex: "q4"

    if (currentQuestionId) {
      console.log(`[QUIZ] Resposta (texto) de ${to} para ${currentQuestionId}: ${text}`);
      // TODO: Salvar a resposta no seu banco de dados
      // (ex: saveUserAnswer(from, currentQuestionId, text))

      // Limpa o estado e volta ao menu
      userState.set(to, { currentQuestion: null });
      await sendWhatsAppMessage(to, { type: "text", text: { body: "✅ Resposta anotada!" } });
      await botConfig.startQuiz(to); // Volta ao menu principal
    } else {
      // É um texto aleatório, não uma resposta de quiz
      await botConfig.fallback(to, "Texto não reconhecido", rawMessage);
    }
  },

  sendMessage: sendWhatsAppMessage,
};
