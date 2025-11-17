import { botConfig, extractKeywords, isGreeting } from "@/lib";
import {
  getOrCreateContact,
  isMessageProcessed,
  saveMessage,
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

      // 🛡️ 0. IDEMPOTÊNCIA DE PRODUÇÃO
      // Se já processamos este ID de mensagem, retornamos 200 imediatamente
      if (await isMessageProcessed(msg.id)) {
        console.log(`[IDEMPOTENCY] Mensagem ${msg.id} duplicada ignorada.`);
        return new NextResponse(null, { status: 200 });
      }

      // 🟢 Acesso seguro ao contact name
      const contactProfile = contacts?.[0];
      const customerName = contactProfile?.profile.name || "Cliente";

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

      // Se não conseguimos extrair nada útil, ignoramos a lógica do bot
      if (!content && !interactionId) {
        return new NextResponse(null, { status: 200 });
      }

      // 2. BUSCA E HISTÓRICO
      const contact = await getOrCreateContact(from, customerName);
      await saveMessage(from, content || "[Mídia/Outros]", "INBOUND");

      // 3. ROTEADOR DE LÓGICA

      // MODO AGENTE (Prioridade Máxima: Humano no comando)
      if (contact.botStatus === "AGENT") {
        return new NextResponse(null, { status: 200 });
      }

      // MODO WORKFLOW (Prioridade 1: Resposta de Texto Livre)
      if (contact.botStatus === "WORKFLOW" && contact.currentStep && msg.type === "text") {
        await botConfig.handleFreeTextAnswer(from, content!, msg);
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
          // Respostas do Quiz OU Botão de "Falar com consultor" (EXIT_TO_AGENT)
          // Se for EXIT_TO_AGENT, o handleQuizAnswer vai tratar.
          if (interactionId.startsWith("q") || interactionId === "EXIT_TO_AGENT") {
            await botConfig.handleQuizAnswer(from, interactionId);
          }
          if (interactionId.startsWith("q")) {
            // Respostas do Quiz (q1_vendas, q2_sim...)
            await botConfig.handleQuizAnswer(from, interactionId);
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
