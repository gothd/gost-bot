import { botConfig, extractKeywords, isGreeting } from "@/lib";
import {
  extractRoutingData,
  getOrCreateContact,
  isMessageProcessed,
  processInboundMessage,
  updateBotStatus,
} from "@/lib/firebaseService";
import { WhatsAppMessage, WhatsAppWebhookBody } from "@/types/whatsapp";
import { NextRequest, NextResponse } from "next/server";

// --- Handler para GET (Verificação do WhatsApp) ---
export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const searchParams = req.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode && token && mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

// --- Handler para POST (Recebimento de mensagens) ---
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WhatsAppWebhookBody;

    // Verificação de segurança da estrutura básica
    const value = body.entry?.[0]?.changes?.[0]?.value;
    if (!value) return new NextResponse(null, { status: 200 });

    // 1. Evento de Mensagem (INBOUND)
    const messages = value.messages;
    const contacts = value.contacts; // 🟢 Contatos vindo do Value

    if (messages && messages.length > 0) {
      const msg = messages[messages.length - 1] as WhatsAppMessage;
      const from = msg.from;
      const customerName = contacts?.[0]?.profile.name || "Cliente";

      // 🛡️ 1. IDEMPOTÊNCIA DE PRODUÇÃO
      // Se já processamos este ID de mensagem, retornamos 200 imediatamente
      if (await isMessageProcessed(msg.id)) {
        console.log(`[DEDUPLICAÇÃO] Mensagem ${msg.id} duplicada ignorada.`);
        return new NextResponse(null, { status: 200 });
      }

      // 2. EXTRAÇÃO DOS DADOS DE ROTEAMENTO
      const { content, interactionId } = extractRoutingData(msg);
      // Se não conseguimos extrair nada útil (e.g., mensagem de mídia sem legenda), saímos.
      if (!content && !interactionId) {
        // A mensagem será salva no DB por processInboundMessage, mas não aciona o bot.
        return new NextResponse(null, { status: 200 });
      }

      // 3. OBTENÇÃO DO CONTATO E CONVERSA
      const contact = await getOrCreateContact(from, customerName);
      const talkId = contact.activeTalkId;

      // 4. PERSISTÊNCIA ATÔMICA DA MENSAGEM
      // Salva no DB e atualiza lastInboundAt (e/ou status se for human_pending/closed, se quiser)
      await processInboundMessage(msg, talkId ?? null); // ✅ Mantém a performance e atomicidade

      // ROTEADOR DE LÓGICA

      // 🟢 PRI 1: SILÊNCIO E AGENTE (HUMAN_PENDING / HUMAN_ACTIVE)
      // Esta é a PRIORIDADE MÁXIMA. Se o humano está envolvido, o bot silencia.
      if (contact.botStatus === "HUMAN_PENDING" || contact.botStatus === "HUMAN_ACTIVE") {
        // A mensagem já foi salva no DB. Não faz mais nada.
        return new NextResponse(null, { status: 200 });
      }

      // 🟢 PRI 2: RESET (CLOSED)
      // Se a conversa foi fechada pelo agente, reinicia o status e continua para o fluxo IDLE.
      if (contact.botStatus === "CLOSED") {
        await updateBotStatus(from, "IDLE", null);
        // Continua o processamento no próximo bloco (PRI 3)
      }

      // PRI 3: WORKFLOW (Esperando resposta de texto)
      if (
        contact.botStatus === "WORKFLOW" &&
        contact.currentStep &&
        msg.type === "text" &&
        content
      ) {
        await botConfig.handleFreeTextAnswer(from, content, msg);
        return new NextResponse(null, { status: 200 });
      }

      // MODO IDLE (Prioridade 2: Comandos e Retomada)
      if (contact.botStatus === "IDLE" || contact.botStatus === "WORKFLOW") {
        // Nota: Permitimos WORKFLOW aqui para capturar interações (botões)

        // 🟢 2.1: RETOMADA APÓS 24H (Só se IDLE)
        if (contact.botStatus === "IDLE" && contact.currentStep && contact.currentStep !== "q1") {
          await updateBotStatus(from, "WORKFLOW", contact.currentStep);
          await botConfig.notifyAndAskQuestion(from, contact.currentStep);
          return new NextResponse(null, { status: 200 });
        }

        // 🟢 2.2: INTERAÇÕES (Botões de Quiz ou Menu)
        if (interactionId) {
          if (interactionId.startsWith("q") || interactionId === "EXIT_TO_AGENT") {
            // Se contém "_" (qN_resposta) OU é o ID de Saída
            if (interactionId.includes("_") || interactionId === "EXIT_TO_AGENT") {
              // Ação: Resposta do Quiz ou Saída (Salva o estado e retorna ao menu)
              await botConfig.handleQuizAnswer(from, interactionId);
            } else {
              // Se não contém "_" (qN) - É uma SELEÇÃO de etapa do menu principal
              // Ação: Pergunta a questão (Inicia o workflow)
              await updateBotStatus(from, "WORKFLOW", interactionId);
              await botConfig.askQuizQuestion(from, interactionId);
            }
          } else if (interactionId === "Começar agora") {
            await updateBotStatus(from, "WORKFLOW", "q1");
            await botConfig.askQuizQuestion(from, "q1");
          } else if (interactionId === "criar_site") {
            await botConfig.criar_site(from);
          } else if (interactionId === "criar_site_info") {
            await botConfig.safeSendMessage(from, {
              type: "text",
              text: { body: "Aqui estão mais informações sobre Criar site..." },
            });
          } else {
            await botConfig.fallback(from, "Interação inválida", msg);
          }
          return new NextResponse(null, { status: 200 });
        }

        // 🟢 PRI 2.3: TEXTO LIVRE (Saudações/Keywords, apenas se IDLE, pois se fosse WORKFLOW texto, já teria sido capturado acima)
        if (msg.type === "text" && content && contact.botStatus === "IDLE") {
          if (isGreeting(content)) {
            await botConfig.greetings(from, customerName);
          } else {
            const keywords = extractKeywords(content);
            if (keywords.includes("site")) {
              await botConfig.criar_site(from);
            } else {
              await botConfig.fallback(from, "Texto não reconhecido", msg);
            }
          }
        }
      }
    }

    // Status Updates (Sent/Read/Delivered)
    const statuses = value?.statuses;
    if (statuses && statuses[0]) {
      const statusEvent = statuses[0];
      console.log("[STATUS EVENT]", {
        id: statusEvent.id,
        status: statusEvent.status, // sent, delivered, read, failed
        recipient: statusEvent.recipient_id,
        timestamp: statusEvent.timestamp,
      });

      // Aqui você pode salvar no banco ou atualizar métricas
    }

    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return new NextResponse(null, { status: 500 });
  }
}
