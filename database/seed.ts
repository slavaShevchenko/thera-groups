import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { createDbConnectionConfig } from '../server/utils/dbConnection'

config()

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL не найден в .env!')
}

const connectionString = process.env.DATABASE_URL

const adapter = new PrismaPg(createDbConnectionConfig(connectionString))
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
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run seed in production')
    process.exit(1)
  }

  const safeHosts = ['localhost', '127.0.0.1']
  if (process.env.ALLOW_SEED_HOST) {
    safeHosts.push(process.env.ALLOW_SEED_HOST)
  }
  const dbHost = process.env.DATABASE_URL?.match(/@([^:/]+)/)?.[1] ?? ''
  if (!safeHosts.includes(dbHost)) {
    console.error(`❌ Refusing to run seed on host: ${dbHost}`)
    console.error('   Allowed hosts:', safeHosts.join(', '))
    console.error('   Set ALLOW_SEED_HOST=<host> to allow this host')
    process.exit(1)
  }

  if (process.env.CI !== 'true' && process.env.FORCE_SEED !== 'true') {
    const { createInterface } = await import('node:readline')
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await new Promise<string>((resolve) => {
      rl.question('⚠️  This will DELETE data. Continue? (yes/no): ', resolve)
    })
    rl.close()
    if (answer !== 'yes') {
      console.log('Aborted')
      process.exit(0)
    }
  }

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

  // 7. Создание организатора с auth
  const organizerAuthId = await ensureAuthUser('organizer@example.com', 'organizer12345')

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
          specializations: ['Тривожні розлади', 'Депресія', 'ПТСР та травма'],
          experienceYears: 10,
          languages: ['uk', 'en'],
          education: ['КНУ ім. Шевченка, факультет психології'],
          professionalOrganization: 'Українська спілка психотерапевтів',
          professionalOrganizationStatus: 'Дійсний член',
          location: 'Київ, Україна',
          website: 'https://example.com/olena',
          verificationStatus: 'VERIFIED',
        },
      },
    },
    include: { organizerProfile: true },
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
        minParticipants: 4,
        durationHours: 12,
        certificateIssued: true,
        program: '1. Знайомство та правила групи\n2. Що таке тривога і панічна атака\n3. Дихальні техніки та заземлення\n4. Робота з катастрофічними думками\n5. Експозиція: крок за кроком\n6. Підсумки та план підтримки',
        priceAmount: 500,
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
        minParticipants: 6,
        durationHours: 16,
        certificateIssued: false,
        program: 'Модуль 1. Кордони та потреби\nМодуль 2. Я-повідомлення\nМодуль 3. Конфлікт як точка росту\nМодуль 4. Домовленості та підсумки',
        priceAmount: 800,
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
        durationHours: 8,
        certificateIssued: true,
        program: 'Week 1. Grounding and breath awareness\nWeek 2. Body scan practice\nWeek 3. Working with difficult emotions\nWeek 4. Bringing mindfulness into daily life',
        priceAmount: 25,
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
        minParticipants: 5,
        priceAmount: 600,
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
        certificateIssued: false,
        priceAmount: 400,
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
        minParticipants: 8,
        durationHours: 10,
        program: '1. Емоції батьків і дітей\n2. Активне слухання\n3. Межі без покарань\n4. Ритуали та підтримка',
        priceAmount: 450,
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
        priceAmount: 30,
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
        priceAmount: 500,
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
        priceAmount: 35,
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
        priceAmount: 300,
        currency: 'UAH',
        status: 'DRAFT',
      },
      // 20 тестових PUBLISHED груп
      {
        organizerId,
        title: 'Група підтримки для людей з панічними атаками',
        slug: 'panic-attacks-support',
        description: 'Безпечний простір, де ви можете поділитися своїм досвідом та опанувати техніки самодопомоги під час панічних атак. Кожна зустріч включає psychoeducation, вправи на дихання та групову дискусію.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 2, 10, 18, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 2, 10, 20, 0),
        timezone: 'Europe/Kyiv',
        capacity: 12,
        priceAmount: 400,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Самооцінка та внутрішній критик',
        slug: 'self-esteem-inner-critic',
        description: 'Терапевтична група для роботи з низькою самооцінкою та внутрішнім критиком. Ми дослідимо, як формується внутрішній голос, який нас критикує, і навчимось замінювати його на підтримуючий.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 20, 19, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 20, 21, 0),
        timezone: 'Europe/Kyiv',
        capacity: 10,
        priceAmount: 550,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Гештальт-група: контакт та межі',
        slug: 'gestalt-contact-boundaries',
        description: 'Експериментальна група з гештальт-підходу. Фокус — на тому, як ми встановлюємо контакт з іншими та захищаємо свої кордони. Через усвідомлення тіла та експерименти в безпечному середовищі.',
        format: 'OFFLINE',
        type: 'THERAPEUTIC',
        location: 'м. Київ, вул. Велика Васильківська, 72',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 3, 5, 10, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 3, 5, 14, 0),
        timezone: 'Europe/Kyiv',
        capacity: 8,
        priceAmount: 1200,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'КПТ для роботи з переконаннями',
        slug: 'cbt-core-beliefs',
        description: 'Структурована група з когнітивно-поведінкової терапії. Навчимось виявляти автоматичні думки, перевіряти глибинні переконання та будувати нові патерни мислення. Домашні завдання між зустрічами.',
        format: 'ONLINE',
        type: 'WORKSHOP',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 2, 1, 18, 30),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 2, 1, 20, 30),
        timezone: 'Europe/Kyiv',
        capacity: 14,
        priceAmount: 500,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Тілесно-орієнтована терапія: робота з напругою',
        slug: 'somatic-tension-work',
        description: 'Група присвячена дослідженню тілесних патернів напруги та їх зв\'язку з емоціями. Використовуємо вправи з соматичного переживання, дихальні практики та м\'яку роботу з тілом.',
        format: 'OFFLINE',
        type: 'WORKSHOP',
        location: 'м. Львів, вул. Городоцька, 45',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 25, 11, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 25, 15, 0),
        timezone: 'Europe/Kyiv',
        capacity: 6,
        priceAmount: 900,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Група для жінок: відновлення після кризи',
        slug: 'women-crisis-recovery',
        description: 'Підтримуюча група для жінок, які переживають складний життєвий період. Ми створюємо простір для ділитися, отримувати підтримку та знаходити ресурси для відновлення.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 18, 17, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 18, 19, 0),
        timezone: 'Europe/Kyiv',
        capacity: 10,
        priceAmount: 350,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Emotional Freedom Techniques (EFT) Workshop',
        slug: 'eft-tapping-workshop',
        description: 'A hands-on workshop introducing EFT tapping for emotional regulation. Learn to combine cognitive focus with bilateral stimulation to reduce anxiety and process difficult emotions.',
        format: 'HYBRID',
        type: 'WORKSHOP',
        location: 'м. Одеса, вул. Дерибасівська, 12 / Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 2, 15, 14, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 2, 15, 18, 0),
        timezone: 'Europe/Kyiv',
        capacity: 16,
        priceAmount: 40,
        currency: 'USD',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Психодрама: граємо нові сценарії',
        slug: 'psychodrama-new-scenarios',
        description: 'Група з елементами психодрами. Через рольові ігри та імпровізацію досліджуємо життєві ситуації з нових перспектив. Без попереднього досвіду акторської гри.',
        format: 'OFFLINE',
        type: 'THERAPEUTIC',
        location: 'м. Харків, вул. Сумська, 30',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 3, 1, 16, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 3, 1, 19, 0),
        timezone: 'Europe/Kyiv',
        capacity: 10,
        priceAmount: 700,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Медитація та усвідомленість для початківців',
        slug: 'mindfulness-for-beginners',
        description: '4-тижневий курс з основ медитації та майндфулнес. Кожна зустріч — це практика медитації, теоретичний блок та обговорення вашого досвіду. Підходить для тих, хто ніколи не медитував.',
        format: 'ONLINE',
        type: 'WORKSHOP',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 12, 9, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 12, 10, 30),
        timezone: 'Europe/Kyiv',
        capacity: 20,
        priceAmount: 300,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Сімейна системна терапія: робота з парами',
        slug: 'family-systemic-couples',
        description: 'Терапевтична група для пар, які хочуть покращити комунікацію та зрозуміти системні патерни у своїх стосунках. Робота в малих групах під супервізією.',
        format: 'OFFLINE',
        type: 'THERAPEUTIC',
        location: 'м. Київ, вул. Рейтарська, 18',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 2, 8, 11, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 2, 8, 15, 0),
        timezone: 'Europe/Kyiv',
        capacity: 6,
        priceAmount: 1500,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Арт-терапія: мандала як інструмент самопізнання',
        slug: 'art-therapy-mandala',
        description: 'Терапевтична група з використанням малювання мандал. Через символізм кольорів та форм досліджуємо внутрішній світ. Матеріали надаються. Досвід малювання не потрібен.',
        format: 'OFFLINE',
        type: 'WORKSHOP',
        location: 'м. Львів, вул. Коперника, 9',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 22, 14, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 22, 17, 0),
        timezone: 'Europe/Kyiv',
        capacity: 8,
        priceAmount: 600,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Група супервізії для терапевтів-початківців',
        slug: 'supervision-beginners',
        description: 'Групова супервізія для практикуючих психологів з досвідом до 3 років. Розбираємо складні випадки, етичні дилеми та питання професійної ідентичності.',
        format: 'ONLINE',
        type: 'SUPERVISION',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 2, 20, 17, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 2, 20, 19, 30),
        timezone: 'Europe/Kyiv',
        capacity: 8,
        priceAmount: 800,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Робота з травмою: EMDR у груповому форматі',
        slug: 'emdr-group-trauma',
        description: 'Інтенсивна група з елементами EMDR-терапії для роботи з травматичним досвідом. Попередня індивідуальна консультація обов\'язкова. Група обмежена для забезпечення безпеки.',
        format: 'HYBRID',
        type: 'INTENSIVE',
        location: 'м. Київ, вул. Інститутська, 5 / Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 3, 10, 10, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 3, 12, 17, 0),
        timezone: 'Europe/Kyiv',
        capacity: 6,
        priceAmount: 2500,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Підліткова група: емоції та ідентичність',
        slug: 'teen-emotions-identity',
        description: 'Терапевтична група для підлітків 14–17 років. Досліджуємо емоції, стосунки з однолітками, пошук себе. Безпечний простір без оцінювання.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 2, 5, 16, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 2, 5, 17, 30),
        timezone: 'Europe/Kyiv',
        capacity: 8,
        priceAmount: 250,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Narrative Therapy: rewriting your story',
        slug: 'narrative-therapy-rewrite',
        description: 'A 6-session group based on narrative therapy principles. Explore how the stories we tell about ourselves shape our identity, and learn to externalize problems and author preferred narratives.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 28, 12, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 28, 14, 0),
        timezone: 'Europe/London',
        capacity: 10,
        priceAmount: 35,
        currency: 'USD',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Дихальні практики та емоційна регуляція',
        slug: 'breathing-emotional-regulation',
        description: 'Семінар-практикум з дихальних технік для управління емоціями. Вивчимо когерентне дихання, техніку 4-7-8, холотропне дихання та їх застосування у повсякденному житті.',
        format: 'OFFLINE',
        type: 'SEMINAR',
        location: 'м. Дніпро, пр. Гагаріна, 100',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 30, 10, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 30, 16, 0),
        timezone: 'Europe/Kyiv',
        capacity: 20,
        priceAmount: 450,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Група підтримки для ВПО: адаптація та ресурс',
        slug: 'idp-support-adaptation',
        description: 'Безкоштовна група підтримки для внутрішньо переміщених осіб. Простір для тих, хто шукає опору, розуміння та нові стратегії адаптації на новому місці.',
        format: 'ONLINE',
        type: 'THERAPEUTIC',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 1, 14, 18, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 1, 14, 19, 30),
        timezone: 'Europe/Kyiv',
        capacity: 15,
        priceAmount: 0,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Лекція: Нейробіологія стресу та травми',
        slug: 'neurobiology-stress-trauma',
        description: 'Науково-популярна лекція про те, як стрес і травма впливають на мозок та тіло. Розглянемо полівагальну теорію, роль нервової системи та сучасні дослідження.',
        format: 'ONLINE',
        type: 'LECTURE',
        location: 'Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 2, 12, 19, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 2, 12, 21, 0),
        timezone: 'Europe/Kyiv',
        capacity: 50,
        priceAmount: 200,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Конференція: Психотерапія в умовах війни',
        slug: 'conference-therapy-in-war',
        description: 'Одноденна конференція з провідними фахівцями про адаптацію психотерапевтичних підходів до реалій війни. Доповіді, панельні дискусії та воркшопи.',
        format: 'HYBRID',
        type: 'CONFERENCE',
        location: 'м. Київ, вул. Велика Житомирська, 33 / онлайн-трансляція',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 4, 15, 9, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 4, 15, 18, 0),
        timezone: 'Europe/Kyiv',
        capacity: 100,
        priceAmount: 1500,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
      {
        organizerId,
        title: 'Авторська програма: Шлях до себе',
        slug: 'author-program-self-journey',
        description: '12-тижнева авторська програма глибокої особистісної роботи. Поєднання індивідуальних та групових сесій, робота з тілом, медитації та творчі завдання. Відбір через заявку.',
        format: 'HYBRID',
        type: 'AUTHOR_PROGRAM',
        location: 'м. Київ / Zoom',
        startsAt: new Date(now.getFullYear(), now.getMonth() + 3, 20, 18, 0),
        endsAt: new Date(now.getFullYear(), now.getMonth() + 6, 20, 20, 0),
        timezone: 'Europe/Kyiv',
        capacity: 8,
        priceAmount: 8000,
        currency: 'UAH',
        status: 'PUBLISHED',
      },
    ],
  })

  // 10. Создание 60 верифицированных организаторов с 2 группами каждый
  console.log('👥 Creating 60 test organizers...')

  const femaleFirstNames = [
    'Олена', 'Марія', 'Анна', 'Ірина', 'Оксана', 'Наталія', 'Тетяна', 'Світлана',
    'Юлія', 'Катерина', 'Людмила', 'Галина', 'Вікторія', 'Алла', 'Лариса', 'Tamара',
    'Надія', 'Любов', 'Поліна', 'Дарина', 'Софія', 'Марина', 'Євгенія', 'Олександра',
    'Валентина', 'Зоя', 'Анастасія', 'Роксолана', 'Ярослава', 'Михайлина',
  ]
  const maleFirstNames = [
    'Олександр', 'Андрій', 'Сергій', 'Дмитро', 'Михайло', 'Володимир', 'Ігор', 'Петро',
    'Василь', 'Максим', 'Артем', 'Богдан', 'Тарас', 'Роман', 'Юрій', 'Микола',
    'Євген', 'Віталій', 'Анатолій', 'Леонід', 'Павло', 'Руслан', 'Олег', 'Степан',
    'Борис', 'Григорій', 'Данило', 'Захар', 'Кирило', 'Лев',
  ]
  const lastNames = [
    'Коваленко', 'Шевченко', 'Бондаренко', 'Ткаченко', 'Кравченко', 'Олійник',
    'Шевчук', 'Бойко', 'Мельник', 'Лисенко', 'Мороз', 'Марченко', 'Петренко',
    'Савченко', 'Руденко', 'Павленко', 'Захарченко', 'Кравчук', 'Бондар', 'Ткачук',
    'Романенко', 'Сидоренко', 'Іванченко', 'Клименко', 'Гончаренко', 'Поліщук',
    'Козак', 'Левченко', 'Гриценко', 'Дорошенко', 'Білоус', 'Василенко',
    'Дмитренко', 'Гнатюк', 'Коломієць', 'Корнієнко', 'Кузьменко', 'Мартиненко',
    'Нікітченко', 'Остапенко', 'Панченко', 'Скрипник', 'Федоренко', 'Черненко',
    'Яковенко', 'Головко', 'Даниленко', 'Єременко', 'Жук', 'Зайченко',
    'Іваненко', 'Карпенко', 'Логвиненко', 'Мазуренко', 'Науменко', 'Орленко',
    'Петрів', 'Савчук', 'Тимченко', 'Устенко',
  ]
  const cities = [
    'Київ', 'Львів', 'Одеса', 'Харків', 'Дніпро', 'Запоріжжя', 'Вінниця',
    'Полтава', 'Чернівці', 'Івано-Франківськ', 'Тернопіль', 'Рівне', 'Луцьк',
    'Суми', 'Чернігів', 'Хмельницький', 'Житомир', 'Кропивницький', 'Миколаїв', 'Херсон',
  ]
  const specializationsPool = [
    'Тривожні розлади', 'Депресія', 'ПТСР та травма', 'Сімейна терапія',
    'Дитяча психологія', 'КПТ', 'Гештальт-терапія', 'Психодрама',
    'Арт-терапія', 'Тілесна терапія', 'EMDR', 'Наративна терапія',
    'Групова динаміка', 'Залежності', 'Розлади харчової поведінки',
    'Підліткова психологія', 'Стрес та вигорання', 'Самооцінка',
    'Стосунки та прив\u2019язаність', 'Горе та втрата',
  ]
  const qualifications = [
    'Магістр психології', 'Магістр клінічної психології', 'КПТ-терапевт',
    'Гештальт-терапевт', 'Арт-терапевт', 'Сімейний системний терапевт',
    'Психодраматист', 'EMDR-терапевт', 'Тілесно-орієнтований терапевт',
    'Наративний терапевт', 'Психолог-консультант', 'Психоаналітик',
  ]
  const educationOptions = [
    'КНУ ім. Шевченка, факультет психології',
    'НАУ, магістратура клінічної психології',
    'ЛНУ ім. Франка, психологічний факультет',
    'ХНУ ім. Каразіна, факультет філософії та психології',
    'Одеський національний університет, психологія',
    'Інститут психології НАН України',
    'Дніпровський національний університет, психологія',
    'Вінницький державний педагогічний університет',
  ]
  const professionalOrganizations = [
    'Українська спілка психотерапевтів',
    'Національна психологічна асоціація',
    'Українська асоціація когнітивно-поведінкової терапії',
    'Українська федерація психотерапії',
    'Асоціація психологів вищої школи України',
    'Українська асоціація групового аналізу',
  ]
  const professionalOrgStatuses = [
    'Дійсний член',
    'Асоційований член',
    'Кандидат у члени',
    'Сертифікований супервізор',
    'Член правління',
  ]
  const languagesOptions = [
    ['uk'], ['uk', 'en'], ['uk', 'en', 'pl'], ['uk', 'en', 'de'],
    ['uk', 'de'], ['uk', 'pl'], ['uk', 'fr'], ['uk', 'en', 'fr'],
  ]
  const workFormatsOptions = [
    ['ONLINE'], ['OFFLINE'], ['ONLINE', 'OFFLINE'], ['HYBRID'],
    ['ONLINE', 'HYBRID'], ['OFFLINE', 'HYBRID'],
  ]
  const avatarIds = Array.from({ length: 70 }, (_, i) => i + 1)

  const groupTitles: Array<{ title: string; description: string; type: string }> = [
    { title: 'Група підтримки при тривозі', description: 'Безпечний простір для обговорення тривоги, вправи на заземлення та техніка самодопомоги. Кожна зустріч — це psychoeducation, практика та групова дискусія.', type: 'THERAPEUTIC' },
    { title: 'Робота з емоціями', description: 'Досліджуємо, як розпізнавати, називати та регулювати емоції. Вчимося будувати здорові стосунки з власними почуттями через усвідомленість та практику.', type: 'THERAPEUTIC' },
    { title: 'Майндфулнес-група', description: 'Практика усвідомленості для зниження стресу. Медитації, дихальні вправи та обговорення досвіду. Підходить для початківців та тих, хто хоче поглибити практику.', type: 'WORKSHOP' },
    { title: 'Творче самовираження', description: 'Арт-терапевтична група для дослідження внутрішнього світу через творчість. Малювання, ліплення, колажі — матеріали надаються.', type: 'WORKSHOP' },
    { title: 'Комунікація та межі', description: 'Практична група з розвитку навичок комунікації та встановлення здорових кордонів. Рольові ігри, зворотний зв\'язок та реальні кейси.', type: 'THERAPEUTIC' },
    { title: 'Самопізнання та розвиток', description: 'Група для тих, хто хоче краще зрозуміти себе, свої патерни поведінки та цінності. Дослідження через діалог, вправи та рефлексію.', type: 'THERAPEUTIC' },
    { title: 'Стосунки та прив\'язаність', description: 'Терапевтична група про те, як ми будуємо близькість, які патерни прив\'язаності несемо та як створювати здорові стосунки.', type: 'THERAPEUTIC' },
    { title: 'Ресурсна група', description: 'Група підтримки для відновлення внутрішнього ресурсу. Пошук джерел енергії, робота з вигоранням та побудова балансу між роботою і життям.', type: 'THERAPEUTIC' },
    { title: 'Тіло та емоції', description: 'Соматична група для дослідження зв\'язку тіла та емоцій. Робота з напругою, дихальні практики та м\'які тілесні вправи.', type: 'WORKSHOP' },
    { title: 'Підтримка у складні часи', description: 'Відкритий простір для тих, хто переживає складний період. Групова підтримка, стабілізація та пошук опори.', type: 'THERAPEUTIC' },
    { title: 'Впевненість у собі', description: 'Група для роботи з самооцінкою та впевненістю. Досліджуємо внутрішнього критика, вчимося самопідтримці та будуємо нові переконання.', type: 'THERAPEUTIC' },
    { title: 'Група для початківців', description: 'Перший крок у світ психотерапії. Знайомство з основними поняттями, безпечне середовище для першого досвіду групової роботи.', type: 'THERAPEUTIC' },
    { title: 'Глибока особистісна робота', description: 'Інтенсивна група для тих, хто готовий до глибинної роботи з собою. Дослідження патернів, переконань та життєвих сценаріїв.', type: 'THERAPEUTIC' },
    { title: 'Професійний розвиток терапевта', description: 'Група супервізії та обміну досвідом для практикуючих психологів. Розбір випадків, етичні питання та професійна підтримка.', type: 'SUPERVISION' },
    { title: 'Лекція з психології', description: 'Науково-популярна лекція з актуальної теми психології. Теорія, дослідження та практичні приклади для широкого загалу.', type: 'LECTURE' },
    { title: 'Семінар-практикум', description: 'Інтенсивний семінар з практичними вправами. Теорія мінімум — практика максимум. Конкретні інструменти для повсякденного життя.', type: 'SEMINAR' },
    { title: 'Медитаційна практика', description: 'Групові медитаційні сесії з обговоренням. Різні техніки: віпасана, метта, сканування тіла. Для всіх рівнів підготовки.', type: 'WORKSHOP' },
    { title: 'Група самодопомоги', description: 'Взаємопідтримуюча група з чіткою структурою. Кожна зустріч — тема, обговорення та практична вправа для застосування протягом тижня.', type: 'THERAPEUTIC' },
    { title: 'Інтенсив вихідного дня', description: 'Повноцінний терапевтичний інтенсив за один день. Глибока робота в безпечному середовищі з досвідченим терапевтом.', type: 'INTENSIVE' },
    { title: 'Авторська програма', description: 'Унікальна програма, розроблена на основі багаторічного досвіду. Поєднання різних підходів для комплексної роботи.', type: 'AUTHOR_PROGRAM' },
  ]

  const formats: Array<'ONLINE' | 'OFFLINE' | 'HYBRID'> = ['ONLINE', 'OFFLINE', 'HYBRID']
  const groupTypes = ['THERAPEUTIC', 'WORKSHOP', 'SEMINAR', 'LECTURE', 'INTENSIVE', 'SUPERVISION', 'AUTHOR_PROGRAM'] as const

  function pick<T>(arr: T[], seed: number): T {
    return arr[seed % arr.length]
  }

  const createdOrganizerIds: string[] = []

  for (let i = 0; i < 60; i++) {
    const isFemale = i < 30
    const firstName = isFemale ? femaleFirstNames[i % femaleFirstNames.length] : maleFirstNames[i % maleFirstNames.length]
    const lastName = lastNames[i % lastNames.length]
    const city = cities[i % cities.length]
    const slug = `${firstName.toLowerCase().replace(/[^a-zа-яіїє]/gi, '')}-${lastName.toLowerCase().replace(/[^a-zа-яіїє]/gi, '')}-${i}`.replace(/[^a-z0-9-]/gi, '-')
    const email = `organizer${i + 1}@test.com`
    const avatarId = avatarIds[i % avatarIds.length]

    const specStart = i % specializationsPool.length
    const specEnd = (specStart + 2 + (i % 3)) % specializationsPool.length
    const specs = specStart < specEnd
      ? specializationsPool.slice(specStart, specEnd)
      : [...specializationsPool.slice(specStart), ...specializationsPool.slice(0, specEnd)]

    let authId: string
    try {
      authId = await ensureAuthUser(email, 'test12345')
    } catch {
      authId = `fallback-auth-${i}`
    }

    const user = await prisma.user.create({
      data: {
        authId,
        email,
        role: 'ORGANIZER',
        preferredLocale: i % 5 === 0 ? 'en' : 'ua',
        organizerProfile: {
          create: {
            slug,
            firstName,
            lastName,
            avatarUrl: `https://i.pravatar.cc/300?img=${avatarId}`,
            bio: `${pick(qualifications, i)} з ${pick([3, 5, 7, 10, 12, 15, 20], i)}-річним досвідом. Спеціалізується на ${specs.slice(0, 2).join(' та ').toLowerCase()}.`,
            qualification: pick(qualifications, i),
            specializations: specs,
            experienceYears: pick([2, 3, 5, 7, 8, 10, 12, 15, 20], i),
            languages: pick(languagesOptions, i),
            workFormats: pick(workFormatsOptions, i),
            city,
            education: [pick(educationOptions, i), pick(educationOptions, i + 3)],
            professionalOrganization: pick(professionalOrganizations, i),
            professionalOrganizationStatus: pick(professionalOrgStatuses, i),
            location: `${city}, Україна`,
            website: `https://example.com/${slug}`,
            telegramUrl: i % 3 === 0 ? `https://t.me/${slug.replace(/-/g, '')}` : null,
            instagramUrl: i % 4 === 0 ? `https://instagram.com/${slug.replace(/-/g, '')}` : null,
            verificationStatus: 'VERIFIED',
          },
        },
      },
      include: { organizerProfile: true },
    })

    const orgId = user.organizerProfile!.id
    createdOrganizerIds.push(orgId)

    const monthOffset1 = (i % 4) + 1
    const monthOffset2 = monthOffset1 + 1 + (i % 3)
    const day1 = 5 + (i % 20)
    const format1 = formats[i % 3]
    const format2 = formats[(i + 1) % 3]
    const typeIdx1 = i % groupTypes.length
    const typeIdx2 = (i + 3) % groupTypes.length
    const titleIdx1 = i % groupTitles.length
    const titleIdx2 = (i + 10) % groupTitles.length
    const capacity1 = pick([6, 8, 10, 12, 15], i)
    const capacity2 = pick([6, 8, 10, 12, 15, 20], i + 3)
    const price1 = pick([0, 200, 300, 400, 500, 600, 800], i)
    const price2 = pick([0, 250, 350, 450, 550, 700, 900], i + 2)
    const currency1 = i % 7 === 0 ? 'USD' : 'UAH'
    const currency2 = i % 9 === 0 ? 'USD' : 'UAH'

    // Optional fields are varied so the seeded catalog covers every combination:
    // set / unset, certificate true / false / null, with and without a program.
    const minParticipants1 = i % 3 === 0 ? null : Math.max(2, Math.floor(capacity1 / 2))
    const minParticipants2 = i % 4 === 0 ? null : Math.max(2, Math.floor(capacity2 / 2))
    const durationHours1 = i % 5 === 0 ? null : pick([4, 8, 12, 16, 24], i)
    const durationHours2 = i % 3 === 0 ? null : pick([2, 6, 10, 20], i + 1)
    const certificateIssued1 = i % 4 === 0 ? null : i % 4 === 1
    const certificateIssued2 = i % 3 === 0 ? null : i % 3 !== 1
    const program1 = i % 6 === 0
      ? null
      : '1. Знайомство та правила групи\n2. Основні поняття та вправи\n3. Практика у підгрупах\n4. Підсумки й інтеграція досвіду'
    const program2 = i % 5 === 0
      ? null
      : 'Сесія 1. Діагностика запиту\nСесія 2. Робота з темою\nСесія 3. Закріплення результату'

    const locationMap: Record<string, string[]> = {
      ONLINE: ['Zoom', 'Google Meet'],
      OFFLINE: [
        `м. ${city}, вул. Центральна, ${10 + i}`,
        `м. ${city}, вул. Головна, ${5 + i}`,
        `м. ${city}, пр. Незалежності, ${20 + i}`,
      ],
      HYBRID: [`м. ${city}, вул. Практична, ${7 + i} / Zoom`],
    }

    await prisma.group.createMany({
      data: [
        {
          organizerId: orgId,
          title: `${groupTitles[titleIdx1].title}`,
          slug: `${slug}-group-1`,
          description: groupTitles[titleIdx1].description,
          format: format1,
          type: groupTypes[typeIdx1],
          location: pick(locationMap[format1], i),
          startsAt: new Date(now.getFullYear(), now.getMonth() + monthOffset1, day1, 18, 0),
          endsAt: new Date(now.getFullYear(), now.getMonth() + monthOffset1, day1, 20, 0),
          timezone: 'Europe/Kyiv',
          capacity: capacity1,
          minParticipants: minParticipants1,
          durationHours: durationHours1,
          certificateIssued: certificateIssued1,
          program: program1,
          priceAmount: price1,
          currency: currency1,
          status: 'PUBLISHED',
        },
        {
          organizerId: orgId,
          title: `${groupTitles[titleIdx2].title}`,
          slug: `${slug}-group-2`,
          description: groupTitles[titleIdx2].description,
          format: format2,
          type: groupTypes[typeIdx2],
          location: pick(locationMap[format2], i + 1),
          startsAt: new Date(now.getFullYear(), now.getMonth() + monthOffset2, day1, 10, 0),
          endsAt: new Date(now.getFullYear(), now.getMonth() + monthOffset2, day1, 14, 0),
          timezone: 'Europe/Kyiv',
          capacity: capacity2,
          minParticipants: minParticipants2,
          durationHours: durationHours2,
          certificateIssued: certificateIssued2,
          program: program2,
          priceAmount: price2,
          currency: currency2,
          status: 'PUBLISHED',
        },
      ],
    })
  }

  console.log(`✅ Created ${createdOrganizerIds.length} organizers with 120 groups`)

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
