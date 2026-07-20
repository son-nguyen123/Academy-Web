import { prisma } from "@/lib/prisma";

export type TeacherSetupStep = { key: string; label: string; detail: string; done: boolean; href: string };
export type TeacherSetupProgress = { completed: number; total: number; steps: TeacherSetupStep[]; nextStep: TeacherSetupStep | null; classroomId: string | null; classroomName: string | null; classroomCode: string | null; incompleteClassrooms: number };

export async function getTeacherSetupProgress(userId: string, isAdmin: boolean): Promise<TeacherSetupProgress> {
  const classrooms = await prisma.classSection.findMany({
    where: { status: "ACTIVE", ...(isAdmin ? {} : { teacherId: userId }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      createdAt: true,
      enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      lessonDeliveries: { select: { id: true } },
      assignments: { select: { id: true } },
      quizDeliveries: { select: { id: true } },
    },
  });
  // Onboarding is per classroom. Completing a step in an older class must not
  // mark the same step complete for a newly-created class.
  const progressFor = (item: (typeof classrooms)[number]) => 1
    + Number(item.enrollments.length > 0)
    + Number(item.lessonDeliveries.length > 0 || item.assignments.length > 0)
    + Number(item.quizDeliveries.length > 0);
  const incomplete = classrooms.filter((item) => progressFor(item) < 4);
  const earliestStep = incomplete.length ? Math.min(...incomplete.map(progressFor)) : 4;
  // When several classes are unfinished, surface the one stopped at the
  // earliest step. The query order keeps the newest class as the tie-breaker.
  const preferred = incomplete.find((item) => progressFor(item) === earliestStep) || null;
  const classroomHref = preferred ? `/elearning/classrooms/${preferred.id}` : "/elearning/classrooms/new";
  const steps: TeacherSetupStep[] = [
    { key: "classroom", label: "Create a classroom", detail: "Set up the class that will receive lessons and tests.", done: Boolean(preferred), href: preferred ? classroomHref : "/elearning/classrooms/new" },
    { key: "student", label: "Add students to this class", detail: "Build this classroom's roster before assigning work.", done: Boolean(preferred?.enrollments.length), href: `${classroomHref}${preferred ? "?tab=students" : ""}` },
    { key: "learning", label: "Assign a lesson or assignment", detail: "Give this class its first learning activity.", done: Boolean(preferred && (preferred.lessonDeliveries.length > 0 || preferred.assignments.length > 0)), href: `${classroomHref}${preferred ? "?tab=lessons" : ""}` },
    { key: "test", label: "Assign the first test", detail: "Choose a reusable test and set a deadline for this class.", done: Boolean(preferred?.quizDeliveries.length), href: `${classroomHref}${preferred ? "?tab=quizzes" : ""}` },
  ];
  // No incomplete classroom means setup is finished globally and the guide can hide.
  if (!preferred && classrooms.length) return { completed: 4, total: 4, steps: steps.map((step) => ({ ...step, done: true })), nextStep: null, classroomId: null, classroomName: null, classroomCode: null, incompleteClassrooms: 0 };
  const completed = steps.filter((step) => step.done).length;
  return { completed, total: steps.length, steps, nextStep: steps.find((step) => !step.done) || null, classroomId: preferred?.id || null, classroomName: preferred?.name || null, classroomCode: preferred?.code || null, incompleteClassrooms: incomplete.length };
}
