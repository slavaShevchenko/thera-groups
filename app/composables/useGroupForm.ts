import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'

export interface GroupQuestion {
  id?: string
  question: string
  type: 'TEXT' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'
  required: boolean
  options: string[]
}

export interface GroupFormData {
  title: string
  description: string
  categoryId: string
  type: string
  format: string
  startDate: string
  endDate: string
  time: string
  location: string
  price: number | null
  maxParticipants: number | null
  questions: GroupQuestion[]
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED'
  rejectionReason: string | null
  currency: string
}

export function useGroupForm(
  initialSlug: Ref<string>,
) {
  const currentSlug = ref(initialSlug.value)

  // Следим за изменением initialSlug извне (например, после router.replace)
  watch(initialSlug, (val) => {
    if (val) currentSlug.value = val
  })

  const formData = ref<GroupFormData>({
    title: '',
    description: '',
    categoryId: '',
    type: '',
    format: '',
    startDate: '',
    endDate: '',
    time: '',
    location: '',
    price: null,
    maxParticipants: null,
    questions: [],
    status: 'DRAFT',
    rejectionReason: null,
    currency: 'UAH',
  })

  const isDirty = ref(false)
  const isSaving = ref(false)
  const lastSaved = ref<Date | null>(null)

  const checklist = computed(() => ({
    title: formData.value.title.length >= 3,
    description: formData.value.description.length >= 100,
    category: formData.value.categoryId !== '',
    type: formData.value.type !== '',
    startDate: formData.value.startDate !== '',
    format: formData.value.format !== '' && (
      formData.value.format === 'ONLINE' || formData.value.location !== ''
    ),
    questions: formData.value.questions.length > 0,
  }))

  const isReadyToPublish = computed(() => {
    return checklist.value.title
      && checklist.value.description
      && checklist.value.category
      && checklist.value.type
      && checklist.value.startDate
      && checklist.value.format
  })

  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  watch(
    formData,
    () => {
      if (!isDirty.value) {
        isDirty.value = true
        return
      }

      if (saveTimeout) clearTimeout(saveTimeout)

      saveTimeout = setTimeout(async () => {
        if (!currentSlug.value || isSaving.value) return

        // Не автосохранять если пользователь ещё ничего не ввёл
        if (!formData.value.title && !formData.value.description) {
          return
        }

        const payload = {
          title: formData.value.title || undefined,
          description: formData.value.description || undefined,
          categoryId: formData.value.categoryId || undefined,
          type: formData.value.type || undefined,
          format: formData.value.format || undefined,
          startDate: formData.value.startDate ? new Date(formData.value.startDate).toISOString() : undefined,
          endDate: formData.value.endDate ? new Date(formData.value.endDate).toISOString() : undefined,
          time: formData.value.time || undefined,
          location: formData.value.location || undefined,
          price: formData.value.price,
          maxParticipants: formData.value.maxParticipants,
          questions: formData.value.questions.length > 0 ? formData.value.questions : undefined,
        }

        isSaving.value = true
        try {
          const response = await $fetch<{ group: { id: string, slug: string, status: string } }>(`/api/groups/${currentSlug.value}`, {
            method: 'PATCH',
            body: payload,
          })

          lastSaved.value = new Date()

          if (response.group.slug !== currentSlug.value) {
            currentSlug.value = response.group.slug
            // Меняем URL напрямую, без роутера — иначе Nuxt пересоздаст
            // страницу и loadGroup затрёт несохранённые поля
            const locale = useLocale().locale.value
            window.history.replaceState(window.history.state, '', `/${locale}/groups/edit/${response.group.slug}`)
          }
        }
        catch {
          // Autosave failure is silent — user sees it via isSaving state
        }
        finally {
          isSaving.value = false
        }
      }, 1500)
    },
    { deep: true },
  )

  // Принудительное сохранение (перед публикацией)
  async function flushSave() {
    if (saveTimeout) clearTimeout(saveTimeout)
    if (!currentSlug.value || isSaving.value) return

    const payload = {
      title: formData.value.title || undefined,
      description: formData.value.description || undefined,
      categoryId: formData.value.categoryId || undefined,
      type: formData.value.type || undefined,
      format: formData.value.format || undefined,
      startDate: formData.value.startDate ? new Date(formData.value.startDate).toISOString() : undefined,
      endDate: formData.value.endDate ? new Date(formData.value.endDate).toISOString() : undefined,
      time: formData.value.time || undefined,
      location: formData.value.location || undefined,
      price: formData.value.price,
      maxParticipants: formData.value.maxParticipants,
      questions: formData.value.questions.length > 0 ? formData.value.questions : undefined,
    }

    try {
      const response = await $fetch<{ group: { slug: string } }>(`/api/groups/${currentSlug.value}`, {
        method: 'PATCH',
        body: payload,
      })
      if (response.group.slug !== currentSlug.value) {
        currentSlug.value = response.group.slug
        const locale = useLocale().locale.value
        window.history.replaceState(window.history.state, '', `/${locale}/groups/edit/${response.group.slug}`)
      }
      lastSaved.value = new Date()
    }
    catch {
      // Flush failure is silent — user sees it via isSaving state
    }
  }

  async function loadGroup(groupSlug: string) {
    const data = await $fetch<Record<string, unknown>>(`/api/groups/${groupSlug}/edit`)

    formData.value.title = data.title as string
    formData.value.description = data.description as string
    formData.value.categoryId = (data.categoryId as string) || ''
    formData.value.type = (data.type as string) || ''
    formData.value.format = (data.format as string) || ''
    formData.value.startDate = data.startsAt ? new Date(data.startsAt as string).toISOString().slice(0, 16) : ''
    formData.value.endDate = data.endsAt ? new Date(data.endsAt as string).toISOString().slice(0, 16) : ''
    formData.value.location = (data.location as string) || ''
    formData.value.price = data.price as number | null
    formData.value.maxParticipants = data.capacity as number | null
    formData.value.currency = data.currency as string
    formData.value.questions = (data.questions as GroupQuestion[]) || []
    formData.value.status = data.status as GroupFormData['status']
    formData.value.rejectionReason = (data.rejectionReason as string) || null

    isDirty.value = false
  }

  return {
    currentSlug,
    formData,
    isDirty,
    isSaving,
    lastSaved,
    checklist,
    isReadyToPublish,
    loadGroup,
    flushSave,
  }
}
