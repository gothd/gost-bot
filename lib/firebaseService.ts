import { firestore as db } from "@/lib/firestore";
import { BotStatus, ContactData, MessageData, TalkData } from "@/types/bot";
import { WhatsAppMessage } from "@/types/whatsapp"; // ✅ Importação dos tipos do WhatsApp
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { WINDOW_HOURS_MS } from "./constants";

// --- Tipos de Retorno para o Roteador ---

export interface RoutingData {
  content: string | undefined; // Texto livre, ou título da resposta interativa
  interactionId: string | undefined; // ID da resposta interativa (qN_opção) ou payload do botão
}

// --- Funções Auxiliares de Roteamento e DB ---

/**
 * 🛠️ Extrai o conteúdo e ID necessários para o roteamento.
 */
export function extractRoutingData(msg: WhatsAppMessage): RoutingData {
  let content: string | undefined;
  let interactionId: string | undefined;

  // 1. EXTRAÇÃO E NORMALIZAÇÃO
  if (msg.type === "text") {
    content = msg.text.body;
  } else if (msg.type === "interactive") {
    const interactive = msg.interactive;
    if (interactive.type === "button_reply") {
      interactionId = interactive.button_reply.id;
      content = interactive.button_reply.title;
    } else if (interactive.type === "list_reply") {
      interactionId = interactive.list_reply.id;
      content = interactive.list_reply.title;
    }
  } else if (msg.type === "button") {
    // Botão de Template (Quick Reply)
    interactionId = msg.button.payload;
    content = msg.button.text;
  }
  // Para outros tipos (image, audio, etc.), content/interactionId permanecem undefined.

  return { content, interactionId };
}

/**
 * 🛠️ Extrai o conteúdo para salvar no histórico do DB (com representação de mídias).
 */
function getDbContent(msg: WhatsAppMessage): string {
  if (msg.type === "text") {
    return msg.text.body;
  } else if (msg.type === "interactive") {
    const interactive = msg.interactive;
    if (interactive.type === "button_reply") {
      return `[Resposta Botão] ID: ${interactive.button_reply.id} / Título: ${interactive.button_reply.title}`;
    }
    if (interactive.type === "list_reply") {
      return `[Resposta Lista] ID: ${interactive.list_reply.id} / Título: ${interactive.list_reply.title}`;
    }
    return "[Interação Desconhecida]";
  } else if (msg.type === "button") {
    return `[Resposta Template] Payload: ${msg.button.payload} / Título: ${msg.button.text}`;
  } else if (msg.type === "image") {
    return `[Imagem] ${msg.image.caption || "Sem legenda"}`;
  } else if (msg.type === "audio") {
    return "[Áudio]";
  } else if (msg.type === "video") {
    return `[Vídeo] ${msg.video.caption || "Sem legenda"}`;
  } else if (msg.type === "document") {
    return `[Documento] ${msg.document.filename || "Sem nome"}`;
  } else if (msg.type === "sticker") {
    return "[Sticker]";
  } else {
    return `[Mensagem Tipo: ${msg.type}]`;
  }
}

/**
 * Verifica se o contato está dentro da janela de 24h.
 */
function isWithinWindow(lastInbound: Timestamp | undefined): boolean {
  if (!lastInbound) return false;
  const now = Date.now();
  const lastTime = lastInbound.toMillis();
  return now - lastTime < WINDOW_HOURS_MS;
}

// --- Funções Principais ---

/**
 * 1. Busca ou Cria o Contato
 */
export async function getOrCreateContact(from: string, name: string): Promise<ContactData> {
  const ref = db.collection("contacts").doc(from);
  const doc = await ref.get();

  if (doc.exists) {
    const contactData = doc.data() as ContactData;

    // Se existe, mas por algum motivo a talk ativa sumiu, criamos uma nova talk
    if (!contactData.activeTalkId) {
      const newTalkRef = ref.collection("talks").doc();
      // Atualiza o documento Contact
      await ref.update({
        activeTalkId: newTalkRef.id,
        lastInboundAt: FieldValue.serverTimestamp() as unknown as Timestamp,
      });
      // Cria um documento vazio da Talk para garantir a subcoleção exista
      await ref.collection("talks").doc(newTalkRef.id).set({
        createdAt: FieldValue.serverTimestamp(),
      });

      contactData.activeTalkId = newTalkRef.id;
    }

    return contactData;
  }

  // Se o contato NÃO EXISTE, cria o documento e a primeira Talk
  const newTalkId = ref.collection("talks").doc().id; // Cria ID da primeira Talk

  const newContact: ContactData = {
    phoneNumber: from,
    name: name,
    botStatus: "IDLE",
    activeTalkId: newTalkId, // ✅ Atribui o novo ID
    lastInboundAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  };

  const batch = db.batch();

  // 1. Cria o documento do Contato
  batch.set(ref, newContact);

  // 2. Cria o documento da primeira Talk
  batch.set(ref.collection("talks").doc(newTalkId), {
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit(); // ✅ Cria os dois atomicamente

  return newContact;
}

/**
 * 2. Salva Mensagem com Lógica de Janela 24h
 * - Se for INBOUND: Atualiza a janela e gerencia conversas expiradas.
 * - Se for OUTBOUND: Valida se pode enviar.
 */
export async function saveMessage(
  from: string,
  content: string,
  direction: "INBOUND" | "OUTBOUND"
): Promise<boolean> {
  const contactRef = db.collection("contacts").doc(from);
  const contactDoc = await contactRef.get();

  if (!contactDoc.exists) return false;

  const data = contactDoc.data() as ContactData;
  let talkId = data.activeTalkId;

  // Lógica Temporal
  const now = Timestamp.now();

  if (direction === "INBOUND") {
    // Verifica se a conversa anterior expirou (passou de 24h desde a última interação)
    if (data.lastInboundAt && !isWithinWindow(data.lastInboundAt)) {
      if (talkId) {
        console.log(`[WINDOW] Conversa ${talkId} expirou (>24h). Fechando e abrindo nova.`);
        // Fecha a conversa antiga
        await contactRef.collection("talks").doc(talkId).update({
          status: "EXPIRED_WINDOW",
          closedAt: now,
        });
        talkId = null; // Força criação de nova talk abaixo
      }
      // Reseta status do bot pois é uma nova sessão
      await contactRef.update({ botStatus: "IDLE", currentStep: null });
    }

    // Atualiza o lastInboundAt para AGORA (renova a janela)
    await contactRef.update({ lastInboundAt: now });
  } else if (direction === "OUTBOUND") {
    // 🔒 BLOQUEIO DE SEGURANÇA
    // Se tentarmos responder e já passou de 24h da última mensagem DO CLIENTE
    if (!isWithinWindow(data.lastInboundAt)) {
      console.warn(`[BLOCK] Tentativa de envio OUTBOUND para ${from} fora da janela de 24h.`);

      if (talkId) {
        await closeCurrentTalk(from); // Fecha a conversa pois não podemos responder
      }

      return false; // 🚫 Impede o fluxo (você deve tratar isso no bot)
    }
  }

  // Gestão de Talks (Criação)
  if (!talkId) {
    const talkRef = await contactRef.collection("talks").add({
      status: "OPEN",
      startedAt: now,
    });
    talkId = talkRef.id;
    await contactRef.update({ activeTalkId: talkId });
  }

  // Salva a mensagem
  await contactRef.collection("talks").doc(talkId).collection("messages").add({
    content,
    direction,
    type: "text",
    createdAt: now,
  });

  return true; // Sucesso
}

/**
 * 3. Atualiza Status (Sem mudanças drásticas)
 */
export async function updateBotStatus(from: string, status: BotStatus, step: string | null = null) {
  await db.collection("contacts").doc(from).update({
    botStatus: status,
    currentStep: step,
  });
}

/**
 * 4. Fecha a conversa atual
 */
export async function closeCurrentTalk(from: string) {
  const contactRef = db.collection("contacts").doc(from);
  const doc = await contactRef.get();
  const data = doc.data() as ContactData;

  if (data.activeTalkId) {
    await contactRef.collection("talks").doc(data.activeTalkId).update({
      status: "CLOSED",
      closedAt: FieldValue.serverTimestamp(),
    });
    await contactRef.update({ activeTalkId: null, botStatus: "IDLE", currentStep: null });
  }
}

/**
 * 🔍 Busca o campo 'quizData' da conversa ativa do contato.
 * @param from - Número do usuário
 * @param talkId - ID da conversa ativa (obtida do documento do contato)
 * @returns Um objeto com as respostas do quiz (ex: { q1: "Vendas", q2: "Sim" })
 */
export async function getActiveQuizData(
  from: string,
  talkId: string | null
): Promise<Record<string, string>> {
  if (!talkId) {
    return {}; // Retorna vazio se não houver conversa ativa
  }

  try {
    const talkDoc = await db.collection("contacts").doc(from).collection("talks").doc(talkId).get();

    if (talkDoc.exists) {
      const data = talkDoc.data() as TalkData; // Cast para o tipo TalkData
      return data.quizData || {};
    }
  } catch (error) {
    console.error(`[FIREBASE] Erro ao buscar quizData para talk ${talkId}:`, error);
  }

  return {};
}

/**
 * 💾 Salva uma resposta estruturada do Quiz na conversa ativa.
 * Isso cria/atualiza um campo 'quizData' no documento da Talk.
 * @param from - Número do usuário
 * @param questionId - ID da pergunta (ex: "q1", "q4")
 * @param answer - A resposta (texto ou ID da opção, ex: "q1_vendas" ou "2 meses")
 */
export async function saveQuizResponse(from: string, questionId: string, answer: string) {
  const contactRef = db.collection("contacts").doc(from);
  const contactDoc = await contactRef.get();

  if (!contactDoc.exists) return;

  const data = contactDoc.data() as ContactData;
  const talkId = data.activeTalkId;

  if (!talkId) {
    console.warn(`[QUIZ SAVE] Tentativa de salvar resposta sem talk ativa para ${from}`);
    return;
  }

  // Atualiza o documento da Talk com a resposta
  // Usamos 'merge: true' implícito no update
  // Estrutura: talks/{talkId} -> quizData: { q1: "...", q4: "..." }
  await contactRef
    .collection("talks")
    .doc(talkId)
    .set(
      {
        quizData: {
          [questionId]: answer, // Salva dinamicamente com a chave da pergunta
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

  console.log(`[QUIZ SAVE] Resposta salva para ${questionId}: ${answer}`);
}

/**
 * 🛡️ Verifica se a mensagem já foi processada (Idempotência).
 * Retorna true se JÁ EXISTE (devemos ignorar).
 */
export async function isMessageProcessed(messageId: string): Promise<boolean> {
  // Cria uma coleção dedicada para controle de deduplicação
  // Dica de Produção: Configure um TTL no Firestore para limpar esses docs após 24h
  const docRef = db.collection("processed_webhooks").doc(messageId);
  const doc = await docRef.get();

  if (doc.exists) {
    return true;
  }

  // Marca como processada
  await docRef.set({
    processedAt: FieldValue.serverTimestamp(),
  });

  return false;
}

/**
 * 💾 Salva uma mensagem de entrada (inbound) e atualiza o estado do contato
 * atomicamente usando um Batched Write.
 * @param msg - O objeto da mensagem recebida (WhatsAppMessage).
 * @param talkId - ID da conversa ativa.
 * @param newStatus - Opcional, novo status para o contato.
 */
export async function processInboundMessage(
  msg: WhatsAppMessage,
  talkId: string | null,
  newStatus?: BotStatus
): Promise<void> {
  const from = msg.from; // Número de origem vem do objeto msg

  if (!talkId) {
    console.warn(
      `[INBOUND] Tentativa de processar mensagem sem talk ativa para ${from}. Apenas atualizando o contato.`
    );
  }

  const batch = db.batch();
  const contactRef = db.collection("contacts").doc(from);

  // 1. Atualização Atômica do Contato (contacts/{from})
  const contactUpdate: Partial<ContactData> = {
    lastInboundAt: FieldValue.serverTimestamp() as unknown as Timestamp,
  };

  if (newStatus) {
    contactUpdate.botStatus = newStatus;
  }

  batch.update(contactRef, contactUpdate);

  // 2. Salvar Mensagem no Histórico (contacts/{from}/talks/{talkId}/messages/{messageId})
  if (talkId && msg.id) {
    const talkMessagesRef = contactRef.collection("talks").doc(talkId).collection("messages");
    const newMessageRef = talkMessagesRef.doc(msg.id);

    const content = getDbContent(msg);

    const messageData: MessageData = {
      messageId: msg.id,
      direction: "INBOUND",
      type: msg.type,
      content: content,
      timestamp: FieldValue.serverTimestamp() as unknown as Timestamp,
    };

    batch.set(newMessageRef, messageData);
  }

  // 3. Execução Atômica
  await batch.commit();
}

/**
 * 🛡️ Helper extra para usar no Bot Config antes de processar lógica pesada
 */
export async function canBotReply(from: string): Promise<boolean> {
  const doc = await db.collection("contacts").doc(from).get();
  if (!doc.exists) return false;
  const data = doc.data() as ContactData;
  return isWithinWindow(data.lastInboundAt);
}
