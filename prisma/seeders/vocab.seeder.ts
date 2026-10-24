import { PrismaClient, DifficultyLevel } from '@prisma/client';
import type { Seeder } from './seeder.interface';

interface SeedVocabCardItem {
  readonly word: string;
  readonly bengaliMeaning: string;
  readonly englishDefinition: string;
  readonly pronunciationIpa: string;
  readonly partOfSpeech: string;
  readonly synonyms: string[];
  readonly antonyms: string[];
  readonly mnemonicTrick: string;
  readonly exampleSentence: string;
  readonly difficulty: DifficultyLevel;
  readonly topicSlug: string;
}

export class VocabSeeder implements Seeder {
  readonly name = 'VocabSeeder';
  readonly description = 'Seeds high-yield vocabulary cards and initial Leitner box user progress';
  readonly order = 3;

  private static readonly VOCAB_DATA: SeedVocabCardItem[] = [
    {
      word: 'Ubiquitous',
      bengaliMeaning: 'সর্বব্যাপী / সর্বত্র বিদ্যমান',
      englishDefinition: 'Present, appearing, or found everywhere.',
      pronunciationIpa: '/juːˈbɪk.wɪ.təs/',
      partOfSpeech: 'Adjective',
      synonyms: ['Omnipresent', 'Pervasive', 'Universal'],
      antonyms: ['Rare', 'Scarce', 'Infrequent'],
      mnemonicTrick:
        'U-bique-tous sounds like "you big city us" — billboards are everywhere in big cities!',
      exampleSentence: 'Smartphones have become ubiquitous in modern daily life.',
      difficulty: DifficultyLevel.MEDIUM,
      topicSlug: 'vocabulary',
    },
    {
      word: 'Ephemeral',
      bengaliMeaning: 'ক্ষণস্থায়ী / স্বল্পায়ু',
      englishDefinition: 'Lasting for a very short time.',
      pronunciationIpa: '/ɪˈfem.ər.əl/',
      partOfSpeech: 'Adjective',
      synonyms: ['Fleeting', 'Transient', 'Momentary'],
      antonyms: ['Permanent', 'Eternal', 'Enduring'],
      mnemonicTrick: 'Sounds like "e-funeral" — something whose life was sadly short!',
      exampleSentence: 'Fame on social media can be surprisingly ephemeral.',
      difficulty: DifficultyLevel.HARD,
      topicSlug: 'vocabulary',
    },
    {
      word: 'Meticulous',
      bengaliMeaning: 'খুঁতখুঁতে / অত্যন্ত সতর্ক ও নিখুঁত',
      englishDefinition: 'Showing great attention to detail; very careful and precise.',
      pronunciationIpa: '/mɪˈtɪk.jə.ləs/',
      partOfSpeech: 'Adjective',
      synonyms: ['Diligent', 'Scrupulous', 'Painstaking'],
      antonyms: ['Careless', 'Sloppy', 'Negligent'],
      mnemonicTrick: 'Meticulous = "Medical" students must be extremely careful and detailed.',
      exampleSentence: 'The researcher kept meticulous records of every experiment.',
      difficulty: DifficultyLevel.MEDIUM,
      topicSlug: 'vocabulary',
    },
    {
      word: 'Benevolent',
      bengaliMeaning: 'হিতৈষী / দয়ালু / পরোপকারী',
      englishDefinition:
        'Well meaning and kindly; serving a charitable rather than a profit-making purpose.',
      pronunciationIpa: '/bəˈnev.əl.ənt/',
      partOfSpeech: 'Adjective',
      synonyms: ['Kindhearted', 'Magnanimous', 'Altruistic'],
      antonyms: ['Malevolent', 'Cruel', 'Spiteful'],
      mnemonicTrick:
        'Bene means "good" (like benefit) and vol means "wish" — wishing good for others.',
      exampleSentence: 'A benevolent donor funded the university library expansion.',
      difficulty: DifficultyLevel.EASY,
      topicSlug: 'vocabulary',
    },
    {
      word: 'Pragmatic',
      bengaliMeaning: 'বাস্তবধর্মী / প্রায়োগিক',
      englishDefinition:
        'Dealing with things sensibly and realistically in a way that is based on practical considerations.',
      pronunciationIpa: '/præɡˈmæt.ɪk/',
      partOfSpeech: 'Adjective',
      synonyms: ['Practical', 'Realistic', 'Sensible'],
      antonyms: ['Idealistic', 'Impractical', 'Quixotic'],
      mnemonicTrick: 'Pragmatic rhymes with "Practice" — focused on practical action over theory.',
      exampleSentence: 'We need a pragmatic approach rather than debating theoretical ideas.',
      difficulty: DifficultyLevel.MEDIUM,
      topicSlug: 'vocabulary',
    },
    {
      word: 'Cacophony',
      bengaliMeaning: 'কর্কশ বা বেসুরো শব্দের তীব্র মিশ্রণ',
      englishDefinition: 'A harsh, discordant mixture of sounds.',
      pronunciationIpa: '/kəˈkɒf.ə.ni/',
      partOfSpeech: 'Noun',
      synonyms: ['Din', 'Racket', 'Discord'],
      antonyms: ['Harmony', 'Euphony', 'Symphony'],
      mnemonicTrick: 'Caco (bad) + phone (sound) = bad and jarring sound.',
      exampleSentence:
        'A cacophony of car horns and construction drills filled the morning street.',
      difficulty: DifficultyLevel.HARD,
      topicSlug: 'vocabulary',
    },
    {
      word: 'Enervate',
      bengaliMeaning: 'দুর্বল বা শক্তিহীন করা',
      englishDefinition: 'Cause someone to feel drained of energy or vitality; weaken.',
      pronunciationIpa: '/ˈen.ə.veɪt/',
      partOfSpeech: 'Verb',
      synonyms: ['Exhaust', 'Fatigue', 'Debilitate'],
      antonyms: ['Invigorate', 'Energize', 'Strengthen'],
      mnemonicTrick: 'Enervate sounds like "drain energy" — removing someone’s inner energy.',
      exampleSentence: 'The scorching afternoon heat threatened to enervate the marathon runners.',
      difficulty: DifficultyLevel.HARD,
      topicSlug: 'vocabulary',
    },
    {
      word: 'Aberration',
      bengaliMeaning: 'স্বাভাবিক পথ বা আদর্শ থেকে বিচ্যুতি',
      englishDefinition:
        'A departure from what is normal, usual, or expected, typically one that is unwelcome.',
      pronunciationIpa: '/ˌæb.əˈreɪ.ʃən/',
      partOfSpeech: 'Noun',
      synonyms: ['Anomaly', 'Divergence', 'Deviation'],
      antonyms: ['Normality', 'Regularity', 'Conformity'],
      mnemonicTrick: 'Aberration = sounds like "a deviation" from the straight line.',
      exampleSentence:
        'Her sudden angry outburst was an aberration from her usually gentle nature.',
      difficulty: DifficultyLevel.HARD,
      topicSlug: 'vocabulary',
    },
  ];

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('📖 Seeding Vocabulary Cards...');

    // Resolve optional topic ID for vocabulary topic if seeded by EdTechSeeder
    const vocabTopic = await prisma.topic.findFirst({
      where: { slug: 'vocabulary' },
      select: { id: true },
    });

    const cardIds: bigint[] = [];

    for (const item of VocabSeeder.VOCAB_DATA) {
      const card = await prisma.vocabularyCard.upsert({
        where: { word: item.word },
        create: {
          word: item.word,
          bengaliMeaning: item.bengaliMeaning,
          englishDefinition: item.englishDefinition,
          pronunciationIpa: item.pronunciationIpa,
          partOfSpeech: item.partOfSpeech,
          synonyms: item.synonyms,
          antonyms: item.antonyms,
          mnemonicTrick: item.mnemonicTrick,
          exampleSentence: item.exampleSentence,
          difficulty: item.difficulty,
          topicId: vocabTopic?.id ?? null,
          isActive: true,
        },
        update: {
          bengaliMeaning: item.bengaliMeaning,
          englishDefinition: item.englishDefinition,
          pronunciationIpa: item.pronunciationIpa,
          topicId: vocabTopic?.id ?? null,
        },
        select: { id: true },
      });
      cardIds.push(card.id);
    }

    console.info(`✅ Ensured ${cardIds.length} vocabulary cards.`);

    // Seed Leitner user progress for regular users
    const regularUsers = await prisma.user.findMany({
      where: { role: 'USER' },
      take: 5,
      select: { id: true },
    });

    if (regularUsers.length > 0 && cardIds.length > 0) {
      let progressCount = 0;
      const today = new Date();

      for (const [userIndex, user] of regularUsers.entries()) {
        for (const [cardIndex, cardId] of cardIds.entries()) {
          // Stagger Leitner boxes (1 to 5) across users and cards
          const box = ((userIndex + cardIndex) % 5) + 1;
          const reviewOffsetDays = box * 2;
          const nextReview = new Date(today);
          nextReview.setDate(today.getDate() + reviewOffsetDays);

          await prisma.userVocabularyProgress.upsert({
            where: {
              userId_cardId: {
                userId: user.id,
                cardId,
              },
            },
            create: {
              userId: user.id,
              cardId,
              leitnerBox: box,
              correctStreak: box - 1,
              wrongCount: box === 1 ? 2 : 0,
              isMastered: box === 5,
              nextReviewDate: nextReview,
              lastReviewedAt: today,
            },
            update: {
              leitnerBox: box,
              nextReviewDate: nextReview,
            },
          });
          progressCount++;
        }
      }

      console.info(`🗃️ Ensured ${progressCount} user vocabulary Leitner progress rows.`);
    }
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    const words = VocabSeeder.VOCAB_DATA.map((item) => item.word);
    await prisma.vocabularyCard.deleteMany({
      where: { word: { in: words } },
    });
    console.info('↩️ VocabSeeder rolled back.');
  }
}
