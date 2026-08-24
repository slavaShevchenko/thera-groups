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

async function main() {
  console.log('🌱 Starting database seed...')

  // 4. Очистка базы данных
  await prisma.applicationAnswer.deleteMany()
  await prisma.applicationQuestion.deleteMany()
  await prisma.application.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.review.deleteMany()
  await prisma.group.deleteMany()
  await prisma.therapistProfile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.groupTag.deleteMany()
  await prisma.groupCategory.deleteMany()

  console.log('🧹 Database cleared')

  // 5. Создание категорий
  const categories = await Promise.all([
    prisma.groupCategory.upsert({
      where: { slug: 'anxiety-stress' },
      update: {},
      create: { name: 'Тривога та стрес', slug: 'anxiety-stress' },
    }),
    prisma.groupCategory.upsert({
      where: { slug: 'relationships' },
      update: {},
      create: { name: 'Стосунки та сім\'я', slug: 'relationships' },
    }),
    prisma.groupCategory.upsert({
      where: { slug: 'personal-growth' },
      update: {},
      create: { name: 'Особистісний ріст', slug: 'personal-growth' },
    }),
    prisma.groupCategory.upsert({
      where: { slug: 'burnout' },
      update: {},
      create: { name: 'Професійне вигорання', slug: 'burnout' },
    }),
    prisma.groupCategory.upsert({
      where: { slug: 'parenting' },
      update: {},
      create: { name: 'Батьківство та діти', slug: 'parenting' },
    }),
  ])

  // 6. Создание тегов
  await Promise.all([
    prisma.groupTag.upsert({ where: { slug: 'cbt' }, update: {}, create: { name: 'КПТ', slug: 'cbt' } }),
    prisma.groupTag.upsert({ where: { slug: 'online' }, update: {}, create: { name: 'Онлайн', slug: 'online' } }),
    prisma.groupTag.upsert({ where: { slug: 'kyiv' }, update: {}, create: { name: 'Київ', slug: 'kyiv' } }),
    prisma.groupTag.upsert({ where: { slug: 'lviv' }, update: {}, create: { name: 'Львів', slug: 'lviv' } }),
    prisma.groupTag.upsert({ where: { slug: 'art-therapy' }, update: {}, create: { name: 'Арт-терапія', slug: 'art-therapy' } }),
    prisma.groupTag.upsert({ where: { slug: 'mindfulness' }, update: {}, create: { name: 'Усвідомленість', slug: 'mindfulness' } }),
  ])

  // 7. Создание терапевта с auth
  const therapistAuthId = await ensureAuthUser('therapist@example.com', 'therapist12345')

  const therapistUser = await prisma.user.create({
    data: {
      authId: therapistAuthId,
      email: 'therapist@example.com',
      role: 'THERAPIST',
      preferredLocale: 'ua',
      therapistProfile: {
        create: {
          firstName: 'Олена',
          lastName: 'Коваленко',
          bio: 'Клінічний психолог з 10-річним досвідом роботи з тривожними розладами та травмою.',
          qualification: 'Магістр психології, КПТ-терапевт',
          specialization: 'Тривожні розлади, депресія, травма',
          experienceYears: 10,
          languages: ['uk', 'en'],
          location: 'Київ, Україна',
          website: 'https://example.com/olena',
          verificationStatus: 'VERIFIED',
        },
      },
    },
    include: {
      therapistProfile: true,
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

  const therapistId = therapistUser.therapistProfile!.id

  // 8. Создание 10 групп
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15)
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 15, 20, 0)

  await prisma.group.createMany({
    data: [
      {
        therapistId,
        title: 'Група підтримки при тривозі та панічних атаках',
        slug: 'anxiety-support-group',
        description: 'Безпечний простір для обговорення тривоги та вправи на заземлення.',
        categoryId: categories[0].id,
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
        therapistId,
        title: 'Стосунки без кордонів: як будувати здорову комунікацію',
        slug: 'healthy-relationships',
        description: 'Практична група для тих, хто хоче покращити навички спілкування.',
        categoryId: categories[1].id,
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
        therapistId,
        title: 'Mindfulness & Stress Relief Group',
        slug: 'mindfulness-stress-relief',
        description: 'An 8-week program focused on mindfulness meditation.',
        categoryId: categories[0].id,
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
        therapistId,
        title: 'Подолання професійного вигорання',
        slug: 'burnout-recovery',
        description: 'Група для IT-спеціалістів та працівників допомагаючих професій.',
        categoryId: categories[3].id,
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
        therapistId,
        title: 'Art Therapy for Emotional Healing',
        slug: 'art-therapy-healing',
        description: 'Express your emotions through art. No prior experience required.',
        categoryId: categories[2].id,
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
        therapistId,
        title: 'Свідоме батьківство: як чути свою дитину',
        slug: 'conscious-parenting',
        description: 'Підтримка для батьків дітей дошкільного віку.',
        categoryId: categories[4].id,
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
        therapistId,
        title: 'ADHD Support & Strategies',
        slug: 'adhd-support',
        description: 'A supportive space for adults with ADHD to share challenges.',
        categoryId: categories[2].id,
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
        therapistId,
        title: 'Робота з горем та втратою',
        slug: 'grief-and-loss',
        description: 'Закрита група для тих, хто переживає втрату близької людини.',
        categoryId: categories[0].id,
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
        therapistId,
        title: 'Emotional Intelligence at Work',
        slug: 'emotional-intelligence-work',
        description: 'Develop self-awareness and empathy to improve workplace relationships.',
        categoryId: categories[3].id,
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
        therapistId,
        title: 'Тестова група (Не опублікована)',
        slug: 'test-draft-group',
        description: 'Ця група знаходиться в статусі чернетки.',
        categoryId: categories[2].id,
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
