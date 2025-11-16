import { ButtonOption, ListRow } from "@/types/whatsapp";

const WHATSAPP_API_URL = "https://graph.facebook.com/v24.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN!;

/**
 * Função genérica para enviar qualquer mensagem
 */
export async function sendWhatsAppMessage(to: string, payload: any) {
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

// 🔒 Função auxiliar para enviar botões pelo WhatsApp Cloud API (v24.0)
export async function sendWhatsAppButtons(to: string, text: string, buttons: ButtonOption[]) {
  await sendWhatsAppMessage(to, {
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
  });
}

// 🔒 Função auxiliar para enviar lista interativa pelo WhatsApp Cloud API (v24.0)
export async function sendWhatsAppList(
  to: string,
  text: string,
  buttonLabel: string,
  sectionTitle: string,
  rows: ListRow[]
) {
  await sendWhatsAppMessage(to, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text },
      action: {
        button: buttonLabel, // texto do botão que abre a lista
        sections: [
          {
            title: sectionTitle,
            rows: rows.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description ?? undefined,
            })),
          },
        ],
      },
    },
  });
}

/**
 * Interface para os parâmetros do template dinâmico
 */
interface DynamicTemplateParams {
  to: string;
  templateName: string;
  headerText?: string; // Opcional: Texto para a variável {{1}} do HEADER
  bodyTexts?: string[]; // Opcional: Array de textos para as variáveis {{1}}, {{2}}... do BODY
  buttonPayloads?: string[]; // Opcional: Array de payloads para os botões Quick Reply
}

/**
 * Envia um template dinâmico, montando os componentes com base nos parâmetros fornecidos.
 */
export async function sendDynamicTemplate({
  to,
  templateName,
  headerText,
  bodyTexts,
  buttonPayloads,
}: DynamicTemplateParams) {
  const components: any[] = []; // Array para montar os componentes

  // --- 1. Adiciona componente HEADER (se fornecido) ---
  if (headerText) {
    components.push({
      type: "header",
      parameters: [{ type: "text", text: headerText }],
    });
  }

  // --- 2. Adiciona componente BODY (se fornecido) ---
  if (bodyTexts && bodyTexts.length > 0) {
    components.push({
      type: "body",
      // Mapeia o array de strings para o formato de parâmetro do WhatsApp
      parameters: bodyTexts.map((text) => ({ type: "text", text: text })),
      // Ex: ["a", "b"] vira [{ type: "text", text: "a" }, { type: "text", text: "b" }]
    });
  }

  // --- 3. Adiciona componentes BUTTON (se fornecidos) ---
  if (buttonPayloads && buttonPayloads.length > 0) {
    // Mapeia o array de payloads para o formato de componente de botão
    const buttonComponents = buttonPayloads.map((payload, index) => ({
      type: "button",
      sub_type: "quick_reply",
      index: index.toString(), // O índice "0", "1", "2"...
      parameters: [
        {
          type: "payload",
          payload: payload, // O ID que você receberá no webhook
        },
      ],
    }));

    // Adiciona os botões gerados ao array principal
    components.push(...buttonComponents);
  }

  // --- 4. Envia a mensagem com os componentes montados ---
  return sendWhatsAppMessage(to, {
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: components, // O array final de componentes
    },
  });
}

/**
 * Menu inicial interativo
 */
export async function sendMainMenu(to: string, customerName: string) {
  return sendWhatsAppMessage(to, {
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

export async function sendQuestionMenu(to: string) {
  const text = "Vamos começar! Selecione uma etapa para avançar nas perguntas.";

  // opções do menu
  const options: { id: string; title: string }[] = [
    { id: "q1", title: "Objetivo do site" },
    { id: "q2", title: "Conteúdo pronto" },
    { id: "q3", title: "Funcionalidades" },
    { id: "q4", title: "Prazo" },
    { id: "q5", title: "Inspirações" },
    { id: "q6", title: "Orçamento" },
  ];

  // Decide entre botões ou lista
  if (options.length <= 3) {
    await sendWhatsAppButtons(to, text, options);
  } else {
    const rows: ListRow[] = options.map((o) => ({
      id: o.id,
      title: o.title,
    }));

    await sendWhatsAppList(
      to,
      text,
      "Ver opções", // label do botão
      "Etapas do projeto", // título da seção
      rows
    );
  }
}

/**
 * Submenu Criar Site
 */
export async function sendSubmenuCriarSite(to: string) {
  return sendWhatsAppMessage(to, {
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
