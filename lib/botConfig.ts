import {
  sendDynamicTemplate,
  sendSubmenuCriarSite,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendWhatsAppMessage,
} from "./whatsappService";

import { ButtonOption, ListRow } from "@/types/whatsapp";
// 🚨 Importações corrigidas para o Firebase Service
import { EXIT_TO_AGENT_ID } from "./constants";
import {
  canBotReply,
  closeCurrentTalk,
  getOrCreateContact,
  saveQuizResponse,
  updateBotStatus,
} from "./firebaseService";
import { getMainMenuRows, quizDictionary } from "./quizFlow";
import { normalizeText } from "./textUtils";

export const botConfig = {
  // Função utilitária segura de envio
  safeSendMessage: async (to: string, message: any) => {
    const canReply = await canBotReply(to);
    if (!canReply) {
      console.error(`[24H POLICY] Abortando envio para ${to}. Janela fechada.`);
      await closeCurrentTalk(to); // Garante limpeza
      return;
    }
    await sendWhatsAppMessage(to, message);
    // E salva no histórico (opcionalmente aqui ou fora)
    // await saveMessage(from, JSON.stringify(message), 'OUTBOUND');
  },

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
    console.warn("[FALLBACK]", { from: to, reason: reason, rawMessage });
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
    await updateBotStatus(to, "IDLE", null); // Limpa o passo e o status WORKFLOW
    const rows = getMainMenuRows();
    await sendWhatsAppList(to, "Vamos começar! Selecione uma etapa:", "Ver etapas", "Etapas", rows);
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

    // Opção extra de saída
    const exitOption: ButtonOption & { description?: string } = {
      id: EXIT_TO_AGENT_ID,
      title: "Falar com consultor",
      description: "Encerrar quiz e pedir atendimento humano", // Apenas para listas
    };

    if (step.type === "options" && step.options) {
      const allOptions = [...step.options, exitOption];

      if (allOptions.length <= 3) {
        await sendWhatsAppButtons(to, step.question, allOptions);
      } else {
        const rows: ListRow[] = allOptions.map((o) => ({
          id: o.id,
          title: o.title,
          description: o.description ?? undefined,
        }));
        await sendWhatsAppList(to, step.question, "Ver opções", "Escolha uma", rows);
      }
    } else if (step.type === "text") {
      // Salva o estado
      await updateBotStatus(to, "WORKFLOW", step.id);

      await sendWhatsAppMessage(to, {
        type: "text",
        text: {
          body: `${step.question}\n\n(Digite *humano* a qualquer momento para falar com um consultor)`,
        },
      });
    }
  },

  /**
   * 3. Recebe a resposta de uma pergunta de OPÇÕES (ex: "q1_vendas")
   */
  handleQuizAnswer: async (to: string, answerId: string) => {
    // 🚨 INTERCEPTAÇÃO DE SAÍDA
    if (answerId === EXIT_TO_AGENT_ID) {
      await botConfig.transferToAgent(to);
      return;
    }

    const questionId = answerId.split("_")[0]; // "q1"
    console.log(`[QUIZ] Resposta de ${to} para ${questionId}: ${answerId}`);

    // Aqui salvamos o ID da opção (ex: "q1_vendas").
    // Se quiser salvar o texto legível ("Vender produtos"), precisaria buscar no dicionário.
    await saveQuizResponse(to, questionId, answerId);

    // Após salvar, envia o menu principal de volta
    await botConfig.safeSendMessage(to, { type: "text", text: { body: "✅ Resposta salva!" } });
    await botConfig.startQuiz(to);
  },

  /**
   * 4. Recebe a resposta de uma pergunta de TEXTO
   */
  handleFreeTextAnswer: async (to: string, text: string, rawMessage: any) => {
    // 🚨 INTERCEPTAÇÃO DE SAÍDA VIA TEXTO
    const normalizedText = normalizeText(text);
    if (normalizedText.includes("humano") || normalizedText.includes("consultor")) {
      await botConfig.transferToAgent(to);
      return;
    }

    const contact = await getOrCreateContact(to, "");
    const currentQuestionId = contact.currentStep;

    if (currentQuestionId) {
      console.log(`[QUIZ] Resposta (texto) de ${to} para ${currentQuestionId}: ${text}`);

      await saveQuizResponse(to, currentQuestionId, text);

      // Limpa o estado no FIRESTORE e volta ao menu
      await updateBotStatus(to, "IDLE", null);

      await botConfig.safeSendMessage(to, { type: "text", text: { body: "✅ Resposta anotada!" } });
      await botConfig.startQuiz(to);
    } else {
      // Se não há currentStep, o bot não estava esperando texto do quiz.
      await botConfig.fallback(to, "Texto não reconhecido", rawMessage);
    }
  },

  /**
   * 5. Transfere para o Agente (Novo Status)
   */
  transferToAgent: async (to: string) => {
    await updateBotStatus(to, "AGENT", null);
    await botConfig.safeSendMessage(to, {
      type: "text",
      text: {
        body: "Entendido! Vou chamar um de nossos consultores para analisar o que você já respondeu e te ajudar.\n\nAguarde um momento.",
      },
    });
    // Aqui você poderia notificar o admin via email/slack/push se quisesse
  },

  /**
   * Avisa o usuário que o quiz está sendo retomado e envia a pergunta.
   */
  notifyAndAskQuestion: async (to: string, stepId: string) => {
    const step = quizDictionary[stepId];
    if (!step) return;

    // 1. Mensagem de Contexto (O que ele deve fazer)
    await botConfig.safeSendMessage(to, {
      type: "text",
      text: {
        body: `Olá novamente! Você parou na etapa *${step.title}*. Por favor, continue para que possamos finalizar seu orçamento.`,
      },
    });

    // 2. Envia a pergunta real
    await botConfig.askQuizQuestion(to, stepId);
  },
};
