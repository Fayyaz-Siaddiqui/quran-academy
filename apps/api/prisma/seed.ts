/* eslint-disable no-console */
import { CourseCategory, PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PermissionKey,
  SYSTEM_ROLE_LABELS,
  SystemRole,
  SystemRoleSlug,
} from '@qa/shared-types';

/**
 * Idempotent seeder. Safe to run on every deploy:
 *  - permissions & system roles are upserted (system role permission sets are
 *    only written on first creation, so admin tuning is preserved)
 *  - default academy, super admin and starter website content are created if missing
 *  - SEED_DEMO=true adds a demo teacher, parent, students and classes
 */
const prisma = new PrismaClient();

async function seedAccess() {
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description, module: key.split('.')[0]! },
      update: { description, module: key.split('.')[0]! },
    });
  }
  const perms = await prisma.permission.findMany();
  const idOf = new Map(perms.map((p) => [p.key, p.id]));

  for (const slug of Object.values(SystemRole) as SystemRoleSlug[]) {
    const existing = await prisma.role.findFirst({ where: { slug, academyId: null } });
    const keys: PermissionKey[] = DEFAULT_ROLE_PERMISSIONS[slug];
    if (!existing) {
      await prisma.role.create({
        data: {
          slug,
          name: SYSTEM_ROLE_LABELS[slug],
          isSystem: true,
          permissions: { create: keys.map((k) => ({ permissionId: idOf.get(k)! })) },
        },
      });
    } else if (slug === SystemRole.SUPER_ADMIN) {
      // Super admin always receives newly added permissions.
      await prisma.rolePermission.createMany({
        data: keys.map((k) => ({ roleId: existing.id, permissionId: idOf.get(k)! })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`✓ ${perms.length} permissions, ${Object.values(SystemRole).length} system roles`);
}

async function seedAcademy() {
  const slug = process.env.DEFAULT_ACADEMY_SLUG ?? 'main';
  const academy = await prisma.academy.upsert({
    where: { slug },
    create: {
      slug,
      name: process.env.SEED_ACADEMY_NAME ?? 'Al-Noor Online Quran Academy',
      settings: { currency: 'USD', defaultTimezone: 'UTC', multiBranch: false },
    },
    update: {},
  });
  await prisma.branch.upsert({
    where: { academyId_code: { academyId: academy.id, code: 'HQ' } },
    create: { academyId: academy.id, name: 'Head Office', code: 'HQ', timezone: 'UTC' },
    update: {},
  });
  console.log(`✓ academy "${academy.name}" (${academy.slug})`);
  return academy;
}

async function seedSuperAdmin(academyId: string) {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('… SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping super admin');
    return;
  }
  const role = await prisma.role.findFirstOrThrow({ where: { slug: SystemRole.SUPER_ADMIN, academyId: null } });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`… super admin ${email} already exists`);
    return;
  }
  await prisma.user.create({
    data: {
      academyId,
      email,
      fullName: 'Platform Administrator',
      passwordHash: await hash(password),
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      timezone: 'UTC',
      roles: { create: { roleId: role.id } },
    },
  });
  console.log(`✓ super admin ${email}`);
}

const COURSES: {
  slug: string;
  title: string;
  category: CourseCategory;
  level: string;
  ageGroup: string;
  shortDescription: string;
  description: string;
  outcomes: string[];
  lessons: string[];
}[] = [
  {
    slug: 'noorani-qaida',
    title: 'Noorani Qaida',
    category: 'NOORANI_QAIDA',
    level: 'Beginner',
    ageGroup: '4+ years',
    shortDescription: 'The foundation of Quran reading: Arabic letters, pronunciation and joining rules.',
    description:
      'Noorani Qaida is the first step for every new learner. Students learn the Arabic alphabet, correct articulation points (makharij), short and long vowels, tanween, sukoon, shaddah and the rules for joining letters — building the confidence to read the Quran fluently.',
    outcomes: ['Recognise and pronounce all Arabic letters', 'Read joined words with harakat', 'Apply basic madd and sukoon rules', 'Begin reading the Quran directly'],
    lessons: ['Single letters', 'Compound letters', 'Muqatta’at', 'Harakat (fatha, kasra, damma)', 'Tanween', 'Standing harakat', 'Madd letters', 'Leen letters', 'Sukoon', 'Shaddah', 'Shaddah with sukoon', 'Practice exercises'],
  },
  {
    slug: 'quran-reading',
    title: 'Quran Reading (Nazra)',
    category: 'QURAN_READING',
    level: 'Beginner – Intermediate',
    ageGroup: 'All ages',
    shortDescription: 'Read the Quran fluently and correctly with a qualified teacher, one-to-one.',
    description:
      'Guided recitation of the Holy Quran from the beginning, with continuous correction of pronunciation and fluency. Ideal after completing Noorani Qaida or for adults returning to Quran reading.',
    outcomes: ['Read the full Quran fluently', 'Correct common pronunciation mistakes', 'Develop a daily recitation habit'],
    lessons: ['Reading assessment', 'Juz 30 practice', 'Fluency drills', 'Stopping signs (waqf)', 'Full-mushaf reading plan'],
  },
  {
    slug: 'quran-memorization',
    title: 'Quran Memorization (Hifz)',
    category: 'QURAN_MEMORIZATION',
    level: 'Intermediate – Advanced',
    ageGroup: '7+ years',
    shortDescription: 'Structured Hifz programme with daily new lessons, revision cycles and progress tracking.',
    description:
      'A disciplined memorisation programme combining new lesson (sabaq), recent revision (sabqi) and long-term revision (manzil). Every session is tracked so students and parents can see exactly which surahs and ayahs have been memorised.',
    outcomes: ['Memorise with correct tajweed', 'Retain memorisation through structured revision', 'Track progress ayah by ayah'],
    lessons: ['Memorisation plan & assessment', 'Juz Amma', 'Juz Tabarak', 'Surah Al-Baqarah plan', 'Manzil revision system'],
  },
  {
    slug: 'tajweed',
    title: 'Tajweed Rules',
    category: 'TAJWEED',
    level: 'Intermediate',
    ageGroup: '10+ years',
    shortDescription: 'Master the rules of beautiful, correct recitation with theory and applied practice.',
    description:
      'A complete tajweed course covering makharij, sifaat, noon saakin and tanween, meem saakin, madd, qalqalah, idgham, ikhfa, waqf and more — taught through recitation so every rule is applied, not just memorised.',
    outcomes: ['Pronounce every letter from its correct makhraj', 'Apply all major tajweed rules while reciting', 'Identify rules in any page of the mushaf'],
    lessons: ['Makharij al-huroof', 'Sifaat al-huroof', 'Noon saakin & tanween', 'Meem saakin', 'Qalqalah', 'Madd types', 'Laam & raa rules', 'Waqf & ibtida'],
  },
  {
    slug: 'islamic-studies',
    title: 'Islamic Studies',
    category: 'ISLAMIC_STUDIES',
    level: 'All levels',
    ageGroup: '6+ years',
    shortDescription: 'Aqeedah, fiqh of worship, seerah, duas and Islamic manners — age-appropriate and engaging.',
    description:
      'An age-appropriate curriculum covering the pillars of Islam and Iman, purification and salah, the life of the Prophet ﷺ, stories of the prophets, daily duas and Islamic character.',
    outcomes: ['Understand the pillars of Islam and Iman', 'Perform wudu and salah correctly', 'Learn daily duas and adhkar', 'Know the seerah of the Prophet ﷺ'],
    lessons: ['Pillars of Islam', 'Pillars of Iman', 'Wudu & salah', 'Daily duas', 'Seerah', 'Stories of the prophets', 'Islamic manners'],
  },
  {
    slug: 'kids-quran-classes',
    title: 'Kids Quran Classes',
    category: 'KIDS',
    level: 'Beginner',
    ageGroup: '4–12 years',
    shortDescription: 'Fun, patient one-to-one Quran classes designed for children, with parent progress reports.',
    description:
      'Short, engaging sessions with teachers experienced in teaching children. Combines Qaida, Quran reading, short surah memorisation and duas, with regular progress updates for parents in the parent portal.',
    outcomes: ['Love for the Quran', 'Strong reading foundation', 'Memorise short surahs and duas'],
    lessons: ['Letters through play', 'Short surahs', 'Daily duas', 'Reading practice', 'Islamic stories'],
  },
];

async function seedContent(academyId: string) {
  for (const [i, c] of COURSES.entries()) {
    const { lessons, ...data } = c;
    const course = await prisma.course.upsert({
      where: { academyId_slug: { academyId, slug: c.slug } },
      create: { ...data, academyId, sortOrder: i, classMinutes: 30, metaTitle: `${c.title} Online | One-to-One Classes`, metaDescription: c.shortDescription },
      update: {},
    });
    const count = await prisma.courseLesson.count({ where: { courseId: course.id } });
    if (!count) {
      await prisma.courseLesson.createMany({ data: lessons.map((title, idx) => ({ courseId: course.id, title, sortOrder: idx + 1 })) });
    }
  }

  if (!(await prisma.pricingPlan.count({ where: { academyId } }))) {
    await prisma.pricingPlan.createMany({
      data: [
        { academyId, name: 'Basic', description: 'A gentle start', currency: 'USD', priceMonthly: 4500, classesPerWeek: 2, classMinutes: 30, features: ['8 classes / month', 'One-to-one with a qualified teacher', 'Class recordings', 'Monthly progress report'], sortOrder: 0 },
        { academyId, name: 'Standard', description: 'Most popular for steady progress', currency: 'USD', priceMonthly: 6500, classesPerWeek: 3, classMinutes: 30, features: ['12 classes / month', 'One-to-one with a qualified teacher', 'Class recordings', 'Homework & feedback', 'Parent portal'], isHighlighted: true, sortOrder: 1 },
        { academyId, name: 'Intensive', description: 'For Hifz and fast learners', currency: 'USD', priceMonthly: 9900, classesPerWeek: 5, classMinutes: 30, features: ['20 classes / month', 'Dedicated Hifz plan', 'Class recordings', 'Weekly progress report', 'Priority scheduling'], sortOrder: 2 },
      ],
    });
  }

  if (!(await prisma.testimonial.count({ where: { academyId } }))) {
    await prisma.testimonial.createMany({
      data: [
        { academyId, name: 'Aisha R.', location: 'London, UK', role: 'Parent of two', quote: 'My children look forward to every class. The teacher is patient and the parent portal lets me see exactly what they learned.', rating: 5, sortOrder: 0 },
        { academyId, name: 'Omar K.', location: 'Toronto, Canada', role: 'Adult learner', quote: 'I finally learned tajweed properly at a time that fits around work. The recordings help me revise between lessons.', rating: 5, sortOrder: 1 },
        { academyId, name: 'Fatima S.', location: 'Dubai, UAE', role: 'Hifz student', quote: 'The memorisation tracking keeps me motivated. I can see every surah I have completed.', rating: 5, sortOrder: 2 },
      ],
    });
  }

  if (!(await prisma.faq.count({ where: { academyId } }))) {
    await prisma.faq.createMany({
      data: [
        { academyId, category: 'General', question: 'How do online classes work?', answer: 'Classes are live, one-to-one video sessions in your browser. You join from your dashboard at the scheduled time — no software installation is required.', sortOrder: 0 },
        { academyId, category: 'General', question: 'Is the first class free?', answer: 'Yes. Book a free trial class and we will match you with a suitable teacher at a time that works in your time zone.', sortOrder: 1 },
        { academyId, category: 'Teachers', question: 'Are female teachers available?', answer: 'Yes. You can request a male or female teacher for yourself or your children.', sortOrder: 2 },
        { academyId, category: 'Scheduling', question: 'Which time zones do you support?', answer: 'All of them. Our teachers cover early mornings, evenings and weekends for students in the US, UK, Canada, Europe, the Gulf and Australia.', sortOrder: 3 },
        { academyId, category: 'Scheduling', question: 'Can I reschedule a class?', answer: 'Yes. Contact support at least 12 hours before the class and we will move it to another available slot.', sortOrder: 4 },
        { academyId, category: 'Parents', question: 'Can I monitor my child’s progress?', answer: 'Yes. The parent portal shows attendance, homework, recordings and Quran progress for each of your children.', sortOrder: 5 },
      ],
    });
  }

  const settings: Record<string, unknown> = {
    site: { name: 'Al-Noor Online Quran Academy', tagline: 'Learn the Quran online with qualified teachers', logoUrl: null },
    contact: { email: 'support@yourdomain.com', phone: '+1 555 010 0000', address: 'Online — serving students worldwide', hours: '24/7 scheduling across all time zones' },
    whatsapp: { number: '15550100000', message: 'Assalamu alaikum, I would like to know more about your Quran classes.' },
    social: { facebook: '', instagram: '', youtube: '', x: '' },
    seo: { defaultTitle: 'Online Quran Classes for Kids & Adults | One-to-One', defaultDescription: 'Learn Noorani Qaida, Quran reading, Hifz and Tajweed online with qualified male and female teachers. Free trial class. Students in the US, UK, Canada, UAE, Saudi Arabia, Australia and Europe.' },
    home: {
      heroTitle: 'Learn the Quran online, one-to-one, at a time that suits you',
      heroSubtitle: 'Qualified male and female teachers for kids and adults. Noorani Qaida, Quran reading, Hifz, Tajweed and Islamic studies — live in your browser.',
      stats: [
        { label: 'Students taught', value: '2,500+' },
        { label: 'Qualified teachers', value: '60+' },
        { label: 'Countries', value: '30+' },
        { label: 'Average rating', value: '4.9/5' },
      ],
    },
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { academyId_key: { academyId, key } }, create: { academyId, key, value: value as never }, update: {} });
  }

  const pages: { slug: string; title: string; metaDescription: string; sections: unknown[] }[] = [
    {
      slug: 'about',
      title: 'About Us',
      metaDescription: 'Who we are, how we teach and why families around the world trust us with their Quran education.',
      sections: [
        { type: 'richText', heading: 'Our mission', body: 'To make authentic, high-quality Quran education accessible to every Muslim family, wherever they live.' },
        { type: 'richText', heading: 'How we teach', body: 'Every class is one-to-one with a qualified teacher. We focus on correct pronunciation, steady progress and a love for the Book of Allah.' },
      ],
    },
    {
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      metaDescription: 'How we collect, use and protect your personal information.',
      sections: [
        { type: 'richText', heading: 'Information we collect', body: 'Account details you provide at registration (name, email, phone, country, time zone), information about children added by a parent, class attendance and learning progress, and technical data needed to run live classes.' },
        { type: 'richText', heading: 'How we use it', body: 'To deliver classes, schedule teachers, communicate with you, and improve our service. We do not sell personal data.' },
        { type: 'richText', heading: 'Class recordings', body: 'Classes may be recorded for the student’s revision and for quality assurance. Recordings are stored privately and are only accessible to the student, their parents, their teacher and authorised staff.' },
        { type: 'richText', heading: 'Your rights', body: 'You can request access to, correction of, or deletion of your data by contacting support. Users in the UK/EU have rights under the GDPR; users in California have rights under the CCPA.' },
      ],
    },
    {
      slug: 'terms-and-conditions',
      title: 'Terms and Conditions',
      metaDescription: 'The terms that apply to using our website and online classes.',
      sections: [
        { type: 'richText', heading: 'Accounts', body: 'You are responsible for keeping your login details secure. Parents and guardians are responsible for accounts they create for children.' },
        { type: 'richText', heading: 'Classes and rescheduling', body: 'Classes must be rescheduled at least 12 hours in advance. Missed classes without notice may not be made up.' },
        { type: 'richText', heading: 'Conduct', body: 'Students, parents and teachers must behave respectfully in all classes and communications.' },
      ],
    },
  ];
  for (const p of pages) {
    await prisma.cmsPage.upsert({
      where: { academyId_slug: { academyId, slug: p.slug } },
      create: { academyId, slug: p.slug, title: p.title, metaTitle: p.title, metaDescription: p.metaDescription, sections: p.sections as never },
      update: {},
    });
  }

  if (!(await prisma.blogPost.count({ where: { academyId } }))) {
    await prisma.blogPost.create({
      data: {
        academyId,
        slug: 'how-to-help-your-child-learn-quran-at-home',
        title: 'How to help your child learn the Quran at home',
        excerpt: 'Five practical habits that make online Quran classes far more effective for children.',
        content:
          '## 1. Keep a fixed class routine\nChildren thrive on consistency. Choose class times that do not clash with school or bedtime.\n\n## 2. Sit nearby for the first few classes\nYour presence helps young children settle in.\n\n## 3. Revise for ten minutes a day\nShort daily revision beats one long session a week.\n\n## 4. Watch the recordings together\nRecordings let you hear exactly what the teacher corrected.\n\n## 5. Celebrate milestones\nFinishing the Qaida or a new surah deserves recognition!',
        tags: ['parents', 'kids'],
        publishedAt: new Date(),
        metaDescription: 'Five practical habits that make online Quran classes more effective for children.',
      },
    });
  }
  console.log('✓ courses, pricing, testimonials, FAQs, pages, settings, blog');
}

async function seedDemo(academyId: string) {
  if (process.env.SEED_DEMO !== 'true') return;
  const password = await hash(process.env.SEED_DEMO_PASSWORD ?? 'DemoPass12345');
  const roles = Object.fromEntries(
    (await prisma.role.findMany({ where: { academyId: null } })).map((r) => [r.slug, r.id]),
  );
  const upsertUser = async (email: string, fullName: string, role: string, extra: object = {}) => {
    const found = await prisma.user.findUnique({ where: { email } });
    if (found) return found;
    return prisma.user.create({
      data: { academyId, email, fullName, passwordHash: password, status: 'ACTIVE', emailVerifiedAt: new Date(), timezone: 'Europe/London', country: 'GB', roles: { create: { roleId: roles[role]! } }, ...extra },
    });
  };

  const teacher = await upsertUser('teacher@demo.local', 'Ustadh Yusuf Rahman', SystemRole.TEACHER, {
    teacherProfile: {
      create: {
        qualifications: 'Ijazah in Hafs ‘an ‘Asim; BA Islamic Studies', experienceYears: 9, certifications: ['Ijazah (Hafs)'],
        languages: ['English', 'Arabic', 'Urdu'], approvalStatus: 'APPROVED', isPublic: true, specialties: ['Tajweed', 'Hifz'],
        bio: 'Patient, structured teacher specialising in tajweed and memorisation for children and adults.',
      },
    },
  });
  const student = await upsertUser('student@demo.local', 'Zayd Ahmed', SystemRole.STUDENT, {
    studentProfile: { create: { dateOfBirth: new Date('2004-03-02'), assignedTeacherId: teacher.id, preferredClassTiming: 'evening' } },
  });
  const parent = await upsertUser('parent@demo.local', 'Mariam Ahmed', SystemRole.PARENT, { parentProfile: { create: {} } });
  await prisma.parentChild.upsert({
    where: { parentId_childId: { parentId: parent.id, childId: student.id } },
    create: { parentId: parent.id, childId: student.id, relationship: 'mother' },
    update: {},
  });

  const tajweed = await prisma.course.findFirstOrThrow({ where: { academyId, slug: 'tajweed' } });
  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: student.id, courseId: tajweed.id } },
    create: { studentId: student.id, courseId: tajweed.id, teacherId: teacher.id, status: 'ACTIVE', startedAt: new Date() },
    update: {},
  });

  if (!(await prisma.classSession.count({ where: { teacherId: teacher.id } }))) {
    const base = new Date();
    base.setUTCMinutes(0, 0, 0);
    for (let i = -3; i <= 4; i++) {
      const startsAt = new Date(base.getTime() + i * 86_400_000 + 18 * 3_600_000 - base.getUTCHours() * 3_600_000);
      const past = i < 0;
      await prisma.classSession.create({
        data: {
          academyId, courseId: tajweed.id, teacherId: teacher.id, title: `Tajweed lesson ${i + 4}`,
          startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000),
          status: past ? 'COMPLETED' : 'SCHEDULED',
          zoomSessionName: `qa-demo-${i + 4}-${Math.random().toString(36).slice(2, 10)}`,
          attendees: { create: { studentId: student.id, status: past ? (i === -2 ? 'ABSENT' : 'PRESENT') : 'SCHEDULED' } },
        },
      });
    }
    await prisma.homework.create({
      data: { courseId: tajweed.id, teacherId: teacher.id, studentId: student.id, title: 'Practise noon saakin rules', instructions: 'Recite Surah Al-Mulk ayahs 1–10 and identify every ikhfa and idgham.', dueAt: new Date(Date.now() + 3 * 86_400_000) },
    });
    await prisma.quranProgress.createMany({
      data: [
        { studentId: student.id, teacherId: teacher.id, type: 'TAJWEED', surah: 67, ayahFrom: 1, ayahTo: 10, rating: 4, notes: 'Good ikhfa; work on qalqalah.' },
        { studentId: student.id, teacherId: teacher.id, type: 'MEMORIZATION', surah: 112, ayahFrom: 1, ayahTo: 4, rating: 5 },
      ],
    });
  }
  console.log('✓ demo users: teacher@demo.local, student@demo.local, parent@demo.local');
}

async function main() {
  await seedAccess();
  const academy = await seedAcademy();
  await seedSuperAdmin(academy.id);
  await seedContent(academy.id);
  await seedDemo(academy.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
