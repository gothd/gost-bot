const WHATSAPP_API_URL = "https://graph.facebook.com/v24.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!;

/**
 * Função genérica para enviar qualquer mensagem
 */
export async function sendMessage(to: string, payload: any) {
  const url = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      ...payload,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Erro ao enviar mensagem:", error);
    throw new Error(error);
  }

  return res.json();
}

/**
 * Envia um template com variáveis
 */
export async function sendTemplate(to: string, templateName: string, params: string[]) {
  return sendMessage(to, {
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "header",
          parameters: [{ type: "text", text: params[0] }], // {{1}}
        },
      ],
    },
  });
}

/**
 * Menu inicial interativo
 */
export async function sendMainMenu(to: string, customerName: string) {
  return sendMessage(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: `Ok ${customerName}, escolha uma das opções abaixo:`,
      },
      action: {
        buttons: [{ type: "reply", reply: { id: "criar_site", title: "Criar site" } }],
      },
    },
  });
}

/**
 * Submenu Criar Site
 */
export async function sendSubmenuCriarSite(to: string) {
  return sendMessage(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Escolha uma opção sobre Criar site:" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "criar_site_info", title: "Mais informações" } },
          { type: "reply", reply: { id: "criar_site_suporte", title: "Falar com suporte" } },
        ],
      },
    },
  });
}
