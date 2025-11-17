import { firestore as db } from "@/lib/firestore";
import { BotStatus, ContactData } from "@/types/bot";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { WINDOW_HOURS_MS } from "./constants";

// --- Funções Auxiliares ---

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
    return doc.data() as ContactData;
  }

  const newContact: ContactData = {
    phoneNumber: from,
    name: name,
    botStatus: "IDLE",
    lastInboundAt: Timestamp.now(), // Assume agora como início se for novo
    createdAt: Timestamp.now(),
  };

  await ref.set(newContact);
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
 * 🛡️ Helper extra para usar no Bot Config antes de processar lógica pesada
 */
export async function canBotReply(from: string): Promise<boolean> {
  const doc = await db.collection("contacts").doc(from).get();
  if (!doc.exists) return false;
  const data = doc.data() as ContactData;
  return isWithinWindow(data.lastInboundAt);
}
