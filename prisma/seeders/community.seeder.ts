import { PrismaClient, ReportReason, ReportStatus, NotificationType, Prisma } from '@prisma/client';
import type { Seeder } from './seeder.interface';

export class CommunitySeeder implements Seeder {
  readonly name = 'CommunitySeeder';
  readonly description =
    'Seeds tags, comprehension passages, discussion threads, upvotes, error reports, user notifications, and audit logs';
  readonly order = 8;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('💬 Seeding Community Discussions, Tags, Reports, Notifications & Audit Logs...');

    // 1. Seed Tags
    const tagsPlan = [
      { name: 'BCS Preliminary', slug: 'bcs-preliminary' },
      { name: 'Bank Recruitment', slug: 'bank-recruitment' },
      { name: 'Math Shortcut', slug: 'math-shortcut' },
      { name: 'Bangladesh Affairs', slug: 'bangladesh-affairs' },
      { name: 'Grammar Master', slug: 'grammar-master' },
    ];

    const tagIds: number[] = [];
    for (const item of tagsPlan) {
      const tag = await prisma.tag.upsert({
        where: { slug: item.slug },
        create: { name: item.name, slug: item.slug },
        update: {},
        select: { id: true },
      });
      tagIds.push(tag.id);
    }
    console.info(`🏷️ Ensured ${tagIds.length} content tags.`);

    // 2. Link Tags to Questions
    const questions = await prisma.question.findMany({
      take: 6,
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    for (const [qIndex, question] of questions.entries()) {
      const tagId = tagIds[qIndex % tagIds.length];
      if (tagId) {
        await prisma.questionTag.upsert({
          where: {
            questionId_tagId: {
              questionId: question.id,
              tagId,
            },
          },
          create: { questionId: question.id, tagId },
          update: {},
        });
      }
    }

    // 3. Seed QuestionPassage & link to first question
    if (questions.length > 0) {
      const passageText =
        'The Sundarbans is a mangrove area in the delta formed by the confluence of the Padma, Brahmaputra and Meghna Rivers in the Bay of Bengal. It spans from the Hooghly River in India to the Baleswar River in Bangladesh, comprising closed and open mangrove forests, agricultural land, mudflats and barren land. It is home to the endangered Bengal tiger and provides vital protection against coastal cyclones.';

      const existingPassage = await prisma.questionPassage.findFirst({
        where: { title: 'The Sundarbans Ecosystem' },
        select: { id: true },
      });

      let passageId: bigint;
      if (existingPassage) {
        passageId = existingPassage.id;
      } else {
        const passage = await prisma.questionPassage.create({
          data: {
            title: 'The Sundarbans Ecosystem',
            passageText,
            imageUrl:
              'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80',
          },
          select: { id: true },
        });
        passageId = passage.id;
      }

      await prisma.question.update({
        where: { id: questions[0].id },
        data: { passageId },
      });
    }

    // 4. Resolve Users (Teacher, Admin, Regular Users)
    const adminUser = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { id: true },
    });

    const regularUsers = await prisma.user.findMany({
      where: { role: 'USER' },
      take: 4,
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (questions.length > 0 && regularUsers.length >= 2) {
      const targetQuestion = questions[0];
      const student1 = regularUsers[0];
      const student2 = regularUsers[1];

      // 5. Seed Question Comments (Parent & Replies)
      const teacherComment = await prisma.questionComment.create({
        data: {
          questionId: targetQuestion.id,
          userId: adminUser?.id ?? student1.id,
          commentText:
            'Notice how the keyword "confluence" indicates the merging point of the rivers. In competitive exams, questions frequently test these specific geographical landmarks!',
          upvotes: 14,
          isPinned: true,
          isVerifiedByTeacher: true,
        },
        select: { id: true },
      });

      const studentQueryComment = await prisma.questionComment.create({
        data: {
          questionId: targetQuestion.id,
          userId: student1.id,
          parentCommentId: teacherComment.id,
          commentText:
            'Thank you Sir! Is the area on the Bangladesh side designated as a UNESCO World Heritage site?',
          upvotes: 3,
        },
        select: { id: true },
      });

      // Seed comment upvotes
      await prisma.questionCommentUpvote.upsert({
        where: {
          commentId_userId: {
            commentId: teacherComment.id,
            userId: student2.id,
          },
        },
        create: {
          commentId: teacherComment.id,
          userId: student2.id,
        },
        update: {},
      });

      console.info(`💬 Seeded threaded discussion comments and upvotes.`);

      // 6. Seed Question Reports
      await prisma.questionReport.create({
        data: {
          questionId: targetQuestion.id,
          userId: student2.id,
          resolvedById: adminUser?.id ?? null,
          reason: ReportReason.TYPO_MISTAKE,
          userNotes: 'Found a slight spelling inconsistency in option C.',
          resolutionNotes: 'Reviewed and verified against official reference materials. Resolved.',
          status: ReportStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });

      if (questions.length > 1) {
        await prisma.questionReport.create({
          data: {
            questionId: questions[1].id,
            userId: student1.id,
            reason: ReportReason.UNCLEAR_EXPLANATION,
            userNotes:
              'Could you please add a mathematical derivation for the shortcut formula in the explanation?',
            status: ReportStatus.PENDING,
          },
        });
      }
      console.info('🚩 Seeded question issue reports (Pending & Resolved).');
    }

    // 7. Seed User Notifications
    for (const [idx, user] of regularUsers.entries()) {
      const notificationMeta: Prisma.InputJsonValue = {
        examSlug: 'weekly-mock-test-1',
        category: 'Bank Job Preparation',
      };

      await prisma.userNotification.createMany({
        data: [
          {
            userId: user.id,
            type: NotificationType.EXAM_REMINDER,
            title: 'Weekly Mock Test 1 is Live!',
            body: 'Your weekly bank preparation mock exam is now ready to attempt. Test your skills before the window closes.',
            actionUrl: '/exams/weekly-mock-test-1',
            metadata: notificationMeta,
            isRead: idx === 0,
            readAt: idx === 0 ? new Date() : null,
          },
          {
            userId: user.id,
            type: NotificationType.STREAK_ALERT,
            title: 'Keep Your Streak Burning! 🔥',
            body: 'You are on a roll! Solve at least 10 MCQs today to preserve your study streak.',
            actionUrl: '/practice',
            metadata: null,
            isRead: false,
          },
        ],
      });
    }
    console.info(`🔔 Seeded user in-app notifications.`);

    // 8. Seed Audit Logs
    if (adminUser) {
      const auditPayloadOld: Prisma.InputJsonValue = { isPublished: false };
      const auditPayloadNew: Prisma.InputJsonValue = {
        isPublished: true,
        publishedAt: new Date().toISOString(),
      };

      await prisma.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'EXAM_PUBLISHED',
          entityType: 'Exam',
          entityId: 'weekly-mock-test-1',
          oldValues: auditPayloadOld,
          newValues: auditPayloadNew,
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Vittimul Admin Portal)',
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'SECURITY_APP_SETTINGS_UPDATE',
          entityType: 'AppSetting',
          entityId: '1',
          oldValues: { maintenanceMode: false },
          newValues: { maintenanceMode: false, allowRegistration: true },
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0 (Vittimul Admin Portal)',
        },
      });
      console.info(`🛡️ Seeded security audit logs.`);
    }
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    await prisma.tag.deleteMany({
      where: {
        slug: {
          in: [
            'bcs-preliminary',
            'bank-recruitment',
            'math-shortcut',
            'bangladesh-affairs',
            'grammar-master',
          ],
        },
      },
    });
    console.info('↩️ CommunitySeeder rolled back.');
  }
}
