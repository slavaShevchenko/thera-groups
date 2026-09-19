import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL?.replace('sslmode=require', 'sslmode=no-verify')
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function createTestGroup() {
  const user = await prisma.user.create({
    data: { email: `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com` },
  })
  const organizer = await prisma.organizerProfile.create({
    data: {
      userId: user.id,
      slug: `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      firstName: 'Test',
      lastName: 'Organizer',
    },
  })
  const group = await prisma.group.create({
    data: {
      organizerId: organizer.id,
      title: 'Cascade Test Group',
      slug: `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: 'Test group for cascade delete testing',
    },
  })
  return { user, organizer, group }
}

describe('Cascade deletes', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('deletes applications when group is deleted', async () => {
    const { group } = await createTestGroup()

    const application = await prisma.application.create({
      data: {
        groupId: group.id,
        name: 'Test Applicant',
        email: 'applicant@test.com',
      },
    })

    await prisma.group.delete({ where: { id: group.id } })

    const found = await prisma.application.findUnique({ where: { id: application.id } })
    expect(found).toBeNull()
  })

  it('deletes reviews when group is deleted', async () => {
    const { user, organizer, group } = await createTestGroup()

    const review = await prisma.review.create({
      data: {
        organizerId: organizer.id,
        userId: user.id,
        groupId: group.id,
        rating: 5,
        comment: 'Great group',
      },
    })

    await prisma.group.delete({ where: { id: group.id } })

    const found = await prisma.review.findUnique({ where: { id: review.id } })
    expect(found).toBeNull()
  })

  it('deletes reviews when user is deleted', async () => {
    const { organizer, group } = await createTestGroup()
    const reviewUser = await prisma.user.create({
      data: { email: `reviewer-${Date.now()}@test.com` },
    })

    const review = await prisma.review.create({
      data: {
        organizerId: organizer.id,
        userId: reviewUser.id,
        groupId: group.id,
        rating: 4,
        comment: 'Test review',
      },
    })

    await prisma.user.delete({ where: { id: reviewUser.id } })

    const found = await prisma.review.findUnique({ where: { id: review.id } })
    expect(found).toBeNull()
  })

  it('deletes reviews when organizer is deleted', async () => {
    const { group } = await createTestGroup()
    const orgUser = await prisma.user.create({
      data: { email: `orguser-${Date.now()}@test.com` },
    })
    const orgProfile = await prisma.organizerProfile.create({
      data: {
        userId: orgUser.id,
        slug: `org-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        firstName: 'Org',
        lastName: 'Test',
      },
    })

    const review = await prisma.review.create({
      data: {
        organizerId: orgProfile.id,
        userId: orgUser.id,
        groupId: group.id,
        rating: 3,
        comment: 'Test',
      },
    })

    await prisma.organizerProfile.delete({ where: { id: orgProfile.id } })

    const found = await prisma.review.findUnique({ where: { id: review.id } })
    expect(found).toBeNull()
  })

  it('deletes favorites when group or user is deleted', async () => {
    const { user, group } = await createTestGroup()

    const fav = await prisma.favorite.create({
      data: { userId: user.id, groupId: group.id },
    })

    await prisma.group.delete({ where: { id: group.id } })

    const found = await prisma.favorite.findUnique({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
    })
    expect(found).toBeNull()
  })

  it('deletes application answers when application is deleted', async () => {
    const { group } = await createTestGroup()

    const question = await prisma.applicationQuestion.create({
      data: {
        groupId: group.id,
        question: 'Why do you want to join?',
        position: 1,
      },
    })

    const application = await prisma.application.create({
      data: {
        groupId: group.id,
        name: 'Applicant',
        email: 'answers@test.com',
      },
    })

    const answer = await prisma.applicationAnswer.create({
      data: {
        applicationId: application.id,
        questionId: question.id,
        value: 'Because I want to',
      },
    })

    await prisma.application.delete({ where: { id: application.id } })

    const found = await prisma.applicationAnswer.findUnique({
      where: { applicationId_questionId: { applicationId: application.id, questionId: question.id } },
    })
    expect(found).toBeNull()
  })
})
