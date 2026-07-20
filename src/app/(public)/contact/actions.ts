"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitRegistrationAction(formData: FormData) {
  const name = text(formData, "name");
  const phone = text(formData, "phone");
  const email = text(formData, "email");
  const program = text(formData, "program");
  const intent = text(formData, "intent") || "consultation";

  if (!name || !phone) {
    redirect(`/contact?intent=${encodeURIComponent(intent)}&program=${encodeURIComponent(program)}&error=missing-fields#register`);
  }

  await prisma.lead.create({
    data: {
      name,
      phone,
      email: email || null,
      status: "new",
      message: `Intent: ${intent}; Program: ${program || "not selected"}`,
    },
  });

  redirect(`/contact?intent=${encodeURIComponent(intent)}&program=${encodeURIComponent(program)}&submitted=1#register`);
}
