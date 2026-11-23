import type { CmsPage, Faq, PricingPlan, PublicCourse, SiteSettings, Testimonial } from './content';

/**
 * Bundled defaults mirroring the API seeder. Used only when the CMS API is
 * unreachable; live content always comes from the Admin CMS.
 */
const course = (
  slug: string, title: string, category: string, level: string, ageGroup: string, shortDescription: string, outcomes: string[],
): PublicCourse => ({
  id: slug, slug, title, category, level, ageGroup, shortDescription, description: shortDescription, outcomes,
  durationWeeks: null, classMinutes: 30, imageUrl: null,
});

export const FALLBACK = {
  site: {
    site: { name: 'Al-Noor Online Quran Academy', tagline: 'Learn the Quran online with qualified teachers', logoUrl: null },
    contact: { email: 'support@yourdomain.com', phone: '+1 555 010 0000', address: 'Online — serving students worldwide', hours: '24/7 scheduling across all time zones' },
    whatsapp: { number: '15550100000', message: 'Assalamu alaikum, I would like to know more about your Quran classes.' },
    social: {},
    seo: {
      defaultTitle: 'Online Quran Classes for Kids & Adults | One-to-One',
      defaultDescription: 'Learn Noorani Qaida, Quran reading, Hifz and Tajweed online with qualified male and female teachers. Free trial class.',
    },
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
  } satisfies SiteSettings,
  courses: [
    course('noorani-qaida', 'Noorani Qaida', 'NOORANI_QAIDA', 'Beginner', '4+ years', 'The foundation of Quran reading: Arabic letters, pronunciation and joining rules.', ['Recognise and pronounce all Arabic letters', 'Read joined words with harakat', 'Begin reading the Quran directly']),
    course('quran-reading', 'Quran Reading (Nazra)', 'QURAN_READING', 'Beginner – Intermediate', 'All ages', 'Read the Quran fluently and correctly with a qualified teacher, one-to-one.', ['Read the full Quran fluently', 'Correct common pronunciation mistakes']),
    course('quran-memorization', 'Quran Memorization (Hifz)', 'QURAN_MEMORIZATION', 'Intermediate – Advanced', '7+ years', 'Structured Hifz programme with daily new lessons, revision cycles and progress tracking.', ['Memorise with correct tajweed', 'Retain through structured revision']),
    course('tajweed', 'Tajweed Rules', 'TAJWEED', 'Intermediate', '10+ years', 'Master the rules of beautiful, correct recitation with theory and applied practice.', ['Pronounce every letter from its makhraj', 'Apply all major tajweed rules']),
    course('islamic-studies', 'Islamic Studies', 'ISLAMIC_STUDIES', 'All levels', '6+ years', 'Aqeedah, fiqh of worship, seerah, duas and Islamic manners — age-appropriate and engaging.', ['Understand the pillars of Islam and Iman', 'Perform wudu and salah correctly']),
    course('kids-quran-classes', 'Kids Quran Classes', 'KIDS', 'Beginner', '4–12 years', 'Fun, patient one-to-one Quran classes designed for children, with parent progress reports.', ['Love for the Quran', 'Strong reading foundation']),
  ],
  pricing: [
    { id: 'basic', name: 'Basic', description: 'A gentle start', currency: 'USD', priceMonthly: 4500, classesPerWeek: 2, classMinutes: 30, features: ['8 classes / month', 'One-to-one with a qualified teacher', 'Class recordings', 'Monthly progress report'], isHighlighted: false },
    { id: 'standard', name: 'Standard', description: 'Most popular for steady progress', currency: 'USD', priceMonthly: 6500, classesPerWeek: 3, classMinutes: 30, features: ['12 classes / month', 'One-to-one with a qualified teacher', 'Class recordings', 'Homework & feedback', 'Parent portal'], isHighlighted: true },
    { id: 'intensive', name: 'Intensive', description: 'For Hifz and fast learners', currency: 'USD', priceMonthly: 9900, classesPerWeek: 5, classMinutes: 30, features: ['20 classes / month', 'Dedicated Hifz plan', 'Class recordings', 'Weekly progress report', 'Priority scheduling'], isHighlighted: false },
  ] satisfies PricingPlan[],
  testimonials: [
    { id: 't1', name: 'Aisha R.', location: 'London, UK', role: 'Parent of two', quote: 'My children look forward to every class. The teacher is patient and the parent portal lets me see exactly what they learned.', rating: 5 },
    { id: 't2', name: 'Omar K.', location: 'Toronto, Canada', role: 'Adult learner', quote: 'I finally learned tajweed properly at a time that fits around work. The recordings help me revise between lessons.', rating: 5 },
    { id: 't3', name: 'Fatima S.', location: 'Dubai, UAE', role: 'Hifz student', quote: 'The memorisation tracking keeps me motivated. I can see every surah I have completed.', rating: 5 },
  ] satisfies Testimonial[],
  faqs: [
    { id: 'f1', category: 'General', question: 'How do online classes work?', answer: 'Classes are live, one-to-one video sessions in your browser. You join from your dashboard at the scheduled time — no software installation is required.' },
    { id: 'f2', category: 'General', question: 'Is the first class free?', answer: 'Yes. Book a free trial class and we will match you with a suitable teacher at a time that works in your time zone.' },
    { id: 'f3', category: 'Teachers', question: 'Are female teachers available?', answer: 'Yes. You can request a male or female teacher for yourself or your children.' },
    { id: 'f4', category: 'Scheduling', question: 'Which time zones do you support?', answer: 'All of them. Our teachers cover early mornings, evenings and weekends for students in the US, UK, Canada, Europe, the Gulf and Australia.' },
    { id: 'f5', category: 'Parents', question: 'Can I monitor my child’s progress?', answer: 'Yes. The parent portal shows attendance, homework, recordings and Quran progress for each of your children.' },
  ] satisfies Faq[],
  pages: {
    about: { slug: 'about', title: 'About Us', metaTitle: 'About Us', metaDescription: 'Who we are and how we teach.', ogImageUrl: null, sections: [
      { type: 'richText', heading: 'Our mission', body: 'To make authentic, high-quality Quran education accessible to every Muslim family, wherever they live.' },
      { type: 'richText', heading: 'How we teach', body: 'Every class is one-to-one with a qualified teacher. We focus on correct pronunciation, steady progress and a love for the Book of Allah.' },
    ] },
    'privacy-policy': { slug: 'privacy-policy', title: 'Privacy Policy', metaTitle: 'Privacy Policy', metaDescription: 'How we collect, use and protect your personal information.', ogImageUrl: null, sections: [
      { type: 'richText', heading: 'Information we collect', body: 'Account details you provide at registration, information about children added by a parent, attendance and learning progress, and technical data needed to run live classes.' },
      { type: 'richText', heading: 'How we use it', body: 'To deliver classes, schedule teachers, communicate with you, and improve our service. We do not sell personal data.' },
    ] },
    'terms-and-conditions': { slug: 'terms-and-conditions', title: 'Terms and Conditions', metaTitle: 'Terms and Conditions', metaDescription: 'The terms that apply to using our website and classes.', ogImageUrl: null, sections: [
      { type: 'richText', heading: 'Accounts', body: 'You are responsible for keeping your login details secure. Parents are responsible for accounts they create for children.' },
      { type: 'richText', heading: 'Classes and rescheduling', body: 'Classes must be rescheduled at least 12 hours in advance.' },
    ] },
  } as Record<string, CmsPage>,
};
