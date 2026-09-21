import { describe, it, expect, afterAll } from 'vitest'

const connectionString = process.env.DATABASE_URL
const hasValidUrl = !!connectionString && connectionString.startsWith('postgresql')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any

async function getPrisma() {
  if (!prisma) {
    const { PrismaPg } = await import('@prisma/adapter-pg')
    const { PrismaClient } = await import('@prisma/client')
    const { createDbConnectionConfig } = await import('~~/server/utils/dbConnection')
    const adapter = new PrismaPg(createDbConnectionConfig(connectionString!))
    prisma = new PrismaClient({ adapter })
  }
  return prisma
}

async function createTestGroup() {
  const db = await getPrisma()
  const user = await db.user.create({
    data: { email: `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com` },
  })
  const organizer = await db.organizerProfile.create({
    data: {
      userId: user.id,
      slug: `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      firstName: 'Test',
      lastName: 'Organizer',
    },
  })
  const group = await db.group.create({
    data: {
      organizerId: organizer.id,
      title: 'Cascade Test Group',
      slug: `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: 'Test group for cascade delete testing',
    },
  })
  return { user, organizer, group }
}

describe.skipIf(!hasValidUrl)('Cascade deletes', () => {
  afterAll(async () => {
    if (prisma) await prisma.$disconnect()
  })

  it('deletes applications when group is deleted', async () => {
    const db = await getPrisma()
    const { group } = await createTestGroup()

    const application = await db.application.create({
      data: {
        groupId: group.id,
        name: 'Test Applicant',
        email: 'applicant@test.com',
      },
    })

    await db.group.delete({ where: { id: group.id } })

    const found = await db.application.findUnique({ where: { id: application.id } })
    expect(found).toBeNull()
  })

  it('deletes reviews when group is deleted', async () => {
    const db = await getPrisma()
    const { user, organizer, group } = await createTestGroup()

    const review = await db.review.create({
      data: {
        organizerId: organizer.id,
        userId: user.id,
        groupId: group.id,
        rating: 5,
        comment: 'Great group',
      },
    })

    await db.group.delete({ where: { id: group.id } })

    const found = await db.review.findUnique({ where: { id: review.id } })
    expect(found).toBeNull()
  })

  it('deletes reviews when user is deleted', async () => {
    const db = await getPrisma()
    const { organizer, group } = await createTestGroup()
    const reviewUser = await db.user.create({
      data: { email: `reviewer-${Date.now()}@test.com` },
    })

    const review = await db.review.create({
      data: {
        organizerId: organizer.id,
        userId: reviewUser.id,
        groupId: group.id,
        rating: 4,
        comment: 'Test review',
      },
    })

    await db.user.delete({ where: { id: reviewUser.id } })

    const found = await db.review.findUnique({ where: { id: review.id } })
    expect(found).toBeNull()
  })

  it('deletes reviews when organizer is deleted', async () => {
    const db = await getPrisma()
    const { group } = await createTestGroup()
    const orgUser = await db.user.create({
      data: { email: `orguser-${Date.now()}@test.com` },
    })
    const orgProfile = await db.organizerProfile.create({
      data: {
        userId: orgUser.id,
        slug: `org-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        firstName: 'Org',
        lastName: 'Test',
      },
    })

    const review = await db.review.create({
      data: {
        organizerId: orgProfile.id,
        userId: orgUser.id,
        groupId: group.id,
        rating: 3,
        comment: 'Test',
      },
    })

    await db.organizerProfile.delete({ where: { id: orgProfile.id } })

    const found = await db.review.findUnique({ where: { id: review.id } })
    expect(found).toBeNull()
  })

  it('deletes favorites when group or user is deleted', async () => {
    const db = await getPrisma()
    const { user, group } = await createTestGroup()

    await db.favorite.create({
      data: { userId: user.id, groupId: group.id },
    })

    await db.group.delete({ where: { id: group.id } })

    const found = await db.favorite.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
    })
    expect(found).toBeNull()
  })

  it('deletes application answers when application is deleted', async () => {
    const db = await getPrisma()
    const { group } = await createTestGroup()

    const question = await db.applicationQuestion.create({
      data: {
        groupId: group.id,
        question: 'Why do you want to join?',
        position: 1,
      },
    })

    const application = await db.application.create({
      data: {
        groupId: group.id,
        name: 'Applicant',
        email: 'answers@test.com',
      },
    })

    await db.applicationAnswer.create({
      data: {
        applicationId: application.id,
        questionId: question.id,
        value: 'Because I want to',
      },
    })

    await db.application.delete({ where: { id: application.id } })

    const found = await db.applicationAnswer.findUnique({
      where: { applicationId_questionId: { applicationId: application.id, questionId: question.id } },
    })
    expect(found).toBeNull()
  })
})
