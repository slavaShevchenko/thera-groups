import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  const group = await prisma.group.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      questions: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          question: true,
          type: true,
          required: true,
          options: true,
        },
      },
    },
  })

  if (!group || group.status !== 'PUBLISHED') {
    throw createError({
      statusCode: 404,
      statusMessage: 'Group not found',
    })
  }

  return group.questions
})
