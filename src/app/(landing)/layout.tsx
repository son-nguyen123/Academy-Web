import Navbar from "@/lib/layout/Navbar";
import Footer from "@/lib/layout/Footer";
import { prisma } from "@/lib/prisma";

export default async function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let sponsors: { name: string; imageUrl: string; website: string | null }[] = [];

  try {
    sponsors = await prisma.sponsor.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      select: {
        name: true,
        imageUrl: true,
        website: true,
      },
    });
  } catch (error) {
    console.error("Failed to load sponsors from database:", error);
  }

  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer sponsors={sponsors} />
    </>
  );
}
