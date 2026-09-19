import { prisma } from '../../../utils/prisma'
import { apiError } from '../../../utils/apiError'
import { ErrorCodes } from '../../../utils/errorCodes'

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
    throw apiError(404, ErrorCodes.NOT_FOUND, 'Group not found')
  }

  return group.questions
})
