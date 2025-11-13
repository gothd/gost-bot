import { auth, signOut } from "@/auth";
import SignIn from "@/components/SignIn";
import type { Metadata } from "next";
import { Cinzel, Cinzel_Decorative } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-cinzel-decorative",
  subsets: ["latin"],
  weight: ["700", "900"],
});

export const metadata: Metadata = {
  title: "Göst bot",
  description:
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Eos, deserunt? Ducimus ad nostrum quibusdam? Ratione possimus non ipsam. Minima iusto ducimus nobis repudiandae magnam delectus? Tempore iusto reiciendis magnam qui.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="pt-BR">
      <body
        className={`${cinzel.variable} ${cinzelDecorative.variable} antialiased flex min-h-screen flex-col justify-between`}
      >
        <header className="flex justify-between px-16 py-8">
          <Link className="flex items-center" href="/">
            <Image
              src="/monograma.png"
              width={36}
              height={36}
              className="size-9 object-contain"
              alt="Logo"
            />
          </Link>
          <nav>
            {session?.user ? (
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button
                  className="group relative w-auto h-10 px-3 appearance-none select-none bg-white cursor-pointer transition-all duration-[0.218s] border border-[#747775] rounded-sm text-[#1f1f1f] text-sm tracking-[0.25px] hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                  type="submit"
                >
                  <div className="absolute left-0 right-0 top-0 bottom-0 opacity-0 transition-opacity duration-[0.218s] group-hover:bg-[#303030] group-hover:opacity-[0.08] group-focus:bg-[#303030] group-focus:opacity-[0.12] group-active:bg-[#303030] group-active:opacity-[0.12]"></div>
                  <div className="flex w-full h-full justify-center items-center">
                    <div className="grow">Sair</div>
                  </div>
                </button>
              </form>
            ) : (
              <SignIn />
            )}
          </nav>
        </header>
        <main className="flex-1 px-16 py-8">{children}</main>
        <footer className="border-t text-center px-16 text-sm">
          <div className="container mx-auto flex justify-between items-center">
            <div>© {new Date().getFullYear()} Gothd</div>
            <nav className="flex gap-2 lg:gap-4">
              <Link href="/termos" className="hover:underline">
                Termos de Uso
              </Link>
              <Link href="/privacidade" className="hover:underline">
                Política de Privacidade
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
