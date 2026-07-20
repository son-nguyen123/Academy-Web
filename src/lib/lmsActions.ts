"use server";

import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireTeacherOrAdmin, requireUser } from "@/lib/session";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value || null;
}

function textListValue(formData: FormData, key: string) {
  return textValue(formData, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalDate(formData: FormData, key: string) {
  const value = textValue(formData, key);
  return value ? new Date(value) : null;
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const value = Number(textValue(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function optionalNumber(formData: FormData, key: string) {
  const rawValue = textValue(formData, key);
  if (!rawValue) return null;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function parseOptionRows(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^([A-Z])[\).:\-\s]+(.+)$/i);
      return {
        label: (match?.[1] || String.fromCharCode(65 + index)).toUpperCase(),
        text: (match?.[2] || line).trim(),
        order: index + 1,
      };
    });
}

function normalizeAnswerValue(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function answerKeyAlternatives(answerKey: string) {
  return answerKey
    .split(/\s*(?:\||;|\n)\s*/)
    .map(normalizeAnswerValue)
    .filter(Boolean);
}

function isTextAnswerCorrect(rawAnswer: string, answerKey: string | null) {
  if (!answerKey) return null;
  const normalizedAnswer = normalizeAnswerValue(rawAnswer);
  if (!normalizedAnswer) return false;
  return answerKeyAlternatives(answerKey).includes(normalizedAnswer);
}

async function logActivity(actorId: string | undefined, action: string, entityType: string, entityId?: string) {
  await prisma.activityLog.create({
    data: {
      actorId,
      action,
      entityType,
      entityId,
    },
  });
}

export async function createUserAction(formData: FormData) {
  const actor = await requireAdmin();
  const email = textValue(formData, "email").toLowerCase();
  const password = textValue(formData, "password") || "123456";

  if (!email) return;

  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: optionalText(formData, "name"),
      email,
      phone: optionalText(formData, "phone"),
      role: textValue(formData, "role") as "ADMIN" | "TEACHER" | "STUDENT",
      password: await bcrypt.hash(password, 10),
    },
  });

  await logActivity(actor.id, "CREATE_USER", "User", user.id);
  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
}

export async function toggleUserActiveAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = textValue(formData, "id");
  const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
  if (!user) return;

  await prisma.user.update({ where: { id }, data: { isActive: !user.isActive } });
  await logActivity(actor.id, "TOGGLE_USER_ACTIVE", "User", id);
  revalidatePath("/admin/users");
}

export async function assignUserToClassAction(formData: FormData) {
  const actor = await requireAdmin();
  const userId = textValue(formData, "userId");
  const classSectionId = textValue(formData, "classSectionId");
  if (!userId || !classSectionId) return;

  await prisma.enrollment.upsert({
    where: { userId_classSectionId: { userId, classSectionId } },
    update: {
      status: "ACTIVE",
      decidedAt: new Date(),
      decidedById: actor.id,
    },
    create: {
      userId,
      classSectionId,
      status: "ACTIVE",
      decidedAt: new Date(),
      decidedById: actor.id,
    },
  });

  await logActivity(actor.id, "ASSIGN_USER_TO_CLASS", "Enrollment", `${userId}:${classSectionId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/classes");
}

export async function createCourseAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const title = textValue(formData, "title");
  if (!title) return;

  const course = await prisma.course.create({
    data: {
      title,
      description: optionalText(formData, "description"),
      price: numberValue(formData, "price"),
      published: formData.get("published") === "on",
    },
  });

  await logActivity(actor.id, "CREATE_COURSE", "Course", course.id);
  revalidatePath("/admin/courses");
  revalidatePath("/elearning/courses");
}

export async function deleteCourseAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = textValue(formData, "id");
  if (!id) return;

  await prisma.course.delete({ where: { id } });
  await logActivity(actor.id, "DELETE_COURSE", "Course", id);
  revalidatePath("/admin/courses");
  revalidatePath("/elearning/courses");
}

export async function createClassAction(formData: FormData) {
  const actor = await requireAdmin();
  const name = textValue(formData, "name");
  const courseId = textValue(formData, "courseId");
  if (!name || !courseId) return;

  const classSection = await prisma.classSection.create({
    data: {
      name,
      code: textValue(formData, "code") || `CLS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      courseId,
      teacherId: optionalText(formData, "teacherId"),
      startAt: optionalDate(formData, "startAt"),
      endAt: optionalDate(formData, "endAt"),
    },
  });

  await logActivity(actor.id, "CREATE_CLASS", "ClassSection", classSection.id);
  revalidatePath("/admin/classes");
  revalidatePath("/elearning/classrooms");
}

export async function deleteClassAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = textValue(formData, "id");
  if (!id) return;

  await prisma.classSection.delete({ where: { id } });
  await logActivity(actor.id, "DELETE_CLASS", "ClassSection", id);
  revalidatePath("/admin/classes");
  revalidatePath("/elearning/classrooms");
}

export async function requestEnrollmentAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const classCode = textValue(formData, "classCode").toUpperCase();
  const classSectionId = textValue(formData, "classSectionId");
  const classSection = classCode
    ? await prisma.classSection.findUnique({ where: { code: classCode } })
    : await prisma.classSection.findUnique({ where: { id: classSectionId } });

  if (!classSection) return;

  await prisma.enrollment.upsert({
    where: {
      userId_classSectionId: {
        userId: actor.id,
        classSectionId: classSection.id,
      },
    },
    update: { status: "REQUESTED", requestedAt: new Date() },
    create: {
      userId: actor.id,
      classSectionId: classSection.id,
      status: "REQUESTED",
    },
  });

  await logActivity(actor.id, "REQUEST_ENROLLMENT", "ClassSection", classSection.id);
  revalidatePath("/elearning/classrooms");
  revalidatePath("/admin/enrollments");
}

export async function decideEnrollmentAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const id = textValue(formData, "id");
  const decision = textValue(formData, "decision");
  if (!id) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { classSection: { select: { teacherId: true } } },
  });
  if (!enrollment) return;
  if (actor.role === "TEACHER" && enrollment.classSection.teacherId !== actor.id) {
    throw new Error("You do not have permission to manage this enrollment.");
  }

  const status = decision === "reject" ? "REJECTED" : "ACTIVE";
  await prisma.enrollment.update({
    where: { id },
    data: {
      status,
      decidedAt: new Date(),
      decidedById: actor.id,
    },
  });

  await logActivity(actor.id, `${status}_ENROLLMENT`, "Enrollment", id);
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin/classes");
  revalidatePath("/elearning/classrooms");
  revalidatePath(`/elearning/classrooms/${enrollment.classSectionId}`);
}

export async function createLessonAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const title = textValue(formData, "title");
  const courseId = textValue(formData, "courseId");
  if (!title || !courseId) return;

  const lesson = await prisma.lesson.create({
    data: {
      title,
      courseId,
      content: optionalText(formData, "content"),
      videoUrl: optionalText(formData, "videoUrl"),
      order: numberValue(formData, "order"),
      published: formData.get("published") !== "off",
    },
  });

  await logActivity(actor.id, "CREATE_LESSON", "Lesson", lesson.id);
  revalidatePath("/admin/lessons");
  revalidatePath("/elearning/courses");
}

export async function deleteLessonAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const id = textValue(formData, "id");
  if (!id) return;

  await prisma.lesson.delete({ where: { id } });
  await logActivity(actor.id, "DELETE_LESSON", "Lesson", id);
  revalidatePath("/admin/lessons");
  revalidatePath("/elearning/courses");
}

export async function createAssignmentAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const title = textValue(formData, "title");
  const classSectionId = textValue(formData, "classSectionId");
  if (!title || !classSectionId) return;
  const classSection = await prisma.classSection.findUnique({ where: { id: classSectionId }, select: { teacherId: true } });
  if (!classSection) return;
  if (actor.role === "TEACHER" && classSection.teacherId !== actor.id) {
    throw new Error("You do not have permission to create assignments for this classroom.");
  }
  const status = textValue(formData, "status") as "DRAFT" | "PUBLISHED" | "ARCHIVED";
  const difficulty = textValue(formData, "difficulty") as "EASY" | "MEDIUM" | "HARD";
  const skill = textValue(formData, "skill") as "LISTENING" | "READING" | "WRITING" | "SPEAKING" | "GRAMMAR" | "VOCABULARY" | "PRONUNCIATION" | "MIXED";

  const assignment = await prisma.assignment.create({
    data: {
      title,
      classSectionId,
      description: optionalText(formData, "description"),
      type: textValue(formData, "type") as "HOMEWORK" | "WRITING" | "SPEAKING" | "FILE_UPLOAD",
      status: ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status) ? status : "PUBLISHED",
      difficulty: ["EASY", "MEDIUM", "HARD"].includes(difficulty) ? difficulty : "MEDIUM",
      skill: ["LISTENING", "READING", "WRITING", "SPEAKING", "GRAMMAR", "VOCABULARY", "PRONUNCIATION", "MIXED"].includes(skill) ? skill : "MIXED",
      cefrLevel: optionalText(formData, "cefrLevel"),
      maxScore: Math.max(1, numberValue(formData, "maxScore", 100)),
      rubric: optionalText(formData, "rubric"),
      allowLateSubmission: formData.get("allowLateSubmission") === "on",
      allowResubmission: formData.get("allowResubmission") === "on",
      category: optionalText(formData, "category"),
      tags: textListValue(formData, "tags"),
      instructions: optionalText(formData, "instructions"),
      attachmentUrl: optionalText(formData, "attachmentUrl"),
      attachmentName: optionalText(formData, "attachmentName"),
      dueAt: optionalDate(formData, "dueAt"),
      createdById: actor.id,
    },
  });

  await logActivity(actor.id, "CREATE_ASSIGNMENT", "Assignment", assignment.id);
  revalidatePath("/admin/assignments");
  revalidatePath("/elearning/assignments");
  revalidatePath(`/elearning/classrooms/${classSectionId}`);
  revalidatePath("/elearning");
}

export async function createAssignmentWithStateAction(
  _state: { ok: boolean; message: string },
  formData: FormData,
) {
  const title = textValue(formData, "title");
  const classSectionId = textValue(formData, "classSectionId");
  if (!title || !classSectionId) {
    return { ok: false, message: "Please enter a title and choose a class." };
  }

  try {
    await createAssignmentAction(formData);
    const status = textValue(formData, "status") || "PUBLISHED";
    return {
      ok: true,
      message: status === "DRAFT" ? "Assignment saved as draft." : "Assignment published successfully.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create the assignment. Please try again.",
    };
  }
}

export type ImportStudentsState = {
  ok: boolean;
  message: string;
  imported: number;
  skipped: number;
  createdAccounts: Array<{ email: string; password: string }>;
};

export async function importStudentsAction(
  _state: ImportStudentsState,
  formData: FormData,
): Promise<ImportStudentsState> {
  const actor = await requireTeacherOrAdmin();
  const classSectionId = textValue(formData, "classSectionId");
  const rows = textValue(formData, "students")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(0, 200);

  if (!classSectionId || !rows.length) {
    return { ok: false, message: "Enter at least one student.", imported: 0, skipped: 0, createdAccounts: [] };
  }

  const classroom = await prisma.classSection.findUnique({
    where: { id: classSectionId },
    select: { teacherId: true },
  });
  if (!classroom || (actor.role === "TEACHER" && classroom.teacherId !== actor.id)) {
    return { ok: false, message: "You do not have permission to manage this classroom.", imported: 0, skipped: rows.length, createdAccounts: [] };
  }

  let imported = 0;
  let skipped = 0;
  const createdAccounts: Array<{ email: string; password: string }> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const parts = row.split(/[;,\t]/).map((item) => item.trim());
    const emailPart = parts.find((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
    const email = emailPart?.toLowerCase();
    const name = parts.find((item) => item !== emailPart) || null;

    if (!email || seen.has(email)) {
      skipped += 1;
      continue;
    }
    seen.add(email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !["STUDENT", "USER"].includes(existing.role)) {
      skipped += 1;
      continue;
    }

    const temporaryPassword = randomBytes(8).toString("base64url");
    const student = existing || await prisma.user.create({
      data: { id: randomUUID(), name, email, role: "STUDENT", password: await bcrypt.hash(temporaryPassword, 10) },
    });
    if (!existing) createdAccounts.push({ email, password: temporaryPassword });

    if (existing?.role === "USER") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "STUDENT", name: existing.name || name } });
    }

    await prisma.enrollment.upsert({
      where: { userId_classSectionId: { userId: student.id, classSectionId } },
      update: { status: "ACTIVE", decidedAt: new Date(), decidedById: actor.id },
      create: { userId: student.id, classSectionId, status: "ACTIVE", decidedAt: new Date(), decidedById: actor.id },
    });
    imported += 1;
  }

  await logActivity(actor.id, "IMPORT_STUDENTS", "ClassSection", classSectionId);
  revalidatePath("/elearning/classrooms");
  revalidatePath(`/elearning/classrooms/${classSectionId}`);
  revalidatePath("/elearning");

  return {
    ok: imported > 0,
    imported,
    skipped,
    createdAccounts,
    message: imported > 0
      ? `${imported} student${imported === 1 ? "" : "s"} added to the classroom${skipped ? `; ${skipped} row${skipped === 1 ? " was" : "s were"} skipped` : ""}.`
      : "No students were added. Check the email format or existing account roles.",
  };
}

export async function deleteAssignmentAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const id = textValue(formData, "id");
  if (!id) return;

  await prisma.assignment.delete({ where: { id } });
  await logActivity(actor.id, "DELETE_ASSIGNMENT", "Assignment", id);
  revalidatePath("/admin/assignments");
  revalidatePath("/elearning/assignments");
}

export async function submitAssignmentAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const assignmentId = textValue(formData, "assignmentId");
  if (!assignmentId) throw new Error("Assignment is missing.");

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { classSection: { include: { enrollments: true } } },
  });
  const isEnrolled = assignment?.classSection.enrollments.some(
    (item) => item.userId === actor.id && item.status === "ACTIVE",
  );
  if (!assignment || assignment.status !== "PUBLISHED" || assignment.classSection.status !== "ACTIVE") throw new Error("This assignment is no longer available.");
  if (!isEnrolled) throw new Error("You are not enrolled in this classroom.");
  if (assignment.dueAt && assignment.dueAt < new Date() && !assignment.allowLateSubmission) {
    throw new Error("The deadline has passed and late submissions are disabled.");
  }
  const existingSubmission = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: actor.id } },
    select: { id: true, status: true },
  });
  if (existingSubmission && !assignment.allowResubmission && existingSubmission.status !== "REVISION_REQUESTED") {
    throw new Error("Your teacher has disabled resubmission for this assignment.");
  }

  await prisma.submission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId: actor.id,
      },
    },
    update: {
      content: optionalText(formData, "content"),
      fileUrl: optionalText(formData, "fileUrl"),
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
    create: {
      assignmentId,
      studentId: actor.id,
      content: optionalText(formData, "content"),
      fileUrl: optionalText(formData, "fileUrl"),
      status: "SUBMITTED",
    },
  });

  await logActivity(actor.id, "SUBMIT_ASSIGNMENT", "Assignment", assignmentId);
  revalidatePath("/elearning/assignments");
  revalidatePath(`/elearning/classrooms/${assignment.classSectionId}`);
  revalidatePath("/elearning");
  revalidatePath("/admin/assignments");
  revalidatePath("/admin/grades");
}

export type SubmitAssignmentState = {
  ok: boolean;
  message: string;
  assignmentId: string;
};

export async function submitAssignmentWithStateAction(
  _state: SubmitAssignmentState,
  formData: FormData,
): Promise<SubmitAssignmentState> {
  const assignmentId = textValue(formData, "assignmentId");

  try {
    await submitAssignmentAction(formData);
    return {
      ok: true,
      assignmentId,
      message: "Your work was submitted successfully.",
    };
  } catch (error) {
    return {
      ok: false,
      assignmentId,
      message: error instanceof Error ? error.message : "Your work could not be submitted. Please try again.",
    };
  }
}

export async function createQuestionAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const text = textValue(formData, "text");
  if (!text) return;

  const optionRows = parseOptionRows(textValue(formData, "options"));
  const correctIndex = numberValue(formData, "correctIndex", 1) - 1;

  const question = await prisma.question.create({
    data: {
      text,
      type: textValue(formData, "type") as "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "GRID" | "FILL_BLANK" | "ESSAY" | "LISTENING" | "READING",
      categoryId: optionalText(formData, "categoryId"),
      answerKey: optionalText(formData, "answerKey"),
      explanation: optionalText(formData, "explanation"),
      points: numberValue(formData, "points", 1),
      createdById: actor.id,
      options: {
        create: optionRows.map((option, index) => ({
          label: option.label,
          text: option.text,
          order: option.order,
          isCorrect: index === correctIndex,
        })),
      },
    },
  });

  await logActivity(actor.id, "CREATE_QUESTION", "Question", question.id);
  revalidatePath("/admin/question-bank");
}

export async function deleteQuestionAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const id = textValue(formData, "id");
  if (!id) return;

  await prisma.question.delete({ where: { id } });
  await logActivity(actor.id, "DELETE_QUESTION", "Question", id);
  revalidatePath("/admin/question-bank");
}

export async function createQuizAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const title = textValue(formData, "title");
  const classSectionId = textValue(formData, "classSectionId");
  const questionIds = formData.getAll("questionIds").map(String);
  if (!title || !classSectionId) return;

  const quiz = await prisma.quiz.create({
    data: {
      title,
      classSectionId,
      description: optionalText(formData, "description"),
      programId: optionalText(formData, "programId"),
      unit: optionalText(formData, "unit"),
      isOpenQuiz: formData.get("isOpenQuiz") === "on",
      published: formData.get("published") !== "off",
      timeLimit: optionalNumber(formData, "timeLimit"),
      openAt: optionalDate(formData, "openAt"),
      closeAt: optionalDate(formData, "closeAt"),
      attemptLimit: numberValue(formData, "attemptLimit", 1),
      shuffleQuestions: formData.get("shuffleQuestions") === "on",
      createdById: actor.id,
      questions: {
        create: questionIds.map((questionId, index) => ({
          questionId,
          order: index + 1,
        })),
      },
    },
  });

  await logActivity(actor.id, "CREATE_QUIZ", "Quiz", quiz.id);
  revalidatePath("/admin/quizzes");
  revalidatePath("/elearning/exercises");
}

async function canManageQuiz(quizId: string, actor: { id: string; role: string }) {
  return prisma.quiz.findFirst({
    where: {
      id: quizId,
      isPracticeTest: false,
      ...(actor.role === "TEACHER" ? { OR: [{ createdById: actor.id }, { classSection: { teacherId: actor.id } }, { deliveries: { some: { classSection: { teacherId: actor.id } } } }] } : {}),
    },
    select: { id: true },
  });
}

export async function addQuizQuestionAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const quizId = textValue(formData, "quizId");
  const text = textValue(formData, "text");
  const type = textValue(formData, "type") as "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "GRID" | "FILL_BLANK" | "ESSAY" | "LISTENING" | "READING";

  if (!quizId || !text || !type) return;

  const quiz = await canManageQuiz(quizId, actor);
  if (!quiz) return;

  const order = optionalNumber(formData, "order");
  const maxOrder = await prisma.quizQuestion.aggregate({
    where: { quizId },
    _max: { order: true },
  });
  const sectionTitle = textValue(formData, "section");
  let sectionId: string | null = null;

  if (sectionTitle) {
    const existingSection = await prisma.testSection.findFirst({
      where: { quizId, title: sectionTitle },
      select: { id: true },
    });

    if (existingSection) {
      sectionId = existingSection.id;
    } else {
      const createdSection = await prisma.testSection.create({
        data: {
          quizId,
          title: sectionTitle,
          skill: "GRAMMAR",
          order: (await prisma.testSection.count({ where: { quizId } })) + 1,
        },
        select: { id: true },
      });
      sectionId = createdSection.id;
    }
  }

  const optionRows = parseOptionRows(textValue(formData, "options"));
  const correctLabel = textValue(formData, "correctLabel").toUpperCase();
  const question = await prisma.question.create({
    data: {
      text,
      section: sectionTitle || null,
      sourceOrder: order,
      sourceType: type.toLowerCase(),
      type,
      answerKey: optionalText(formData, "answerKey"),
      explanation: optionalText(formData, "explanation"),
      points: numberValue(formData, "points", 1),
      createdById: actor.id,
      options: optionRows.length > 0
        ? {
            create: optionRows.map((option) => ({
              label: option.label,
              text: option.text,
              order: option.order,
              isCorrect: Boolean(correctLabel && option.label === correctLabel),
            })),
          }
        : undefined,
    },
  });

  await prisma.quizQuestion.create({
    data: {
      quizId,
      sectionId,
      questionId: question.id,
      points: numberValue(formData, "points", 1),
      order: order || (maxOrder._max.order || 0) + 1,
    },
  });

  await logActivity(actor.id, "ADD_QUIZ_QUESTION", "Question", question.id);
  revalidatePath("/admin/quizzes");
  revalidatePath(`/elearning/exercises/${quizId}`);
  revalidatePath("/elearning/exercises");
}

export async function updateQuestionAnswerAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const quizId = textValue(formData, "quizId");
  const questionId = textValue(formData, "questionId");
  if (!quizId || !questionId) return;

  const quiz = await canManageQuiz(quizId, actor);
  if (!quiz) return;

  const correctOptionId = optionalText(formData, "correctOptionId");

  await prisma.question.update({
    where: { id: questionId },
    data: {
      answerKey: optionalText(formData, "answerKey"),
      explanation: optionalText(formData, "explanation"),
    },
  });

  await prisma.questionOption.updateMany({
    where: { questionId },
    data: { isCorrect: false },
  });

  if (correctOptionId) {
    await prisma.questionOption.updateMany({
      where: { id: correctOptionId, questionId },
      data: { isCorrect: true },
    });
  }

  await logActivity(actor.id, "UPDATE_QUESTION_ANSWER", "Question", questionId);
  revalidatePath("/admin/quizzes");
  revalidatePath(`/elearning/exercises/${quizId}`);
}

export async function deleteQuizAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const id = textValue(formData, "id");
  if (!id) return;

  await prisma.quiz.delete({ where: { id } });
  await logActivity(actor.id, "DELETE_QUIZ", "Quiz", id);
  revalidatePath("/admin/quizzes");
  revalidatePath("/elearning/exercises");
}

type ExamTypeValue = "TOEIC" | "IELTS" | "GENERAL";
type ExamSkillValue = "LISTENING" | "READING" | "WRITING" | "SPEAKING" | "GRAMMAR" | "MIXED";
type PracticeQuestionType = "MULTIPLE_CHOICE" | "FILL_BLANK" | "ESSAY" | "LISTENING" | "READING";

const examTypes = new Set(["TOEIC", "IELTS", "GENERAL"]);
const examSkills = new Set(["LISTENING", "READING", "WRITING", "SPEAKING", "GRAMMAR", "MIXED"]);
const questionTypes = new Set(["MULTIPLE_CHOICE", "FILL_BLANK", "ESSAY", "LISTENING", "READING"]);

function examTypeValue(value: string, fallback: ExamTypeValue = "GENERAL") {
  const normalized = value.toUpperCase();
  return (examTypes.has(normalized) ? normalized : fallback) as ExamTypeValue;
}

function examSkillValue(value: string, fallback: ExamSkillValue = "GRAMMAR") {
  const normalized = value.toUpperCase();
  return (examSkills.has(normalized) ? normalized : fallback) as ExamSkillValue;
}

function practiceQuestionTypeValue(value: string, fallback: PracticeQuestionType = "MULTIPLE_CHOICE") {
  const normalized = value.toUpperCase();
  return (questionTypes.has(normalized) ? normalized : fallback) as PracticeQuestionType;
}

async function canManageClassSection(classSectionId: string, actor: { id: string; role: string }) {
  return prisma.classSection.findFirst({
    where: {
      id: classSectionId,
      ...(actor.role === "TEACHER" ? { teacherId: actor.id } : {}),
    },
    select: { id: true },
  });
}

async function canManagePracticeTest(quizId: string, actor: { id: string; role: string }) {
  return prisma.quiz.findFirst({
    where: {
      id: quizId,
      isPracticeTest: true,
      ...(actor.role === "TEACHER" ? { OR: [{ createdById: actor.id }, { classSection: { teacherId: actor.id } }, { deliveries: { some: { classSection: { teacherId: actor.id } } } }] } : {}),
    },
    select: { id: true, classSectionId: true },
  });
}

function parseOptionLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[A-D][).:\-\s]+/i, "").trim());
}

export async function createPracticeTestAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const title = textValue(formData, "title");
  const classSectionId = textValue(formData, "classSectionId");
  if (!title) return;
  if (classSectionId && !await canManageClassSection(classSectionId, actor)) return;

  const test = await prisma.quiz.create({
    data: {
      title,
      classSectionId: classSectionId || null,
      description: optionalText(formData, "description"),
      isPracticeTest: true,
      examType: examTypeValue(textValue(formData, "examType")),
      skill: examSkillValue(textValue(formData, "skill"), "MIXED"),
      timeLimit: optionalNumber(formData, "timeLimitMinutes"),
      instructions: optionalText(formData, "instructions"),
      audioUrl: optionalText(formData, "audioUrl"),
      passage: optionalText(formData, "passage"),
      openAt: optionalDate(formData, "openAt"),
      closeAt: optionalDate(formData, "closeAt"),
      attemptLimit: numberValue(formData, "attemptLimit", 1),
      published: formData.get("published") !== "off",
      createdById: actor.id,
    },
  });

  await logActivity(actor.id, "CREATE_PRACTICE_TEST", "Quiz", test.id);
  revalidatePath("/admin/tests");
  revalidatePath("/elearning/practice");
}

export async function createPracticeSectionAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const quizId = textValue(formData, "quizId");
  const title = textValue(formData, "title");
  if (!quizId || !title) return;

  const test = await canManagePracticeTest(quizId, actor);
  if (!test) return;

  const section = await prisma.testSection.create({
    data: {
      quizId,
      title,
      skill: examSkillValue(textValue(formData, "skill"), "READING"),
      instructions: optionalText(formData, "instructions"),
      audioUrl: optionalText(formData, "audioUrl"),
      passage: optionalText(formData, "passage"),
      order: numberValue(formData, "order"),
    },
  });

  await logActivity(actor.id, "CREATE_TEST_SECTION", "TestSection", section.id);
  revalidatePath("/admin/tests");
  revalidatePath(`/elearning/exercises/${quizId}`);
}

export async function createPracticeQuestionAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const quizId = textValue(formData, "quizId");
  const text = textValue(formData, "text");
  if (!quizId || !text) return;

  const test = await canManagePracticeTest(quizId, actor);
  if (!test) return;

  const sectionId = optionalText(formData, "sectionId");
  if (sectionId) {
    const section = await prisma.testSection.findFirst({ where: { id: sectionId, quizId }, select: { id: true } });
    if (!section) return;
  }

  const optionLines = parseOptionLines(textValue(formData, "options"));
  const correctIndex = numberValue(formData, "correctIndex", 1) - 1;
  const question = await prisma.question.create({
    data: {
      text,
      type: practiceQuestionTypeValue(textValue(formData, "type")),
      audioUrl: optionalText(formData, "audioUrl"),
      passage: optionalText(formData, "passage"),
      answerKey: optionalText(formData, "answerKey"),
      explanation: optionalText(formData, "explanation"),
      points: numberValue(formData, "points", 1),
      createdById: actor.id,
      options: {
        create: optionLines.map((option, index) => ({
          text: option,
          order: index + 1,
          isCorrect: index === correctIndex,
        })),
      },
    },
  });

  await prisma.quizQuestion.create({
    data: {
      quizId,
      sectionId,
      questionId: question.id,
      points: numberValue(formData, "points", 1),
      order: numberValue(formData, "order", 0),
    },
  });

  await logActivity(actor.id, "CREATE_TEST_QUESTION", "Question", question.id);
  revalidatePath("/admin/tests");
  revalidatePath(`/elearning/exercises/${quizId}`);
}

export async function deletePracticeTestAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const id = textValue(formData, "id");
  if (!id) return;

  const test = await canManagePracticeTest(id, actor);
  if (!test) return;

  await prisma.quiz.delete({ where: { id } });
  await logActivity(actor.id, "DELETE_PRACTICE_TEST", "Quiz", id);
  revalidatePath("/admin/tests");
  revalidatePath("/elearning/practice");
}

type ImportedOption = string | { text?: string; isCorrect?: boolean };
type ImportedQuestion = {
  type?: string;
  text?: string;
  points?: number;
  options?: ImportedOption[];
  correctIndex?: number;
  answerKey?: string;
  explanation?: string;
  audioUrl?: string;
  passage?: string;
  order?: number;
};
type ImportedSection = {
  title?: string;
  skill?: string;
  instructions?: string;
  audioUrl?: string;
  passage?: string;
  order?: number;
  questions?: ImportedQuestion[];
};
type ImportedPracticeTest = {
  title?: string;
  description?: string;
  classSectionId?: string;
  examType?: string;
  skill?: string;
  timeLimitMinutes?: number;
  attemptLimit?: number;
  openAt?: string;
  closeAt?: string;
  instructions?: string;
  audioUrl?: string;
  passage?: string;
  sections?: ImportedSection[];
  questions?: ImportedQuestion[];
};

function importedOptions(question: ImportedQuestion) {
  return (question.options || [])
    .map((option, index) => {
      if (typeof option === "string") {
        return {
          text: option.replace(/^[A-D][).:\-\s]+/i, "").trim(),
          order: index + 1,
          isCorrect: question.correctIndex ? index === question.correctIndex - 1 : false,
        };
      }

      return {
        text: (option.text || "").trim(),
        order: index + 1,
        isCorrect: Boolean(option.isCorrect) || Boolean(question.correctIndex && index === question.correctIndex - 1),
      };
    })
    .filter((option) => option.text);
}

async function createImportedPracticeQuestion(
  actorId: string,
  quizId: string,
  sectionId: string | null,
  question: ImportedQuestion,
  fallbackOrder: number,
) {
  const text = (question.text || "").trim();
  if (!text) return;

  const points = Number.isFinite(question.points) ? Number(question.points) : 1;
  const createdQuestion = await prisma.question.create({
    data: {
      text,
      type: practiceQuestionTypeValue(question.type || ""),
      audioUrl: question.audioUrl?.trim() || null,
      passage: question.passage?.trim() || null,
      answerKey: question.answerKey?.trim() || null,
      explanation: question.explanation?.trim() || null,
      points,
      createdById: actorId,
      options: { create: importedOptions(question) },
    },
  });

  await prisma.quizQuestion.create({
    data: {
      quizId,
      sectionId,
      questionId: createdQuestion.id,
      points,
      order: Number.isFinite(question.order) ? Number(question.order) : fallbackOrder,
    },
  });
}

export async function importPracticeTestJsonAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const rawJson = textValue(formData, "json");
  if (!rawJson) return { ok: false, message: "JSON content is required." };

  let payload: ImportedPracticeTest;
  try {
    payload = JSON.parse(rawJson) as ImportedPracticeTest;
  } catch {
    return { ok: false, message: "The JSON content is invalid." };
  }

  const classSectionId = textValue(formData, "classSectionId") || payload.classSectionId || "";
  const title = (payload.title || "").trim();
  if (!title) return { ok: false, message: "A test title is required." };
  if (classSectionId && !await canManageClassSection(classSectionId, actor)) return { ok: false, message: "You cannot manage that classroom." };

  const test = await prisma.quiz.create({
    data: {
      title,
      description: payload.description?.trim() || null,
      classSectionId: classSectionId || null,
      isPracticeTest: true,
      examType: examTypeValue(payload.examType || ""),
      skill: examSkillValue(payload.skill || "", "MIXED"),
      timeLimit: Number.isFinite(payload.timeLimitMinutes) ? Number(payload.timeLimitMinutes) : null,
      attemptLimit: Number.isFinite(payload.attemptLimit) ? Number(payload.attemptLimit) : 1,
      openAt: payload.openAt ? new Date(payload.openAt) : null,
      closeAt: payload.closeAt ? new Date(payload.closeAt) : null,
      instructions: payload.instructions?.trim() || null,
      audioUrl: payload.audioUrl?.trim() || null,
      passage: payload.passage?.trim() || null,
      published: true,
      createdById: actor.id,
    },
  });

  let order = 1;
  for (const sectionPayload of payload.sections || []) {
    const section = await prisma.testSection.create({
      data: {
        quizId: test.id,
        title: sectionPayload.title?.trim() || `Section ${order}`,
        skill: examSkillValue(sectionPayload.skill || "", "READING"),
        instructions: sectionPayload.instructions?.trim() || null,
        audioUrl: sectionPayload.audioUrl?.trim() || null,
        passage: sectionPayload.passage?.trim() || null,
        order: Number.isFinite(sectionPayload.order) ? Number(sectionPayload.order) : order,
      },
    });

    let questionOrder = 1;
    for (const question of sectionPayload.questions || []) {
      await createImportedPracticeQuestion(actor.id, test.id, section.id, question, questionOrder);
      questionOrder += 1;
    }
    order += 1;
  }

  let looseQuestionOrder = order * 100;
  for (const question of payload.questions || []) {
    await createImportedPracticeQuestion(actor.id, test.id, null, question, looseQuestionOrder);
    looseQuestionOrder += 1;
  }

  await prisma.testVersion.create({
    data: {
      quizId: test.id,
      createdById: actor.id,
      version: 1,
      changeNote: "Initial test created",
      snapshot: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
    },
  });

  await logActivity(actor.id, "IMPORT_PRACTICE_TEST_JSON", "Quiz", test.id);
  revalidatePath("/admin/tests");
  revalidatePath("/elearning/practice");
  return { ok: true, message: "Test imported successfully.", testId: test.id };
}

export async function startPracticeTestAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const quizId = textValue(formData, "quizId");
  if (!quizId) return;

  const now = new Date();
  const test = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      isPracticeTest: true,
      published: true,
      classSection: {
        enrollments: {
          some: {
            userId: actor.id,
            status: "ACTIVE",
          },
        },
      },
    },
    include: {
      attempts: {
        where: { studentId: actor.id },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!test) return;
  if ((test.openAt && test.openAt > now) || (test.closeAt && test.closeAt < now)) return;

  const inProgressAttempt = test.attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  if (inProgressAttempt) {
    redirect(`/elearning/exercises/${quizId}?attempt=${inProgressAttempt.id}`);
  }

  if (test.attempts.length >= test.attemptLimit) return;

  const attempt = await prisma.attempt.create({
    data: {
      quizId,
      studentId: actor.id,
      status: "IN_PROGRESS",
    },
  });

  await logActivity(actor.id, "START_PRACTICE_TEST", "Attempt", attempt.id);
  revalidatePath(`/elearning/exercises/${quizId}`);
  redirect(`/elearning/exercises/${quizId}?attempt=${attempt.id}`);
}

export async function savePracticeAnswerAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const attemptId = textValue(formData, "attemptId");
  const questionId = textValue(formData, "questionId");
  if (!attemptId || !questionId) return;

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      studentId: actor.id,
      status: "IN_PROGRESS",
      quiz: {
        isPracticeTest: true,
        questions: { some: { questionId } },
      },
    },
  });
  if (!attempt) return;

  const optionId = optionalText(formData, `question_${questionId}`) || optionalText(formData, "optionId");
  const answerText = optionalText(formData, `answer_${questionId}`) || optionalText(formData, "answerText");

  await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: { optionId, answerText },
    create: { attemptId, questionId, optionId, answerText },
  });

  await logActivity(actor.id, "SAVE_PRACTICE_ANSWER", "AttemptAnswer", `${attemptId}:${questionId}`);
  revalidatePath(`/elearning/exercises/${attempt.quizId}`);
}

async function upsertAttemptGrade(data: {
  studentId: string;
  quizId: string;
  attemptId: string;
  score: number;
  feedback: string;
  gradedById?: string | null;
}) {
  const existingGrade = await prisma.grade.findFirst({ where: { attemptId: data.attemptId } });
  if (existingGrade) {
    await prisma.grade.update({
      where: { id: existingGrade.id },
      data: {
        score: data.score,
        feedback: data.feedback,
        gradedById: data.gradedById || null,
        status: data.gradedById ? "PUBLISHED" : existingGrade.status,
        publishedAt: data.gradedById ? new Date() : existingGrade.publishedAt,
      },
    });
    return;
  }

  await prisma.grade.create({
    data: {
      studentId: data.studentId,
      quizId: data.quizId,
      attemptId: data.attemptId,
      score: data.score,
      feedback: data.feedback,
      gradedById: data.gradedById || null,
      status: data.gradedById ? "PUBLISHED" : "DRAFT",
      publishedAt: data.gradedById ? new Date() : null,
    },
  });
}

export async function submitPracticeTestAttemptAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const attemptId = textValue(formData, "attemptId");
  if (!attemptId) return;

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      studentId: actor.id,
      status: "IN_PROGRESS",
      quiz: { isPracticeTest: true },
    },
    include: {
      answers: true,
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { question: { include: { options: { orderBy: { order: "asc" } } } } },
          },
        },
      },
    },
  });
  if (!attempt) return;

  let score = 0;
  let requiresManualGrade = false;
  const autoSubmitted = textValue(formData, "autoSubmit") === "true";

  for (const link of attempt.quiz.questions) {
    const question = link.question;
    const existingAnswer = attempt.answers.find((answer) => answer.questionId === question.id);
    const selectedOptionId = optionalText(formData, `question_${question.id}`) || existingAnswer?.optionId || null;
    const typedAnswer = optionalText(formData, `answer_${question.id}`) || existingAnswer?.answerText || null;
    let optionId: string | null = null;
    let answerText: string | null = typedAnswer;
    let isCorrect: boolean | null = null;
    let pointsAwarded: number | null = null;

    if (question.options.length > 0) {
      optionId = selectedOptionId;
      answerText = null;
      const selectedOption = question.options.find((option) => option.id === optionId);
      isCorrect = Boolean(selectedOption?.isCorrect);
      pointsAwarded = isCorrect ? link.points : 0;
    } else if (question.type === "FILL_BLANK" || question.type === "SHORT_ANSWER" || question.type === "GRID") {
      const textCorrect = isTextAnswerCorrect(typedAnswer || "", question.answerKey);
      if (textCorrect !== null) {
        isCorrect = textCorrect;
        pointsAwarded = isCorrect ? link.points : 0;
      } else {
        requiresManualGrade = true;
        pointsAwarded = 0;
      }
    } else if (["READING", "LISTENING", "SECTION", "INFO"].includes(question.type)) {
      isCorrect = null;
      pointsAwarded = 0;
    } else {
      requiresManualGrade = true;
      pointsAwarded = 0;
    }

    score += pointsAwarded || 0;

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
      update: {
        optionId,
        answerText,
        isCorrect,
        pointsAwarded,
      },
      create: {
        attemptId: attempt.id,
        questionId: question.id,
        optionId,
        answerText,
        isCorrect,
        pointsAwarded,
      },
    });
  }

  await prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      submittedAt: new Date(),
      score,
      status: requiresManualGrade ? (autoSubmitted ? "AUTO_SUBMITTED" : "SUBMITTED") : "GRADED",
    },
  });

  await upsertAttemptGrade({
    studentId: actor.id,
    quizId: attempt.quizId,
    attemptId: attempt.id,
    score,
    feedback: requiresManualGrade
      ? "Auto score saved. Writing/essay answers need teacher grading."
      : "Auto-graded practice test.",
    gradedById: requiresManualGrade ? null : undefined,
  });

  await logActivity(actor.id, autoSubmitted ? "AUTO_SUBMIT_PRACTICE_TEST" : "SUBMIT_PRACTICE_TEST", "Attempt", attempt.id);
  revalidatePath("/elearning/practice");
  revalidatePath(`/elearning/exercises/${attempt.quizId}`);
  revalidatePath("/elearning/scores");
  revalidatePath("/admin/tests");
  revalidatePath("/admin/grades");
  redirect("/elearning/practice?tab=tests");
}

export async function gradePracticeAttemptAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const attemptId = textValue(formData, "attemptId");
  const score = numberValue(formData, "score");
  if (!attemptId) return;

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      ...(actor.role === "TEACHER" ? { OR: [{ quizDelivery: { classSection: { teacherId: actor.id } } }, { quiz: { classSection: { teacherId: actor.id } } }] } : {}),
    },
    include: { quiz: true },
  });
  if (!attempt) return;

  await prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      score,
      status: "GRADED",
    },
  });

  await upsertAttemptGrade({
    studentId: attempt.studentId,
    quizId: attempt.quizId,
    attemptId: attempt.id,
    score,
    feedback: optionalText(formData, "feedback") || "Teacher graded practice test.",
    gradedById: actor.id,
  });

  await logActivity(actor.id, "GRADE_PRACTICE_ATTEMPT", "Attempt", attempt.id);
  revalidatePath("/admin/tests");
  revalidatePath("/admin/grades");
  revalidatePath("/elearning/scores");
}

export async function submitQuizAttemptAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const quizId = textValue(formData, "quizId");
  const quizDeliveryId = textValue(formData, "quizDeliveryId") || null;
  if (!quizId) return;

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId },
    include: {
      classSection: { include: { enrollments: true } },
      deliveries: {
        where: quizDeliveryId ? { id: quizDeliveryId } : { id: "__none__" },
        include: { classSection: { include: { enrollments: true } } },
      },
      questions: {
        orderBy: { order: "asc" },
        include: {
          question: { include: { options: true } },
        },
      },
      attempts: {
        where: { studentId: actor.id },
      },
    },
  });

  if (!quiz) return;

  const isEnrolled = quiz.classSection?.status === "ACTIVE" && quiz.classSection.enrollments.some(
    (enrollment) => enrollment.userId === actor.id && enrollment.status === "ACTIVE",
  );

  const delivery = quiz.deliveries[0] || null;
  const deliveryEnrollment = delivery?.classSection.enrollments.some(
    (enrollment) => enrollment.userId === actor.id && enrollment.status === "ACTIVE",
  ) || false;
  const now = new Date();
  const deliveryAvailable = delivery
    && delivery.status === "PUBLISHED"
    && delivery.classSection.status === "ACTIVE"
    && (!delivery.openAt || delivery.openAt <= now)
    && (!delivery.dueAt || delivery.dueAt >= now)
    && deliveryEnrollment;
  const scopedAttempts = quiz.attempts.filter((attempt) => attempt.quizDeliveryId === quizDeliveryId);
  const limit = delivery?.attemptLimit || quiz.attemptLimit;

  if ((!deliveryAvailable && !quiz.isOpenQuiz && !isEnrolled) || scopedAttempts.length >= limit) return;

  let score = 0;
  let requiresManualGrade = false;
  let autoGradableQuestions = 0;

  const attempt = await prisma.attempt.create({
    data: {
      quizId,
      quizDeliveryId,
      studentId: actor.id,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  for (const link of quiz.questions) {
    const question = link.question;
    const fieldName = `question_${question.id}`;
    const rawAnswer = textValue(formData, fieldName);
    let optionId: string | null = null;
    let answerText: string | null = rawAnswer || null;
    let isCorrect: boolean | null = null;
    let pointsAwarded: number | null = null;

    if (link.points <= 0 && !question.answerKey && question.options.length === 0) {
      isCorrect = null;
      pointsAwarded = 0;
      answerText = null;
    } else if (question.type === "MULTIPLE_CHOICE") {
      optionId = rawAnswer || null;
      answerText = null;
      const selectedOption = question.options.find((option) => option.id === optionId);
      const hasCorrectOption = question.options.some((option) => option.isCorrect);

      if (hasCorrectOption) {
        autoGradableQuestions += 1;
        isCorrect = Boolean(selectedOption?.isCorrect);
        pointsAwarded = isCorrect ? link.points : 0;
      } else {
        requiresManualGrade = true;
      }
    } else if (question.type === "FILL_BLANK" || question.type === "SHORT_ANSWER" || question.type === "GRID") {
      const textCorrect = isTextAnswerCorrect(rawAnswer, question.answerKey);
      if (textCorrect !== null) {
        autoGradableQuestions += 1;
        isCorrect = textCorrect;
        pointsAwarded = isCorrect ? link.points : 0;
      } else {
        requiresManualGrade = true;
      }
    } else if (["READING", "LISTENING", "SECTION", "INFO"].includes(question.type)) {
      isCorrect = null;
      pointsAwarded = 0;
    } else {
      requiresManualGrade = true;
    }

    score += pointsAwarded || 0;

    await prisma.attemptAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        optionId,
        answerText,
        isCorrect,
        pointsAwarded,
      },
    });
  }

  await prisma.attempt.update({
    where: { id: attempt.id },
    data: {
      score: requiresManualGrade && autoGradableQuestions === 0 ? null : score,
      status: requiresManualGrade ? "SUBMITTED" : "GRADED",
    },
  });

  if (!requiresManualGrade) {
    await prisma.grade.create({
      data: {
        studentId: actor.id,
        quizId,
        attemptId: attempt.id,
        score,
        feedback: "Auto-graded multiple choice/fill blank quiz.",
      },
    });
  }

  await logActivity(actor.id, "SUBMIT_ATTEMPT", "Attempt", attempt.id);
  revalidatePath("/elearning/exercises");
  revalidatePath(`/elearning/exercises/${quizId}`);
  revalidatePath("/elearning/scores");
  revalidatePath("/admin/grades");
  redirect(`/elearning/exercises/${quizId}?attempt=${attempt.id}&submitted=1${quizDeliveryId ? `&delivery=${quizDeliveryId}` : ""}`);
}

export async function startAttemptAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const quizId = textValue(formData, "quizId");
  if (!quizId) return;

  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, isPracticeTest: false },
    include: {
      classSection: { include: { enrollments: true } },
      attempts: { where: { studentId: actor.id } },
    },
  });
  if (!quiz) return;

  const isEnrolled = quiz.classSection?.enrollments.some(
    (enrollment) => enrollment.userId === actor.id && enrollment.status === "ACTIVE",
  ) ?? false;
  if ((!quiz.isOpenQuiz && !isEnrolled) || quiz.attempts.length >= quiz.attemptLimit) return;

  const attempt = await prisma.attempt.create({
    data: {
      quizId,
      studentId: actor.id,
      status: "IN_PROGRESS",
    },
  });

  await logActivity(actor.id, "START_ATTEMPT", "Attempt", attempt.id);
  revalidatePath(`/elearning/exercises/${quizId}`);
}

export async function saveAttemptAnswerAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const attemptId = textValue(formData, "attemptId");
  const questionId = textValue(formData, "questionId");
  if (!attemptId || !questionId) return;

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { quiz: true },
  });
  if (!attempt || attempt.studentId !== actor.id || attempt.status !== "IN_PROGRESS" || attempt.quiz.isPracticeTest) return;

  const optionId = optionalText(formData, "optionId");
  const answerText = optionalText(formData, "answerText");

  await prisma.attemptAnswer.upsert({
    where: {
      attemptId_questionId: {
        attemptId,
        questionId,
      },
    },
    update: { optionId, answerText },
    create: {
      attemptId,
      questionId,
      optionId,
      answerText,
    },
  });

  await logActivity(actor.id, "SAVE_ATTEMPT_ANSWER", "Attempt", attemptId);
  revalidatePath(`/elearning/exercises/${attempt.quizId}`);
}

export async function gradeSubmissionAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const submissionId = textValue(formData, "submissionId");
  const score = numberValue(formData, "score");
  const mode = textValue(formData, "mode") || "publish";
  if (!submissionId) return;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { assignment: { include: { classSection: { select: { teacherId: true } } } } },
  });
  if (!submission) return;
  if (actor.role === "TEACHER" && submission.assignment.classSection.teacherId !== actor.id) {
    throw new Error("You do not have permission to grade this submission.");
  }

  const normalizedScore = Math.min(submission.assignment.maxScore, Math.max(0, score));
  const gradeStatus = mode === "save_draft" ? "DRAFT" : mode === "request_revision" ? "REVISION_REQUESTED" : "PUBLISHED";
  const submissionStatus = mode === "request_revision" ? "REVISION_REQUESTED" : mode === "save_draft" ? "SUBMITTED" : "GRADED";

  await prisma.$transaction([
    prisma.grade.upsert({
      where: { submissionId },
      update: { score: normalizedScore, feedback: optionalText(formData, "feedback"), gradedById: actor.id, status: gradeStatus, publishedAt: gradeStatus === "PUBLISHED" ? new Date() : null },
      create: { submissionId, studentId: submission.studentId, assignmentId: submission.assignmentId, score: normalizedScore, feedback: optionalText(formData, "feedback"), gradedById: actor.id, status: gradeStatus, publishedAt: gradeStatus === "PUBLISHED" ? new Date() : null },
    }),
    prisma.submission.update({ where: { id: submissionId }, data: { status: submissionStatus } }),
  ]);

  await logActivity(actor.id, "GRADE_SUBMISSION", "Submission", submissionId);
  revalidatePath("/admin/grades");
  revalidatePath("/elearning/scores");
  revalidatePath(`/elearning/classrooms/${submission.assignment.classSectionId}`);
  revalidatePath("/elearning");
}

export async function gradeSubmissionWithStateAction(
  _state: { ok: boolean; message: string },
  formData: FormData,
) {
  const scoreText = textValue(formData, "score");
  const score = Number(scoreText);
  const maxScore = Math.max(1, numberValue(formData, "maxScore", 100));
  if (!scoreText || !Number.isFinite(score) || score < 0 || score > maxScore) {
    return { ok: false, message: `Enter a score between 0 and ${maxScore}.` };
  }
  try {
    await gradeSubmissionAction(formData);
    const mode = textValue(formData, "mode") || "publish";
    return { ok: true, message: mode === "save_draft" ? "Grading draft saved." : mode === "request_revision" ? "Revision requested from the student." : "Score and feedback published to the student." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not publish this score." };
  }
}

export async function assignLessonToClassAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const lessonId = textValue(formData, "lessonId");
  const classSectionId = textValue(formData, "classSectionId");
  if (!lessonId || !classSectionId) return;

  const classroom = await canManageClassSection(classSectionId, actor);
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true } });
  const classCourse = await prisma.classSection.findUnique({ where: { id: classSectionId }, select: { courseId: true } });
  if (!classroom || !lesson || !classCourse || lesson.courseId !== classCourse.courseId) {
    throw new Error("This lesson does not belong to the classroom course.");
  }

  await prisma.lessonDelivery.upsert({
    where: { lessonId_classSectionId: { lessonId, classSectionId } },
    update: {
      status: "PUBLISHED",
      availableAt: optionalDate(formData, "availableAt"),
      dueAt: optionalDate(formData, "dueAt"),
      assignedById: actor.id,
    },
    create: {
      lessonId,
      classSectionId,
      assignedById: actor.id,
      status: "PUBLISHED",
      availableAt: optionalDate(formData, "availableAt"),
      dueAt: optionalDate(formData, "dueAt"),
    },
  });

  await logActivity(actor.id, "ASSIGN_LESSON", "LessonDelivery", `${lessonId}:${classSectionId}`);
  revalidatePath(`/elearning/classrooms/${classSectionId}`);
  revalidatePath("/elearning/courses");
  revalidatePath("/elearning");
}

export async function assignQuizToClassAction(formData: FormData) {
  const actor = await requireTeacherOrAdmin();
  const quizId = textValue(formData, "quizId");
  const classSectionId = textValue(formData, "classSectionId");
  if (!quizId || !classSectionId) return;

  const [classroom, quiz] = await Promise.all([
    canManageClassSection(classSectionId, actor),
    prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true, published: true, attemptLimit: true } }),
  ]);
  if (!classroom || !quiz || !quiz.published) throw new Error("The selected test is not available to assign.");

  await prisma.quizDelivery.upsert({
    where: { quizId_classSectionId: { quizId, classSectionId } },
    update: {
      status: "PUBLISHED",
      openAt: optionalDate(formData, "openAt"),
      dueAt: optionalDate(formData, "dueAt"),
      showAnswersAt: optionalDate(formData, "showAnswersAt"),
      attemptLimit: Math.max(1, numberValue(formData, "attemptLimit", quiz.attemptLimit)),
      assignedById: actor.id,
    },
    create: {
      quizId,
      classSectionId,
      assignedById: actor.id,
      status: "PUBLISHED",
      openAt: optionalDate(formData, "openAt"),
      dueAt: optionalDate(formData, "dueAt"),
      showAnswersAt: optionalDate(formData, "showAnswersAt"),
      attemptLimit: Math.max(1, numberValue(formData, "attemptLimit", quiz.attemptLimit)),
    },
  });

  await logActivity(actor.id, "ASSIGN_QUIZ", "QuizDelivery", `${quizId}:${classSectionId}`);
  revalidatePath(`/elearning/classrooms/${classSectionId}`);
  revalidatePath("/elearning/practice");
  revalidatePath("/elearning");
}

export async function markLessonProgressAction(formData: FormData) {
  const actor = await requireUser(["STUDENT"]);
  const lessonDeliveryId = textValue(formData, "lessonDeliveryId");
  const requestedStatus = textValue(formData, "status");
  const status = requestedStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
  if (!lessonDeliveryId) return;

  const delivery = await prisma.lessonDelivery.findFirst({
    where: {
      id: lessonDeliveryId,
      status: "PUBLISHED",
      classSection: { enrollments: { some: { userId: actor.id, status: "ACTIVE" } } },
    },
    select: { id: true, lessonId: true },
  });
  if (!delivery) throw new Error("This lesson has not been assigned to you.");

  await prisma.lessonProgress.upsert({
    where: { lessonDeliveryId_studentId: { lessonDeliveryId, studentId: actor.id } },
    update: {
      status,
      startedAt: new Date(),
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
    create: {
      lessonDeliveryId,
      studentId: actor.id,
      status,
      startedAt: new Date(),
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  revalidatePath(`/elearning/learn/${delivery.lessonId}`);
  revalidatePath("/elearning");
}

type AiWritingGrade = {
  score: number;
  confidence: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  rubric: Array<{ criterion: string; score: number; comment: string }>;
};

function responseOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof data.output_text === "string") return data.output_text;
  return data.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || "";
}

export async function aiGradeWritingSubmissionAction(
  _state: { ok: boolean; message: string },
  formData: FormData,
) {
  const actor = await requireTeacherOrAdmin();
  const submissionId = textValue(formData, "submissionId");
  if (!submissionId) return { ok: false, message: "Submission is missing." };

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { student: true, assignment: { include: { classSection: true } } },
  });
  if (!submission || (actor.role === "TEACHER" && submission.assignment.classSection.teacherId !== actor.id)) {
    return { ok: false, message: "You do not have permission to review this submission." };
  }
  if (!submission.content?.trim()) return { ok: false, message: "AI grading requires a written response." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, message: "Set OPENAI_API_KEY to enable AI grading. Manual grading remains available." };

  const model = process.env.OPENAI_GRADING_MODEL || "gpt-5.4-mini";
  const maxScore = submission.assignment.maxScore;
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["score", "confidence", "feedback", "strengths", "improvements", "rubric"],
    properties: {
      score: { type: "number", minimum: 0, maximum: maxScore },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      feedback: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      improvements: { type: "array", items: { type: "string" } },
      rubric: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["criterion", "score", "comment"],
          properties: {
            criterion: { type: "string" },
            score: { type: "number", minimum: 0, maximum: maxScore },
            comment: { type: "string" },
          },
        },
      },
    },
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: "You are an English writing assessment assistant. Apply the teacher rubric exactly. Return a conservative draft score and actionable feedback. Your result is advisory and must be approved by a teacher." }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: `Assignment: ${submission.assignment.title}\nLevel: ${submission.assignment.cefrLevel || "Not specified"}\nMaximum score: ${maxScore}\nTeacher rubric: ${submission.assignment.rubric || "Assess task achievement, coherence, vocabulary, and grammar."}\nInstructions: ${submission.assignment.instructions || submission.assignment.description || "No extra instructions."}\n\nStudent response:\n${submission.content}`,
            }],
          },
        ],
        text: { format: { type: "json_schema", name: "writing_grade", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status}).`);
    const payload = await response.json();
    const result = JSON.parse(responseOutputText(payload)) as AiWritingGrade;
    const score = Math.min(maxScore, Math.max(0, result.score));
    const feedback = `${result.feedback}\n\nStrengths:\n- ${result.strengths.join("\n- ")}\n\nImprovements:\n- ${result.improvements.join("\n- ")}`;

    await prisma.grade.upsert({
      where: { submissionId },
      update: { score, feedback, status: "DRAFT", aiScore: score, aiFeedback: feedback, aiRubric: result.rubric, aiConfidence: result.confidence, aiModel: model, aiReviewedAt: new Date() },
      create: { submissionId, assignmentId: submission.assignmentId, studentId: submission.studentId, score, feedback, status: "DRAFT", aiScore: score, aiFeedback: feedback, aiRubric: result.rubric, aiConfidence: result.confidence, aiModel: model, aiReviewedAt: new Date() },
    });
    await logActivity(actor.id, "AI_GRADE_DRAFT", "Submission", submissionId);
    revalidatePath("/elearning/scores");
    revalidatePath("/elearning");
    return { ok: true, message: "AI draft created. Review the score and feedback before publishing." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "AI grading could not be completed." };
  }
}

export async function aiGradeWritingAttemptAction(
  _state: { ok: boolean; message: string },
  formData: FormData,
) {
  const actor = await requireTeacherOrAdmin();
  const attemptId = textValue(formData, "attemptId");
  if (!attemptId) return { ok: false, message: "Attempt is missing." };

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      student: true,
      quizDelivery: { include: { classSection: true } },
      quiz: {
        include: {
          classSection: true,
          questions: { include: { question: true } },
        },
      },
      answers: { include: { question: true } },
    },
  });
  const teacherOwnsAttempt = attempt && (
    attempt.quizDelivery?.classSection.teacherId === actor.id || attempt.quiz.classSection?.teacherId === actor.id
  );
  if (!attempt || (actor.role === "TEACHER" && !teacherOwnsAttempt)) {
    return { ok: false, message: "You do not have permission to review this attempt." };
  }

  const writtenAnswers = attempt.answers.filter((answer) =>
    Boolean(answer.answerText?.trim()) && ["ESSAY", "SHORT_ANSWER"].includes(answer.question.type),
  );
  if (!writtenAnswers.length) return { ok: false, message: "AI grading requires at least one written response." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, message: "Set OPENAI_API_KEY to enable AI grading. Manual grading remains available." };

  const pointByQuestion = new Map(attempt.quiz.questions.map((link) => [link.questionId, link.points]));
  const writingMaxScore = writtenAnswers.reduce((sum, answer) => sum + (pointByQuestion.get(answer.questionId) || 0), 0);
  if (writingMaxScore <= 0) return { ok: false, message: "Written questions need a positive point value before AI grading." };
  const autoScore = attempt.answers
    .filter((answer) => !writtenAnswers.some((written) => written.id === answer.id))
    .reduce((sum, answer) => sum + (answer.pointsAwarded || 0), 0);
  const totalMaxScore = attempt.quiz.questions.reduce((sum, link) => sum + link.points, 0);
  const model = process.env.OPENAI_GRADING_MODEL || "gpt-5.4-mini";
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["score", "confidence", "feedback", "strengths", "improvements", "rubric"],
    properties: {
      score: { type: "number", minimum: 0, maximum: writingMaxScore },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      feedback: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      improvements: { type: "array", items: { type: "string" } },
      rubric: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["criterion", "score", "comment"],
          properties: {
            criterion: { type: "string" },
            score: { type: "number", minimum: 0, maximum: writingMaxScore },
            comment: { type: "string" },
          },
        },
      },
    },
  };

  try {
    const responses = writtenAnswers.map((answer, index) =>
      `Question ${index + 1} (${pointByQuestion.get(answer.questionId) || 0} points): ${answer.question.text}\nStudent response: ${answer.answerText}`,
    ).join("\n\n");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: [{ type: "input_text", text: "You are an English writing assessment assistant. Produce a conservative advisory draft. A teacher must review and publish the final grade." }] },
          { role: "user", content: [{ type: "input_text", text: `Test: ${attempt.quiz.title}\nMaximum writing score: ${writingMaxScore}\nInstructions: ${attempt.quiz.instructions || attempt.quiz.description || "Assess task achievement, coherence, vocabulary, and grammar."}\n\n${responses}` }] },
        ],
        text: { format: { type: "json_schema", name: "test_writing_grade", strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status}).`);
    const payload = await response.json();
    const result = JSON.parse(responseOutputText(payload)) as AiWritingGrade;
    const writingScore = Math.min(writingMaxScore, Math.max(0, result.score));
    const score = Math.min(totalMaxScore, autoScore + writingScore);
    const feedback = `${result.feedback}\n\nStrengths:\n- ${result.strengths.join("\n- ")}\n\nImprovements:\n- ${result.improvements.join("\n- ")}`;
    const existingGrade = await prisma.grade.findFirst({ where: { attemptId } });
    const gradeData = { score, feedback, status: "DRAFT" as const, publishedAt: null, gradedById: null, aiScore: score, aiFeedback: feedback, aiRubric: result.rubric, aiConfidence: result.confidence, aiModel: model, aiReviewedAt: new Date() };
    if (existingGrade) await prisma.grade.update({ where: { id: existingGrade.id }, data: gradeData });
    else await prisma.grade.create({ data: { ...gradeData, attemptId, quizId: attempt.quizId, studentId: attempt.studentId } });

    await logActivity(actor.id, "AI_GRADE_DRAFT", "Attempt", attemptId);
    revalidatePath(`/elearning/exercises/${attempt.quizId}`);
    revalidatePath("/elearning/scores");
    revalidatePath("/elearning");
    return { ok: true, message: "AI draft created. Review and publish the final score below." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "AI grading could not be completed." };
  }
}


