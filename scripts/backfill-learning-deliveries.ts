import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const classrooms = await prisma.classSection.findMany({
    include: { quizzes: true },
  });
  let quizDeliveries = 0;

  for (const classroom of classrooms) {
    for (const quiz of classroom.quizzes) {
      await prisma.quizDelivery.upsert({
        where: { quizId_classSectionId: { quizId: quiz.id, classSectionId: classroom.id } },
        update: {},
        create: { quizId: quiz.id, classSectionId: classroom.id, assignedById: quiz.createdById, status: quiz.published ? "PUBLISHED" : "DRAFT", openAt: quiz.openAt, dueAt: quiz.closeAt, attemptLimit: quiz.attemptLimit },
      });
      quizDeliveries += 1;
    }
  }

  console.log(JSON.stringify({ classrooms: classrooms.length, quizDeliveries }));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
