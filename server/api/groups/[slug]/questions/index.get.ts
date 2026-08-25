import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Slug is required' })

  const group = await prisma.group.findUnique({ where: { slug } })
  if (!group) throw createError({ statusCode: 404, statusMessage: 'Group not found' })

  const questions = await prisma.applicationQuestion.findMany({
    where: { groupId: group.id },
    orderBy: { position: 'asc' },
  })

  return questions.map(q => ({
    id: q.id,
    question: q.question,
    type: q.type,
    required: q.required,
    position: q.position,
    options: q.options,
  }))
})
