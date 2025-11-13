import { firestore } from "@/lib";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  adapter: FirestoreAdapter(firestore),
  callbacks: {
    signIn({ user }) {
      if (!user.role) {
        user.role = "user";
      }
      return true;
    },
  },
});
