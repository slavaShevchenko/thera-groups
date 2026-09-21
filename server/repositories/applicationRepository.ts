import type { ApplicationStatus, Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'

export const applicationRepository = {
  async findMyApplications(email: string) {
    return prisma.application.findMany({
      where: { email },
      include: {
        group: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            startsAt: true,
            organizer: { select: { userId: true } },
          },
        },
        answers: {
          include: {
            question: { select: { id: true, question: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  },

  async findPublishedById(id: string) {
    return prisma.group.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
  },

  async findPublishedBySlug(slug: string) {
    return prisma.group.findUnique({
      where: { slug },
      select: { id: true, status: true },
    })
  },

  async findGroupApplications(groupId: string, options: {
    status?: string
    orderBy?: { status: 'asc' } | { createdAt: 'desc' }
    skip?: number
    take?: number
  } = {}) {
    const { status, orderBy = { createdAt: 'desc' }, skip, take = 50 } = options
    const where: Prisma.ApplicationWhereInput = {
      groupId,
      ...(status && { status: status as ApplicationStatus }),
    }

    return prisma.application.findMany({
      where,
      include: {
        answers: {
          include: {
            question: { select: { id: true, question: true, type: true } },
          },
        },
      },
      orderBy,
      skip,
      take,
    })
  },

  async findGroupQuestionsPublished(slug: string) {
    return prisma.group.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        questions: {
          orderBy: { position: 'asc' },
          select: { id: true, question: true, type: true, required: true, options: true },
        },
      },
    })
  },

  /**
   * Finds applications by email with pagination, including group title and slug.
   * @param email - The applicant's email address
   * @param options - Optional skip/take pagination parameters
   * @returns Object with applications array and total count
   */
  async findByEmail(email: string, options: {
    skip?: number
    take?: number
  } = {}) {
    const { skip = 0, take = 50 } = options
    const where = { email }

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { group: { select: { title: true, slug: true } } },
      }),
      prisma.application.count({ where }),
    ])

    return { applications, total }
  },

  /**
   * Finds applications for a group with optional status filter, including answers and question details.
   * @param groupId - The group ID (optional)
   * @param options - Optional status filter and skip/take pagination
   * @returns Array of applications with group info and answers
   */
  async findByGroup(groupId: string | undefined, options: {
    status?: ApplicationStatus
    skip?: number
    take?: number
  } = {}) {
    const { status, skip, take } = options
    const where: Prisma.ApplicationWhereInput = {
      ...(groupId && { groupId }),
      ...(status && { status }),
    }

    return prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        group: { select: { id: true, title: true, slug: true } },
        answers: {
          include: {
            question: { select: { question: true, type: true } },
          },
        },
      },
    })
  },

  /**
   * Finds a single application by ID with group and answers.
   * @param id - The application ID
   * @returns The application or null if not found
   */
  async findById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: { group: true, answers: true },
    })
  },

  /**
   * Counts applications matching a given where clause for a group.
   * @param where - Prisma where input for filtering applications
   * @returns Total count of matching applications
   */
  async countByGroup(where: Prisma.ApplicationWhereInput) {
    return prisma.application.count({ where })
  },

  /**
   * Groups and counts applications by status for a given group.
   * @param groupId - Optional group ID to filter by
   * @returns Array of status groupBy results with counts
   */
  async countByStatus(groupId?: string) {
    const where: Prisma.ApplicationWhereInput = groupId ? { groupId } : {}
    return prisma.application.groupBy({
      by: ['status'],
      where,
      _count: true,
    })
  },

  /**
   * Counts applications created since a given date matching the where clause.
   * @param where - Prisma where input for filtering applications
   * @param since - Date threshold for recent applications
   * @returns Count of recent matching applications
   */
  async countRecent(where: Prisma.ApplicationWhereInput, since: Date) {
    return prisma.application.count({
      where: { ...where, createdAt: { gte: since } },
    })
  },

  /**
   * Updates an application's status by ID.
   * @param id - The application ID
   * @param status - New application status
   * @returns The updated application record
   */
  async updateStatus(id: string, status: ApplicationStatus) {
    return prisma.application.update({
      where: { id },
      data: { status },
    })
  },

  /**
   * Finds a group by slug with its questions and organizer locale for application creation.
   * @param slug - The URL-friendly group identifier
   * @returns The group with questions and organizer info, or null if not found
   */
  async findGroupWithQuestions(slug: string) {
    return prisma.group.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        title: true,
        slug: true,
        questions: {
          select: {
            id: true,
            question: true,
            type: true,
            required: true,
            options: true,
          },
        },
        organizer: {
          select: {
            userId: true,
            user: { select: { preferredLocale: true } },
          },
        },
      },
    })
  },

  /**
   * Finds an existing application by group ID and email to prevent duplicates.
   * @param groupId - The group ID
   * @param email - The applicant's email
   * @returns The application or null if not found
   */
  async findByGroupAndEmail(groupId: string, email: string) {
    return prisma.application.findFirst({
      where: { groupId, email },
    })
  },

  /**
   * Creates a new application with answers in PENDING status.
   * @param data - Application data including groupId, name, email, phone, and answers
   * @returns The created application with id, status, and createdAt
   */
  async create(data: {
    groupId: string
    name: string
    email: string
    phone: string | undefined
    answers: Array<{ questionId: string, value: string }>
  }) {
    return prisma.application.create({
      data: {
        groupId: data.groupId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        status: 'PENDING',
        answers: {
          create: data.answers.map(a => ({
            questionId: a.questionId,
            value: a.value,
          })),
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    })
  },

  /**
   * Finds an application by ID scoped to a specific group for ownership verification.
   * @param id - The application ID
   * @param groupId - The group ID to scope the lookup
   * @returns The application or null if not found or not belonging to the group
   */
  async findByIdAndGroup(id: string, groupId: string) {
    return prisma.application.findFirst({
      where: { id, groupId },
    })
  },

  /**
   * Updates an application and returns selected fields for notification purposes.
   * @param id - The application ID
   * @param data - Prisma update input (e.g. status change)
   * @returns The updated application with id, name, email, status, and createdAt
   */
  async updateWithSelect(id: string, data: Prisma.ApplicationUpdateInput) {
    return prisma.application.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      },
    })
  },

  /**
   * Finds a group's basic info (title and slug) by ID for notification context.
   * @param id - The group ID
   * @returns The group with title and slug, or null if not found
   */
  async findGroupBasic(id: string) {
    return prisma.group.findUnique({
      where: { id },
      select: { title: true, slug: true },
    })
  },

  /**
   * Finds a group by slug with organizer userId for permission checks.
   * @param slug - The URL-friendly group identifier
   * @returns The group with organizer userId, or null if not found
   */
  async findGroupWithOrganizer(slug: string) {
    return prisma.group.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        organizer: { select: { userId: true } },
      },
    })
  },
}
