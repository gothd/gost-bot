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
  getActiveQuizData,
  getOrCreateContact,
  saveQuizResponse,
  submitQuizAndHandoff,
  updateBotStatus,
} from "./firebaseService";
import { getReadableResponse, normalizeText, truncateWhatsAppText } from "./logicUtils";
import { getMainMenuRows, quizDictionary } from "./quizFlow";

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
    const contact = await getOrCreateContact(to, "");
    const talkId = contact.activeTalkId;
    if (!talkId) {
      await botConfig.fallback(to, "Erro sessão.");
      return;
    }

    // 📦 currentResponses agora contém IDs (ex: { q1: "q1_vendas", q4: "Urgente" })
    const currentResponses = await getActiveQuizData(to, talkId);
    const allQuestions = getMainMenuRows();

    // Filtro de perguntas restantes (Lógica mantida)
    const remainingQuestions = allQuestions.filter((q) => {
      const answer = currentResponses[q.id];
      return !answer || answer === q.id;
    });

    // --- CENÁRIO A: QUIZ CONCLUÍDO (Handoff) ---
    if (remainingQuestions.length === 0) {
      // Chamada Simplificada: Passa apenas os IDs (currentResponses)
      // O service vai gerar o Summary (Pergunta + Resposta Legível) automaticamente.
      await submitQuizAndHandoff(to, talkId, currentResponses);

      await botConfig.safeSendMessage(to, {
        type: "text",
        text: { body: "🎉 Perfeito! Recebemos suas informações...\n(Transferindo...)" },
      });
      return;
    }

    // --- CENÁRIO B: 1 PERGUNTA ---
    if (remainingQuestions.length === 1) {
      const lastId = remainingQuestions[0].id;
      await updateBotStatus(to, "WORKFLOW", lastId);
      await botConfig.askQuizQuestion(to, lastId);
      return;
    }

    // --- CENÁRIO C: MENU (Display) ---
    await updateBotStatus(to, "IDLE", null);

    const rows = allQuestions.map((row) => {
      const rawAnswerId = currentResponses[row.id]; // Pega o ID (q1_vendas)
      const isValid = rawAnswerId && rawAnswerId !== row.id;

      // 🔄 CONVERSÃO PARA DISPLAY: Transforma ID em Texto apenas para mostrar na lista
      const displayAnswer = isValid ? getReadableResponse(row.id, rawAnswerId) : null;

      const PROGRESS_PREFIX = "✅ ";
      // ... constantes de limite ...

      // Title logic
      let newTitle = truncateWhatsAppText(row.title, 20, isValid ? PROGRESS_PREFIX : "");

      // Description logic
      let newDescription = "";
      if (isValid && displayAnswer) {
        // Mostra o texto bonitinho ("Vender produtos") na descrição
        newDescription = truncateWhatsAppText(`Sua resposta: ${displayAnswer}`, 72, "");
      } else {
        newDescription = row.description ? truncateWhatsAppText(row.description, 72, "") : "";
      }

      return { id: row.id, title: newTitle, description: newDescription };
    });

    await sendWhatsAppList(
      to,
      `Faltam ${remainingQuestions.length} etapas...`,
      "Ver etapas",
      "Progresso",
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
   * 3. Handle Quiz Answer (SALVA ID)
   */
  handleQuizAnswer: async (to: string, answerId: string) => {
    if (answerId === EXIT_TO_AGENT_ID) {
      await botConfig.transferToAgent(to);
      return;
    }

    const questionId = answerId.split("_")[0];

    // Validação básica
    const step = quizDictionary[questionId];
    if (!step) {
      console.error(`[QUIZ] Etapa ${questionId} inválida. Retornando ao menu principal.`);
      await botConfig.safeSendMessage(to, {
        type: "text",
        text: {
          body: "🚨 Desculpe, houve um erro. Por favor, selecione uma etapa do menu principal.",
        },
      });
      await botConfig.startQuiz(to);
      return;
    }

    // 🔍 LOG: Apenas para debug, pegamos o legível
    const readableForLog = getReadableResponse(questionId, answerId);
    console.log(`[QUIZ] ID Salvo: ${answerId} ("${readableForLog}")`);

    // 💾 MUDANÇA PRINCIPAL: Salva o ID bruto no Firestore
    await saveQuizResponse(to, questionId, answerId);

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
      // Para texto livre, o ID e o Texto são a mesma coisa
      await saveQuizResponse(to, currentQuestionId, text);

      await updateBotStatus(to, "IDLE", null);
      await botConfig.safeSendMessage(to, { type: "text", text: { body: "✅ Anotado!" } });
      await botConfig.startQuiz(to);
    } else {
      await botConfig.fallback(to, "Texto não reconhecido", rawMessage);
    }
  },

  /**
   * 5. Transfere para o Agente (Novo Status)
   */
  transferToAgent: async (to: string) => {
    await updateBotStatus(to, "HUMAN_PENDING", null);
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
