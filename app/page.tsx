import { auth } from "@/auth";
import { notFound } from "next/navigation";

export default async function HomePage() {
  // 🔑 CHAVE: Obtém a sessão no Server Component
  const session = await auth();

  // 🚨 Regra de Proteção
  if (!session || !session.user) {
    notFound();
  }

  // Se a sessão existir, renderiza o conteúdo
  return <div className="container mx-auto">Em construção...</div>;
}
