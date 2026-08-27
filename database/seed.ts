import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL не найден в .env!')
}

// Prisma Studio (Rust-движок) не понимает sslmode=no-verify,
// поэтому в .env держим sslmode=require, а для сида (node-pg)
// подменяем на no-verify, чтобы обойти self-signed сертификат Supabase
const connectionString = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify')

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// Supabase admin client для создания auth-пользователей
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function ensureAuthUser(email: string, password: string): Promise<string> {
  // Проверяем, существует ли пользователь в Supabase Auth
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const existing = users.find(u => u.email === email)

  if (existing) {
    // Удаляем для идемпотентности
    await supabaseAdmin.auth.admin.deleteUser(existing.id)
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed to create auth user ${email}: ${error?.message}`)
  }

  return data.user.id
}

async function cleanupOrphanedAuthUser(email: string): Promise<void> {
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const existing = users.find(u => u.email === email)
  if (existing) {
    await supabaseAdmin.auth.admin.deleteUser(existing.id)
    console.log(`🗑️  Cleaned up orphaned auth user: ${email}`)
  }
}

async function main() {
  console.log('🌱 Starting database seed...')

  // 4. Очистка базы данных
  await prisma.applicationAnswer.deleteMany()
  await prisma.applicationQuestion.deleteMany()
  await prisma.application.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.review.deleteMany()
  await prisma.group.deleteMany()
  await prisma.organizerProfile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.specialization.deleteMany()
  await prisma.groupTag.deleteMany()

  // Очистка осиротевшего therapist@example.com из Supabase Auth
  await cleanupOrphanedAuthUser('therapist@example.com')

  console.log('🧹 Database cleared')

  // 6. Создание тегов
  await Promise.all([
    prisma.groupTag.upsert({ where: { slug: 'cbt' }, update: {}, create: { name: 'КПТ', slug: 'cbt' } }),
    prisma.groupTag.upsert({ where: { slug: 'online' }, update: {}, create: { name: 'Онлайн', slug: 'online' } }),
    prisma.groupTag.upsert({ where: { slug: 'kyiv' }, update: {}, create: { name: 'Київ', slug: 'kyiv' } }),
    prisma.groupTag.upsert({ where: { slug: 'lviv' }, update: {}, create: { name: 'Львів', slug: 'lviv' } }),
    prisma.groupTag.upsert({ where: { slug: 'art-therapy' }, update: {}, create: { name: 'Арт-терапія', slug: 'art-therapy' } }),
    prisma.groupTag.upsert({ where: { slug: 'mindfulness' }, update: {}, create: { name: 'Усвідомленість', slug: 'mindfulness' } }),
    prisma.groupTag.upsert({ where: { slug: 'for-beginners' }, update: {}, create: { name: 'Для початківців', slug: 'for-beginners' } }),
    prisma.groupTag.upsert({ where: { slug: 'deep-work' }, update: {}, create: { name: 'Глибока робота', slug: 'deep-work' } }),
    prisma.groupTag.upsert({ where: { slug: 'practical-skills' }, update: {}, create: { name: 'Практичні навички', slug: 'practical-skills' } }),
    prisma.groupTag.upsert({ where: { slug: 'body-work' }, update: {}, create: { name: 'Робота з тілом', slug: 'body-work' } }),
    prisma.groupTag.upsert({ where: { slug: 'art-therapy-deep' }, update: {}, create: { name: 'Терапія мистецтвом', slug: 'art-therapy-deep' } }),
  ])

  // 6b. Создание специализаций
  const specializations = await prisma.specialization.createMany({
    data: [
      { nameUa: 'Тривожність та панічні атаки', nameEn: 'Anxiety & panic attacks', slug: 'anxiety-panic-attacks' },
      { nameUa: 'Депресія', nameEn: 'Depression', slug: 'depression' },
      { nameUa: 'Стрес та вигорання', nameEn: 'Stress & burnout', slug: 'stress-burnout' },
      { nameUa: 'ПТСР та травма', nameEn: 'PTSD & trauma', slug: 'ptsd-trauma' },
      { nameUa: 'Горе та втрата', nameEn: 'Grief & loss', slug: 'grief-loss' },
      { nameUa: 'Управління гнівом', nameEn: 'Anger management', slug: 'anger-management' },
      { nameUa: 'Страхи та фобії', nameEn: 'Fears & phobias', slug: 'fears-phobias' },
      { nameUa: 'Самотність', nameEn: 'Loneliness', slug: 'loneliness' },
      { nameUa: 'Самооцінка та впевненість', nameEn: 'Self-esteem & confidence', slug: 'self-esteem-confidence' },
      { nameUa: 'Перфекціонізм', nameEn: 'Perfectionism', slug: 'perfectionism' },
      { nameUa: 'Прокрастинація', nameEn: 'Procrastination', slug: 'procrastination' },
      { nameUa: 'Парні стосунки', nameEn: 'Couple relationships', slug: 'couple-relationships' },
      { nameUa: 'Розлучення та розставання', nameEn: 'Divorce & separation', slug: 'divorce-separation' },
      { nameUa: 'Співзалежність', nameEn: 'Codependency', slug: 'codependency' },
      { nameUa: 'Сімейні конфлікти', nameEn: 'Family conflicts', slug: 'family-conflicts' },
      { nameUa: 'Батьківство', nameEn: 'Parenting', slug: 'parenting' },
      { nameUa: 'Кордони та комунікація', nameEn: 'Boundaries & communication', slug: 'boundaries-communication' },
      { nameUa: 'Токсичні стосунки', nameEn: 'Toxic relationships', slug: 'toxic-relationships' },
      { nameUa: 'Домашнє насильство', nameEn: 'Domestic violence support', slug: 'domestic-violence' },
      { nameUa: 'Особистісний ріст', nameEn: 'Personal growth', slug: 'personal-growth' },
      { nameUa: 'Самопізнання', nameEn: 'Self-awareness', slug: 'self-awareness' },
      { nameUa: 'Кар\'єра та самореалізація', nameEn: 'Career & self-realization', slug: 'career-self-realization' },
      { nameUa: 'Work-life баланс', nameEn: 'Work-life balance', slug: 'work-life-balance' },
      { nameUa: 'Воєнна травма', nameEn: 'War-related trauma', slug: 'war-related-trauma' },
      { nameUa: 'Адаптація та релокація', nameEn: 'Adaptation & relocation', slug: 'adaptation-relocation' },
      { nameUa: 'Кризові стани', nameEn: 'Crisis states', slug: 'crisis-states' },
      { nameUa: 'Психосоматика', nameEn: 'Psychosomatics', slug: 'psychosomatics' },
      { nameUa: 'Розлади харчової поведінки', nameEn: 'Eating disorders', slug: 'eating-disorders' },
      { nameUa: 'Сон та безсоння', nameEn: 'Sleep & insomnia', slug: 'sleep-insomnia' },
      { nameUa: 'Хронічна втома', nameEn: 'Chronic fatigue', slug: 'chronic-fatigue' },
      { nameUa: 'Залежності', nameEn: 'Addictions', slug: 'addictions' },
      { nameUa: 'Цифрова залежність', nameEn: 'Digital addiction', slug: 'digital-addiction' },
      { nameUa: 'СДВГ', nameEn: 'ADHD', slug: 'adhd' },
      { nameUa: 'Підтримка родин військових', nameEn: 'Military families support', slug: 'military-families' },
      { nameUa: 'Підтримка ветеранів', nameEn: 'Veterans support', slug: 'veterans-support' },
      { nameUa: 'Підтримка ВПО', nameEn: 'IDP support', slug: 'idp-support' },
      { nameUa: 'LGBTQ+ підтримка', nameEn: 'LGBTQ+ support', slug: 'lgbtq-support' },
      { nameUa: 'Підлітки та молодь', nameEn: 'Teenagers & youth', slug: 'teenagers-youth' },
      { nameUa: 'Криза середнього віку', nameEn: 'Midlife transitions', slug: 'midlife-transitions' },
      { nameUa: 'Супервізія для психологів', nameEn: 'Supervision for psychologists', slug: 'supervision-psychologists' },
      { nameUa: 'Підтримка фахівців допоміжних професій', nameEn: 'Support for helping professionals', slug: 'helping-professionals' },
    ],
  })

  console.log(`📋 Created ${specializations.count} specializations`)

  // Получаем созданные специализации для связывания
  const allSpecializations = await prisma.specialization.findMany()

  // 7. Создание организатора с auth
  const organizerAuthId = await ensureAuthUser('organizer@example.com', 'organizer12345')

  // Находим специализации для Олены (тревога, депрессия, травма)
  const olenaSpecs = allSpecializations.filter(s =>
    ['anxiety-panic-attacks', 'depression', 'ptsd-trauma'].includes(s.slug),
  )

  const organizerUser = await prisma.user.create({
    data: {
      authId: organizerAuthId,
      email: 'organizer@example.com',
      role: 'ORGANIZER',
      preferredLocale: 'ua',
      organizerProfile: {
        create: {
          slug: 'olena-kovalenko',
          firstName: 'Олена',
          lastName: 'Коваленко',
          avatarUrl: 'https://i.pravatar.cc/300?img=5',
          bio: 'Клінічний психолог з 10-річним досвідом роботи з тривожними розладами та травмою.',
          qualification: 'Магістр психології, КПТ-терапевт',
          specialization: 'Тривожні розлади, депресія, травма',
          experienceYears: 10,
          languages: ['uk', 'en'],
          location: 'Київ, Україна',
          website: 'https://example.com/olena',
          verificationStatus: 'VERIFIED',
          specializations: {
            connect: olenaSpecs.map(s => ({ id: s.id })),
          },
        },
      },
    },
    include: {
      organizerProfile: {
        include: { specializations: true },
      },
    },
  })

  // 7b. Создание админа с auth
  const adminAuthId = await ensureAuthUser('admin@example.com', 'admin12345')

  await prisma.user.create({
    data: {
      authId: adminAuthId,
      email: 'admin@example.com',
      role: 'ADMIN',
      preferredLocale: 'ua',
    },
  })

  const organizerId = organizerUser.organizerProfile!.id

  // 8. Создание 10 групп
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15)
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 15, 20, 0)

  await prisma.group.createMany({
    data: [
      {
        organizerId,
        title: 'Група підтримки при тривозі та панічних атаках',
        slug: 'anxiety-support-group',
        description: 'Безпечний простір для обговорення тривоги та вправи на заземлення.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 10,
        price: 500,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Стосунки без кордонів: як будувати здорову комунікацію',
        slug: 'healthy-relationships',
        description: 'Практична група для тих, хто хоче покращити навички спілкування.',
        format: 'OFFLINE',
        type: 'THERAPEUTIC',
        location: 'м. Київ, вул. Хрещатик, 10',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 8,
        price: 800,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Mindfulness & Stress Relief Group',
        slug: 'mindfulness-stress-relief',
        description: 'An 8-week program focused on mindfulness meditation.',
        format: 'ONLINE',
        type: 'WORKSHOP',
        location: 'Google Meet',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 12,
        price: 25,
        currency: 'USD',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Подолання професійного вигорання',
        slug: 'burnout-recovery',
        description: 'Група для IT-спеціалістів та працівників допомагаючих професій.',
        format: 'HYBRID',
        type: 'THERAPEUTIC',
        location: 'м. Київ, вул. Січових Стрільців, 5 / Zoom',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 10,
        price: 600,
        currency: 'UAH',
        status: 'FULL',
      },
      {
        organizerId,
        title: 'Art Therapy for Emotional Healing',
        slug: 'art-therapy-healing',
        description: 'Express your emotions through art. No prior experience required.',
        format: 'OFFLINE',
        type: 'WORKSHOP',
        location: 'м. Львів, вул. Вірменська, 15',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 6,
        price: 400,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Свідоме батьківство: як чути свою дитину',
        slug: 'conscious-parenting',
        description: 'Підтримка для батьків дітей дошкільного віку.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 15,
        price: 450,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'ADHD Support & Strategies',
        slug: 'adhd-support',
        description: 'A supportive space for adults with ADHD to share challenges.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/London',
        capacity: 10,
        price: 30,
        currency: 'USD',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Робота з горем та втратою',
        slug: 'grief-and-loss',
        description: 'Закрита група для тих, хто переживає втрату близької людини.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() - 2, 10),
        endsAt: new Date(now.getFullYear(), now.getMonth() - 1, 10),
        timezone: 'Europe/Kyiv',
        capacity: 8,
        price: 500,
        currency: 'UAH',
        status: 'COMPLETED',
      },
      {
        organizerId,
        title: 'Emotional Intelligence at Work',
        slug: 'emotional-intelligence-work',
        description: 'Develop self-awareness and empathy to improve workplace relationships.',
        format: 'HYBRID',
        type: 'SEMINAR',
        location: 'м. Київ, онлайн-платформа',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 10,
        price: 35,
        currency: 'USD',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Тестова група (Не опублікована)',
        slug: 'test-draft-group',
        description: 'Ця група знаходиться в статусі чернетки.',
        format: 'ONLINE',
        type: 'OTHER',
        location: 'Zoom',
        startsAt: nextMonth,
        endsAt: nextMonthEnd,
        timezone: 'Europe/Kyiv',
        capacity: 5,
        price: 300,
        currency: 'UAH',
        status: 'DRAFT',
      },
    ],
  })

  // 9. Добавление вопросов к заявкам
  const publishedGroups = await prisma.group.findMany({
    where: { status: 'PUBLISHED' },
    take: 2,
  })

  if (publishedGroups.length >= 2) {
    await prisma.applicationQuestion.createMany({
      data: [
        {
          groupId: publishedGroups[0].id,
          question: 'Чи є у вас досвід відвідування психотерапевтичних груп раніше?',
          type: 'SINGLE_CHOICE',
          required: true,
          position: 1,
        },
        {
          groupId: publishedGroups[0].id,
          question: 'Яку основну мету ви ставите перед собою?',
          type: 'TEXT',
          required: true,
          position: 2,
        },
        {
          groupId: publishedGroups[1].id,
          question: 'Do you have any accessibility requirements we should know about?',
          type: 'TEXT',
          required: false,
          position: 1,
        },
      ],
    })
  }

  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
