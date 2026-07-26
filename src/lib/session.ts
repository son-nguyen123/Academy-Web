import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/authOptions";
import { DEMO_ROLE_COOKIE, ensureDemoElearningData } from "@/lib/demoElearning";
import { prisma } from "@/lib/prisma";

export type AppRole = "ADMIN" | "TEACHER" | "STUDENT" | "USER";

export async function getCurrentUser() {
  if (process.env.NODE_ENV !== "production") {
    const cookieStore = await cookies();
    const requestedDemoRole = cookieStore.get(DEMO_ROLE_COOKIE)?.value;
    const session = await getServerSession(authOptions);

    if (requestedDemoRole === "ADMIN" || requestedDemoRole === "TEACHER" || requestedDemoRole === "STUDENT" || !session?.user?.email) {
      const demoUsers = await ensureDemoElearningData();
      if (requestedDemoRole === "ADMIN") return demoUsers.admin;
      return requestedDemoRole === "STUDENT" ? demoUsers.student : demoUsers.teacher;
    }
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
    },
  });
}

export async function requireUser(roles?: AppRole[]): Promise<{ id: string; name: string | null; email: string | null; phone: string | null; role: AppRole; isActive: boolean }> {
  const user = await getCurrentUser();

  if (!user || !user.isActive) {
    redirect("/login");
  }

  if (roles && !roles.includes(user.role)) {
    redirect("/elearning");
  }

  return user;
}

export async function requireAdmin() {
  return requireUser(["ADMIN"]);
}

export async function requireTeacherOrAdmin() {
  return requireUser(["ADMIN", "TEACHER"]);
}
