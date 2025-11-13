// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextResponse } from "next/server";

type Data = {
  name: string;
  description: string;
  imageUrl: string;
};

export function GET() {
  return NextResponse.json<Data>(
    {
      name: "Göst",
      description: "Eu sou um gatinho, e durmo na roupa do chefe.",
      imageUrl: `${process.env.AUTH_URL}/20251014.jpg`,
    },
    { status: 200 }
  );
}
