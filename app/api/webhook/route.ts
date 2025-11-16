import { botConfig, extractKeywords, isGreeting, userState } from "@/lib";
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
      const msg = messages[messages.length - 1];
      const from = msg.from;
      console.warn("[ID]:", msg.id);
      console.log(JSON.stringify(msg, null, 2));
      const customerName = contacts?.[0]?.profile?.name || "Cliente";

      // Variável para unificar o ID da interação
      let interactionId: string | undefined;

      // 1. Mensagem de Texto
      if (msg.type === "text") {
        const text = msg.text.body;
        const state = userState.get(from); // 👈 2. LER O ESTADO DO USUÁRIO

        // 3. PRIORIDADE 1: Está respondendo uma pergunta do quiz?
        if (state?.currentQuestion) {
          await botConfig.handleFreeTextAnswer(from, text, msg);
        }
        // 4. PRIORIDADE 2: É uma saudação?
        else if (isGreeting(text)) {
          await botConfig.greetings(from, customerName);
        }
        // 5. PRIORIDADE 3: É uma palavra-chave?
        else {
          const keywords = extractKeywords(text);
          if (keywords.includes("site")) {
            await botConfig.criar_site(from);
          } else {
            // 6. PRIORIDADE 4: Fallback de texto
            await botConfig.fallback(from, "Texto não reconhecido", msg);
          }
        }
      } // 2. Mensagem Interativa (Botão/Lista da sua aplicação)
      else if (msg.type === "interactive") {
        const interactive = msg.interactive;
        switch (interactive?.type) {
          case "button_reply":
            interactionId = interactive.button_reply.id;
            break;
          case "list_reply":
            interactionId = interactive.list_reply.id;
            break;
        }
      } // 3. Mensagem de Botão de Template (NOVA LÓGICA)
      else if (msg.type === "button") {
        interactionId = msg.button?.payload; // O payload que você define no template
        console.log(`[TEMPLATE BUTTON]: Payload: ${interactionId}, Text: ${msg.button?.text}`);
      } // 4. Outros tipos de mensagem (imagem, áudio, sticker, etc.)
      else {
        await botConfig.fallback(from, "Tipo de mensagem não suportado", msg);
      }

      // 5. Processador Central de Interações (se houver um ID)
      // Este bloco agora trata IDs vindos de 'interactive' E 'button'
      if (interactionId) {
        console.log("[INTERACTION ID]:", interactionId);

        // 👇 Adicione aqui os payloads dos seus botões de TEMPLATE
        if (interactionId === "Começar agora") {
          // A. Usuário clicou em "Começar agora"
          await botConfig.startQuiz(from);
        } else if (interactionId.startsWith("q") && !interactionId.includes("_")) {
          // B. Usuário selecionou uma ETAPA do menu principal (ex: "q1", "q2")
          await botConfig.askQuizQuestion(from, interactionId);
        } else if (interactionId.startsWith("q") && interactionId.includes("_")) {
          // C. Usuário selecionou uma RESPOSTA (ex: "q1_vendas", "q2_sim")
          await botConfig.handleQuizAnswer(from, interactionId);
        } else if (interactionId === "criar_site") {
          await botConfig.criar_site(from);
        } else if (interactionId === "criar_site_info") {
          await botConfig.sendMessage(from, {
            type: "text",
            text: { body: "Aqui estão mais informações sobre Criar site..." },
          });
        } else {
          // ID de interação não reconhecido
          await botConfig.fallback(from, "Interação desconhecida", msg);
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
