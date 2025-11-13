import { botConfig, extractKeywords, isGreeting } from "@/lib";
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
  } else {
    return new NextResponse(null, { status: 403 });
  }
}

// --- Handler para POST (Recebimento de mensagens) ---
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // 🚨 1. Mensagens recebidas
    const messages = value?.messages;
    const contacts = value?.contacts;

    if (messages && messages[0]) {
      const msg = messages[0];
      const from = msg.from;
      const customerName = contacts?.[0]?.profile?.name || "Cliente";

      // Texto normal
      if (msg.type === "text") {
        const text = msg.text.body;

        if (isGreeting(text)) {
          await botConfig.greetings(from, customerName);
        } else {
          const keywords = extractKeywords(text);

          if (keywords.includes("site")) {
            await botConfig.criar_site(from);
          } else {
            await botConfig.fallback(from, "Texto não reconhecido", msg);
          }
        }
      }

      // Caso seja clique em botão ou lista
      let buttonReplyId: string | undefined;

      if (msg.type === "interactive") {
        const interactive = msg.interactive;

        switch (interactive?.type) {
          case "button_reply":
            buttonReplyId = interactive.button_reply.id;
            break;
          case "list_reply":
            buttonReplyId = interactive.list_reply.id;
            break;
        }
      }

      if (buttonReplyId) {
        if (buttonReplyId === "criar_site") {
          await botConfig.criar_site(from);
        } else if (buttonReplyId === "criar_site_info") {
          await botConfig.sendMessage(from, {
            type: "text",
            text: { body: "Aqui estão mais informações sobre Criar site..." },
          });
        } else {
          await botConfig.fallback(from, "Interação inválida", msg);
        }
      }
    }

    // 🚨 2. Status de mensagens enviadas
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
