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
  updateBotStatus,
} from "./firebaseService";
import { getMainMenuRows, quizDictionary } from "./quizFlow";
import { normalizeText, truncateWhatsAppText } from "./textUtils";

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
    // 1. Busca o contato principal para obter o ID da conversa ativa
    const contact = await getOrCreateContact(to, "");

    // 2. Busca os dados do quiz da conversa ativa (USANDO A NOVA FUNÇÃO)
    const talkId = contact.activeTalkId;
    const currentResponses = await getActiveQuizData(to, talkId ?? null);

    await updateBotStatus(to, "IDLE", null); // Limpa o passo e o status WORKFLOW

    // 3. Obtém as linhas do menu base
    const baseRows = getMainMenuRows();

    // 4. Mapeia as linhas para adicionar a marca de progresso
    const rows: ListRow[] = baseRows.map((row) => {
      const readableAnswer = currentResponses[row.id];

      const PROGRESS_PREFIX = "✅ ";
      const TITLE_MAX_LENGTH = 20;
      const DESCRIPTION_MAX_LENGTH = 72; // Limite de caracteres para a descrição

      let newTitle: string;

      // 1. TRUNCAGEM DO TITLE (Limite: 20)
      if (readableAnswer) {
        // Se respondido: usa prefixo
        newTitle = truncateWhatsAppText(row.title, TITLE_MAX_LENGTH, PROGRESS_PREFIX);
      } else {
        // Se não respondido: sem prefixo
        newTitle = truncateWhatsAppText(row.title, TITLE_MAX_LENGTH, "");
      }

      // 2. TRUNCAGEM DA DESCRIPTION (Limite: 72)
      let newDescription: string;

      if (readableAnswer) {
        // Se respondido, a descrição mostra a resposta do usuário
        const answerText = `Sua resposta: ${readableAnswer}`;
        newDescription = truncateWhatsAppText(answerText, DESCRIPTION_MAX_LENGTH, "");
      } else {
        // Se não respondido, usa a descrição padrão da linha (se existir)
        newDescription = row.description
          ? truncateWhatsAppText(row.description, DESCRIPTION_MAX_LENGTH, "")
          : ""; // Garante string vazia se row.description for undefined
      }

      return {
        id: row.id,
        title: newTitle,
        description: newDescription,
      };
    });

    await sendWhatsAppList(
      to,
      "Selecione uma etapa para responder ou editar. As etapas respondidas são marcadas com ✅.",
      "Ver etapas",
      "Progresso do Orçamento",
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
   * 3. Recebe a resposta de uma pergunta de OPÇÕES (ex: "q1_vendas")
   */
  handleQuizAnswer: async (to: string, answerId: string) => {
    // 🚨 INTERCEPTAÇÃO DE SAÍDA
    if (answerId === EXIT_TO_AGENT_ID) {
      await botConfig.transferToAgent(to);
      return;
    }

    const questionId = answerId.split("_")[0]; // "q1"
    const step = quizDictionary[questionId];
    // ⚠️ Tratamento de erro: Se o step não é válido, voltamos ao menu principal (caminho seguro)
    if (!step || step.type !== "options" || !step.options) {
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

    // 🔍 BUSCA DO TEXTO LEGÍVEL
    const selectedOption = step.options.find((option) => option.id === answerId);
    const readableAnswer = selectedOption?.title || answerId; // Usa o título ou o ID como fallback

    // ⚠️ Tratamento de erro: Se o ID da resposta não for encontrado na lista de opções
    if (!readableAnswer) {
      console.warn(
        `[QUIZ] Opção ${answerId} não encontrada para ${questionId}. Repetindo pergunta.`
      );
      await botConfig.safeSendMessage(to, {
        type: "text",
        text: { body: "❌ Opção inválida. Por favor, selecione uma das opções abaixo:" },
      });
      // Repete a pergunta atual, dando ao usuário uma nova chance
      await botConfig.askQuizQuestion(to, questionId);
      return;
    }

    console.log(`[QUIZ] Resposta de ${to} para ${questionId}: ${readableAnswer} (${answerId})`);

    // 💾 Salva o TEXTO LEGÍVEL como a resposta no Firestore
    await saveQuizResponse(to, questionId, readableAnswer);

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
