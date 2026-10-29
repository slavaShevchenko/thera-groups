import type { ApplicationStatus, Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma'
import type { PrismaClientOrTx } from './types'

export const applicationRepository = {
  async findMyApplications(params: { userId?: string, email: string }) {
    const where: Prisma.ApplicationWhereInput = params.userId
      ? { OR: [{ userId: params.userId }, { email: params.email }] }
      : { email: params.email }

    return prisma.application.findMany({
      where,
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
   * `endsAt` is read so `applicationService.create` can refuse a group whose event has
   * already passed, whatever its status still says.
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
        // Both dates, because the apply gate asks `isPastGroup()`, which falls back to
        // `startsAt` for a group with no end date.
        startsAt: true,
        endsAt: true,
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
   * Applications somebody is still waiting on: pending review or holding an approved seat.
   * Used to refuse deleting a group, which would cascade these rows away silently.
   * @param groupId - The group ID
   * @returns Count of PENDING or APPROVED applications
   */
  async countLiveApplications(groupId: string) {
    return prisma.application.count({
      where: { groupId, status: { in: ['PENDING', 'APPROVED'] } },
    })
  },

  /**
   * Approved applicants, as the addresses a group-lifecycle letter goes to. Only the name
   * and email are read: answers are sensitive and must never leave the database in a
   * notification (AGENTS.md §6).
   * @param groupId - The group ID
   * @returns Approved applications' name and email
   */
  async findApprovedApplicants(groupId: string) {
    return prisma.application.findMany({
      where: { groupId, status: 'APPROVED' },
      select: { name: true, email: true },
    })
  },

  /**
   * Seats currently taken. Paired with `Group.capacity` it is what tells an organizer how
   * many places are left, and what decides whether a FULL group reopens.
   *
   * `tx` is not optional in spirit: the capacity decision is only race-safe when the count
   * runs inside the transaction that holds the group row lock.
   * @param groupId - The group ID
   * @param tx - Optional Prisma client or transaction context
   * @returns Count of APPROVED applications
   */
  async countApproved(groupId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).application.count({
      where: { groupId, status: 'APPROVED' },
    })
  },

  /**
   * The seat summary the managing page shows beside the list: which group this is, how many
   * places it has, how many are taken. One shape, read by both the list endpoint and the
   * status-change response so the two cannot drift.
   *
   * `capacity: null` means unlimited, which is why `approvedCount` is returned rather than
   * a computed "places left".
   * @param groupId - The group ID
   * @returns Group slug, title, status, capacity and approved count, or null if not found
   */
  async findGroupSeats(groupId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { slug: true, title: true, status: true, capacity: true },
    })
    if (!group) return null

    const approvedCount = await prisma.application.count({
      where: { groupId, status: 'APPROVED' },
    })

    return { ...group, approvedCount }
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
   * @param tx - Optional Prisma client or transaction context
   * @returns The application or null if not found or not belonging to the group
   */
  async findByIdAndGroup(id: string, groupId: string, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).application.findFirst({
      where: { id, groupId },
    })
  },

  /**
   * Everything a status change needs to know about the group before it takes the row lock:
   * the identity to notify with, the seat arithmetic, and both halves of the authorization
   * question — who owns the group and who co-organizes it.
   *
   * Co-organizer ids are part of this read because `can('application.manage')` is the check
   * that admits them; without them the queue was visible to a co-organizer and every button
   * in it answered 403.
   * @param slug - The URL-friendly group identifier
   * @returns The group with organizer and co-organizer user ids, or null if not found
   */
  async findGroupForStatusUpdate(slug: string) {
    return prisma.group.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        capacity: true,
        status: true,
        organizer: { select: { userId: true } },
        coOrganizers: { select: { userId: true } },
      },
    })
  },

  /**
   * Updates an application and returns selected fields for notification purposes.
   *
   * `tx` matters for callers inside a transaction: `updateStatus` decides whether the group
   * reopens from FULL by counting approvals in the same transaction, so the status write
   * has to be part of it too. On the global client the count would not see the write, and a
   * rollback would leave the application updated anyway.
   *
   * `rejectionReason` is selected because it is read back after the write rather than
   * trusted from the request: `updateStatus` clears it on every non-rejection, and the
   * applicant's letter must quote what the row now says, not what the caller sent.
   * @param id - The application ID
   * @param data - Prisma update input (e.g. status change)
   * @param tx - Optional Prisma client or transaction context
   * @returns The updated application with id, name, email, status, rejectionReason, and createdAt
   */
  async updateWithSelect(id: string, data: Prisma.ApplicationUpdateInput, tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).application.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
      },
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
