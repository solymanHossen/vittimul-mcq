import { PrismaClient } from '@prisma/client';
import type { Seeder } from './seeder.interface';

/**
 * Seeds a small, realistic slice of the EdTech domain: taxonomy (categories
 * -> subjects -> topics, with one sub-topic to demonstrate nesting),
 * questions with options, subscription packages, and one published, live,
 * ready-to-attempt exam — enough for a fresh clone to exercise every module
 * from Phase 2-4 immediately after `npm run prisma:seed`.
 *
 * Every step is independently idempotent (upsert by natural key, or
 * find-then-create for Question, which has none) rather than gated behind a
 * single top-level "already seeded?" check. That matters here specifically:
 * `Question.createdById`/`verifiedById` are FKs to `users`, so UserSeeder's
 * `TRUNCATE users CASCADE` (which always runs first) transitively wipes
 * `questions` — and with it `question_options` and `exam_questions` — on
 * every single seed run, while Category/Subject/Topic/Package/Exam (no FK to
 * `users`) survive untouched. A single coarse "category already exists, skip
 * everything" guard would therefore leave the exam pointing at zero
 * questions after the second `npm run prisma:seed`. Per-entity idempotency
 * self-heals that every time instead. Unlike UserSeeder, nothing here is
 * ever TRUNCATEd — Category/Subject/Topic/Question sit at the root of a wide
 * FK fan-out (favorites, the SRS queue, comments, exam attempts, ...), and a
 * `TRUNCATE ... CASCADE` would blow away far more than sample data.
 */
export class EdTechSeeder implements Seeder {
  readonly name = 'EdTechSeeder';
  readonly description = 'Seeds sample taxonomy, questions, packages, and one live exam';
  readonly order = 2;

  private static readonly ROOT_CATEGORY_SLUG = 'bank-job-preparation';

  async seed(prisma: PrismaClient): Promise<void> {
    const taxonomy = await this.seedTaxonomy(prisma);
    console.info(
      `🌳 Ensured ${taxonomy.categoryCount} categories, ${taxonomy.subjectCount} subjects, ${taxonomy.topicCount} topics.`,
    );

    const questionIds = await this.seedQuestions(prisma, taxonomy.topicBySlug);
    console.info(`❓ Ensured ${questionIds.length} questions with options.`);

    const packageCount = await this.seedPackages(prisma);
    console.info(`📦 Ensured ${packageCount} subscription packages.`);

    await this.seedLiveExam(prisma, questionIds);
    console.info('🎯 Ensured one published, live, ready-to-attempt exam.');
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    // Deleting the root categories cascades to every subject/topic beneath
    // them (onDelete: Cascade in the schema). Questions are preserved
    // (Question.topic is onDelete: SetNull) since exam attempts or other
    // seeders/tests may still reference them.
    await prisma.category.deleteMany({
      where: { slug: { in: [EdTechSeeder.ROOT_CATEGORY_SLUG, 'bcs-preliminary'] } },
    });
    await prisma.package.deleteMany({
      where: { slug: { in: ['1-month-premium', '3-months-premium', '1-year-premium'] } },
    });
    await prisma.exam.deleteMany({ where: { slug: 'weekly-mock-test-1' } });
    console.info('↩️  EdTechSeeder rolled back.');
  }

  // ── Taxonomy ─────────────────────────────────────────────────────────────

  private async seedTaxonomy(prisma: PrismaClient): Promise<{
    topicBySlug: Map<string, number>;
    categoryCount: number;
    subjectCount: number;
    topicCount: number;
  }> {
    const topicBySlug = new Map<string, number>();
    let subjectCount = 0;
    let topicCount = 0;

    const categoriesPlan = [
      {
        name: 'Bank Job Preparation',
        slug: EdTechSeeder.ROOT_CATEGORY_SLUG,
        description: 'MCQs for bank recruitment and other competitive exams',
        subjects: [
          {
            name: 'English',
            slug: 'english',
            topics: [
              { name: 'Grammar', slug: 'grammar', subTopics: [{ name: 'Tenses', slug: 'tenses' }] },
              { name: 'Vocabulary', slug: 'vocabulary', subTopics: [] },
            ],
          },
          {
            name: 'Mathematics',
            slug: 'mathematics',
            topics: [
              { name: 'Arithmetic', slug: 'arithmetic', subTopics: [] },
              { name: 'Algebra', slug: 'algebra', subTopics: [] },
            ],
          },
          {
            name: 'General Knowledge',
            slug: 'general-knowledge',
            topics: [
              { name: 'Bangladesh Affairs', slug: 'bangladesh-affairs', subTopics: [] },
              { name: 'International Affairs', slug: 'international-affairs', subTopics: [] },
            ],
          },
        ],
      },
      {
        name: 'BCS Preliminary',
        slug: 'bcs-preliminary',
        description: 'MCQs for BCS preliminary examination preparation',
        subjects: [
          {
            name: 'Bengali',
            slug: 'bengali',
            topics: [{ name: 'Literature', slug: 'literature', subTopics: [] }],
          },
          {
            name: 'Science',
            slug: 'science',
            topics: [{ name: 'General Science', slug: 'general-science', subTopics: [] }],
          },
        ],
      },
    ];

    for (const [categoryIndex, categoryPlan] of categoriesPlan.entries()) {
      const category = await prisma.category.upsert({
        where: { slug: categoryPlan.slug },
        create: {
          name: categoryPlan.name,
          slug: categoryPlan.slug,
          description: categoryPlan.description,
          displayOrder: categoryIndex,
        },
        update: {},
      });

      for (const [subjectIndex, subjectPlan] of categoryPlan.subjects.entries()) {
        const subject = await prisma.subject.upsert({
          where: { categoryId_slug: { categoryId: category.id, slug: subjectPlan.slug } },
          create: {
            categoryId: category.id,
            name: subjectPlan.name,
            slug: subjectPlan.slug,
            displayOrder: subjectIndex,
          },
          update: {},
        });
        subjectCount++;

        for (const [topicIndex, topicPlan] of subjectPlan.topics.entries()) {
          const topic = await prisma.topic.upsert({
            where: { subjectId_slug: { subjectId: subject.id, slug: topicPlan.slug } },
            create: {
              subjectId: subject.id,
              name: topicPlan.name,
              slug: topicPlan.slug,
              displayOrder: topicIndex,
            },
            update: {},
          });
          topicCount++;
          topicBySlug.set(topicPlan.slug, topic.id);

          for (const [subTopicIndex, subTopicPlan] of topicPlan.subTopics.entries()) {
            const subTopic = await prisma.topic.upsert({
              where: { subjectId_slug: { subjectId: subject.id, slug: subTopicPlan.slug } },
              create: {
                subjectId: subject.id,
                parentId: topic.id,
                name: subTopicPlan.name,
                slug: subTopicPlan.slug,
                displayOrder: subTopicIndex,
              },
              update: {},
            });
            topicCount++;
            topicBySlug.set(subTopicPlan.slug, subTopic.id);
          }
        }
      }
    }

    return { topicBySlug, categoryCount: categoriesPlan.length, subjectCount, topicCount };
  }

  // ── Questions ────────────────────────────────────────────────────────────

  private async seedQuestions(
    prisma: PrismaClient,
    topicBySlug: Map<string, number>,
  ): Promise<bigint[]> {
    const questionsPlan = [
      {
        topicSlug: 'bangladesh-affairs',
        questionText: 'What is the capital of Bangladesh?',
        options: [
          { label: 'A', text: 'Dhaka', correct: true },
          { label: 'B', text: 'Chittagong', correct: false },
          { label: 'C', text: 'Khulna', correct: false },
          { label: 'D', text: 'Rajshahi', correct: false },
        ],
      },
      {
        topicSlug: 'bangladesh-affairs',
        questionText: 'What is the official currency of Bangladesh?',
        options: [
          { label: 'A', text: 'Rupee', correct: false },
          { label: 'B', text: 'Taka', correct: true },
          { label: 'C', text: 'Dinar', correct: false },
          { label: 'D', text: 'Dollar', correct: false },
        ],
      },
      {
        topicSlug: 'bangladesh-affairs',
        questionText: 'Who is widely regarded as the national poet of Bangladesh?',
        options: [
          { label: 'A', text: 'Rabindranath Tagore', correct: false },
          { label: 'B', text: 'Jasimuddin', correct: false },
          { label: 'C', text: 'Kazi Nazrul Islam', correct: true },
          { label: 'D', text: 'Jibanananda Das', correct: false },
        ],
      },
      {
        topicSlug: 'international-affairs',
        questionText: 'The headquarters of the United Nations is located in which city?',
        options: [
          { label: 'A', text: 'Geneva', correct: false },
          { label: 'B', text: 'New York', correct: true },
          { label: 'C', text: 'Paris', correct: false },
          { label: 'D', text: 'London', correct: false },
        ],
      },
      {
        topicSlug: 'vocabulary',
        questionText: "Choose the correct synonym of 'Ubiquitous'.",
        options: [
          { label: 'A', text: 'Rare', correct: false },
          { label: 'B', text: 'Omnipresent', correct: true },
          { label: 'C', text: 'Hidden', correct: false },
          { label: 'D', text: 'Temporary', correct: false },
        ],
      },
      {
        topicSlug: 'tenses',
        questionText: 'Identify the sentence written in the Present Perfect tense.',
        options: [
          { label: 'A', text: 'She is reading a book.', correct: false },
          { label: 'B', text: 'She read a book.', correct: false },
          { label: 'C', text: 'She has read a book.', correct: true },
          { label: 'D', text: 'She will read a book.', correct: false },
        ],
      },
      {
        topicSlug: 'arithmetic',
        questionText: 'What is 15% of 200?',
        options: [
          { label: 'A', text: '20', correct: false },
          { label: 'B', text: '25', correct: false },
          { label: 'C', text: '30', correct: true },
          { label: 'D', text: '35', correct: false },
        ],
      },
      {
        topicSlug: 'algebra',
        questionText: 'Solve for x: 2x + 5 = 15',
        options: [
          { label: 'A', text: 'x = 3', correct: false },
          { label: 'B', text: 'x = 5', correct: true },
          { label: 'C', text: 'x = 7', correct: false },
          { label: 'D', text: 'x = 10', correct: false },
        ],
      },
      {
        topicSlug: 'general-science',
        questionText: "Which gas makes up the largest share of Earth's atmosphere?",
        options: [
          { label: 'A', text: 'Oxygen', correct: false },
          { label: 'B', text: 'Carbon Dioxide', correct: false },
          { label: 'C', text: 'Nitrogen', correct: true },
          { label: 'D', text: 'Hydrogen', correct: false },
        ],
      },
      {
        topicSlug: 'arithmetic',
        questionText: 'Which of the following numbers are prime? (Select all that apply)',
        isMultipleChoice: true,
        options: [
          { label: 'A', text: '2', correct: true },
          { label: 'B', text: '4', correct: false },
          { label: 'C', text: '7', correct: true },
          { label: 'D', text: '9', correct: false },
        ],
      },
    ];

    const questionIds: bigint[] = [];

    for (const plan of questionsPlan) {
      const topicId = topicBySlug.get(plan.topicSlug);

      // Question has no natural unique key, so idempotency here is
      // find-by-content-then-create rather than a Prisma `upsert`. This is
      // also what self-heals the rows UserSeeder's cascade wipes on every
      // run — see the class-level comment.
      const existing = await prisma.question.findFirst({
        where: { topicId, questionText: plan.questionText },
        select: { id: true },
      });
      if (existing) {
        questionIds.push(existing.id);
        continue;
      }

      const question = await prisma.question.create({
        data: {
          topicId,
          questionText: plan.questionText,
          isMultipleChoice: plan.isMultipleChoice ?? false,
          options: {
            create: plan.options.map((option, index) => ({
              optionLabel: option.label,
              optionText: option.text,
              isCorrect: option.correct,
              displayOrder: index + 1,
            })),
          },
        },
        select: { id: true },
      });
      questionIds.push(question.id);
    }

    return questionIds;
  }

  // ── Packages ─────────────────────────────────────────────────────────────

  private async seedPackages(prisma: PrismaClient): Promise<number> {
    const packagesPlan = [
      {
        title: '1 Month Premium',
        slug: '1-month-premium',
        durationDays: 30,
        basePrice: 399,
        sellingPrice: 299,
        isPopular: false,
      },
      {
        title: '3 Months Premium',
        slug: '3-months-premium',
        durationDays: 90,
        basePrice: 999,
        sellingPrice: 799,
        isPopular: true,
      },
      {
        title: '1 Year Premium',
        slug: '1-year-premium',
        durationDays: 365,
        basePrice: 2999,
        sellingPrice: 1999,
        isPopular: false,
      },
    ];

    for (const [index, plan] of packagesPlan.entries()) {
      await prisma.package.upsert({
        where: { slug: plan.slug },
        create: {
          title: plan.title,
          slug: plan.slug,
          durationDays: plan.durationDays,
          basePrice: plan.basePrice,
          sellingPrice: plan.sellingPrice,
          isPopular: plan.isPopular,
          displayOrder: index,
        },
        update: {},
      });
    }

    return packagesPlan.length;
  }

  // ── Live exam ────────────────────────────────────────────────────────────

  private async seedLiveExam(prisma: PrismaClient, questionIds: bigint[]): Promise<void> {
    const now = new Date();
    const marksPerQuestion = 1;
    const negativeMarksPerQuestion = 0.25;

    const exam = await prisma.exam.upsert({
      where: { slug: 'weekly-mock-test-1' },
      create: {
        title: 'Weekly Mock Test 1',
        slug: 'weekly-mock-test-1',
        examType: 'DAILY_QUIZ',
        durationMinutes: 20,
        negativeMarkingRate: 0.25,
        totalMarks: questionIds.length * marksPerQuestion,
        totalQuestions: questionIds.length,
        startTime: now,
        // A week-long window so a freshly-seeded dev environment can always
        // start/resume this exam regardless of when `npm run prisma:seed` ran.
        endTime: new Date(now.getTime() + 7 * 86_400_000),
        isPublished: true,
      },
      update: {},
      select: { id: true },
    });

    // Per-pair upsert on the (examId, questionId) composite key — re-links
    // any question row UserSeeder's cascade recreated with a new id since
    // the exam was first seeded, without duplicating links that already exist.
    for (const [index, questionId] of questionIds.entries()) {
      await prisma.examQuestion.upsert({
        where: { examId_questionId: { examId: exam.id, questionId } },
        create: {
          examId: exam.id,
          questionId,
          marks: marksPerQuestion,
          negativeMarks: negativeMarksPerQuestion,
          questionOrder: index + 1,
        },
        update: {},
      });
    }

    // Mirrors ExamsService.assignQuestions — assigning a question to a
    // published-ready exam freezes it under the versioning policy.
    await prisma.question.updateMany({
      where: { id: { in: questionIds } },
      data: { isFrozen: true },
    });
  }
}
