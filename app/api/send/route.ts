import { NextRequest, NextResponse } from "next/server";

export interface ButtonOption {
  id: string;
  title: string;
}

export interface WhatsAppPayload {
  to: string;
  text: string;
  buttons?: ButtonOption[];
}

export async function POST(req: NextRequest) {
  const { to, text, buttons }: WhatsAppPayload = await req.json();

  if (!to || !text) {
    return NextResponse.json({ ok: false, error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const token = process.env.WHATSAPP_TOKEN!;
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID!;

  const body = buttons
    ? {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: {
            buttons: buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      };

  const res = await fetch(`https://graph.facebook.com/v24.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json({ ok: false, error }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
