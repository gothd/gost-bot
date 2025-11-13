import "next-auth";
import type { DefaultSession } from "next-auth";

// Estende a tipagem padrão do NextAuth/Auth.js para incluir o campo 'role'
declare module "next-auth" {
  /**
   * Extende o tipo 'Session' para incluir o campo 'role' no objeto 'user'.
   */
  interface Session {
    user: {
      /** O cargo do usuário (ex: admin, editor, user). */
      role?: "admin" | "editor" | "user";
    } & DefaultSession["user"];
  }

  /**
   * Extende o tipo 'User' (usado pelo Adapter) para incluir o campo 'role'.
   */
  interface User {
    /** O cargo do usuário (ex: admin, editor, user). */
    role?: "admin" | "editor" | "user";
  }
}
