import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const classrooms = await prisma.classSection.findMany({
    include: { course: { include: { lessons: true } }, quizzes: true },
  });
  let lessonDeliveries = 0;
  let quizDeliveries = 0;

  for (const classroom of classrooms) {
    for (const lesson of classroom.course.lessons) {
      await prisma.lessonDelivery.upsert({
        where: { lessonId_classSectionId: { lessonId: lesson.id, classSectionId: classroom.id } },
        update: {},
        create: { lessonId: lesson.id, classSectionId: classroom.id, assignedById: classroom.teacherId, status: lesson.published ? "PUBLISHED" : "DRAFT" },
      });
      lessonDeliveries += 1;
    }

    for (const quiz of classroom.quizzes) {
      await prisma.quizDelivery.upsert({
        where: { quizId_classSectionId: { quizId: quiz.id, classSectionId: classroom.id } },
        update: {},
        create: { quizId: quiz.id, classSectionId: classroom.id, assignedById: quiz.createdById, status: quiz.published ? "PUBLISHED" : "DRAFT", openAt: quiz.openAt, dueAt: quiz.closeAt, attemptLimit: quiz.attemptLimit },
      });
      quizDeliveries += 1;
    }
  }

  console.log(JSON.stringify({ classrooms: classrooms.length, lessonDeliveries, quizDeliveries }));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
