import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { GroupFormData, QuestionInput } from '~~/types'

export type { GroupFormData } from '~~/types'

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
    program: '',
    type: '',
    format: '',
    startDate: '',
    endDate: '',
    time: '',
    location: '',
    languages: [],
    priceAmount: null as number | null,
    maxParticipants: null,
    minParticipants: null,
    durationHours: null,
    certificateIssued: null,
    questions: [],
    status: 'DRAFT',
    rejectionReason: null,
    currency: 'UAH',
    coOrganizers: [],
  })

  const groupOwnerId = ref('')
  /** Display name of `groupOwnerId`, so an admin can see who already owns the group. */
  const groupOwnerName = ref('')

  const isDirty = ref(false)
  const isSaving = ref(false)
  const lastSaved = ref<Date | null>(null)

  const checklist = computed(() => ({
    title: formData.value.title.length >= 3,
    description: formData.value.description.length > 0,
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
      && checklist.value.type
      && checklist.value.startDate
      && checklist.value.format
  })

  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  // Shared by the debounced autosave and flushSave so the two payloads cannot drift.
  // Optional scalars are sent as-is (null clears), strings as '' — the server turns
  // an empty program back into null.
  function buildPayload() {
    return {
      title: formData.value.title || undefined,
      description: formData.value.description || undefined,
      program: formData.value.program,
      type: formData.value.type || undefined,
      format: formData.value.format || undefined,
      startDate: formData.value.startDate ? new Date(formData.value.startDate).toISOString() : undefined,
      endDate: formData.value.endDate ? new Date(formData.value.endDate).toISOString() : null,
      time: formData.value.time || undefined,
      location: formData.value.location || undefined,
      // An array, not `|| undefined`: removing the last language has to reach the server as
      // `[]` and clear the column, the way `organizers/me.patch` handles the same field.
      languages: formData.value.languages,
      priceAmount: formData.value.priceAmount,
      currency: formData.value.currency,
      maxParticipants: formData.value.maxParticipants,
      minParticipants: formData.value.minParticipants,
      durationHours: formData.value.durationHours,
      certificateIssued: formData.value.certificateIssued,
      questions: formData.value.questions.length > 0 ? formData.value.questions : undefined,
      coOrganizers: formData.value.coOrganizers.map(c => ({ userId: c.userId, role: c.role })),
    }
  }

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

        // Не автосохранять недопустимий діапазон дат — форма вже показує помилку
        // інлайн, а сервер відповів би 400 VALIDATION_FAILED.
        if (!isDateRangeValid(formData.value.startDate, formData.value.endDate)) {
          return
        }

        // Не автосохранять і невалідний діапазон учасників (min > max) — форма показує
        // помилку інлайн, а серверний superRefine відповів би 400 VALIDATION_FAILED.
        if (!isParticipantsRangeValid(formData.value.minParticipants, formData.value.maxParticipants)) {
          return
        }

        isSaving.value = true
        try {
          const response = await $fetch<{ group: { id: string, slug: string, status: string } }>(`/api/groups/${currentSlug.value}`, {
            method: 'PATCH',
            body: buildPayload(),
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
          // Silent by design: autosave failure, user can manually save
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

    try {
      const response = await $fetch<{ group: { slug: string } }>(`/api/groups/${currentSlug.value}`, {
        method: 'PATCH',
        body: buildPayload(),
      })
      if (response.group.slug !== currentSlug.value) {
        currentSlug.value = response.group.slug
        const locale = useLocale().locale.value
        window.history.replaceState(window.history.state, '', `/${locale}/groups/edit/${response.group.slug}`)
      }
      lastSaved.value = new Date()
    }
    catch (error) {
      console.error('Flush save failed:', error)
    }
  }

  async function loadGroup(groupSlug: string) {
    const data = await $fetch<Record<string, unknown>>(`/api/groups/${groupSlug}/edit`)

    formData.value.title = data.title as string
    formData.value.description = data.description as string
    formData.value.program = (data.program as string | null) ?? ''
    formData.value.type = (data.type as string) || ''
    formData.value.format = (data.format as string) || ''
    formData.value.startDate = data.startsAt ? toLocalInputValue(new Date(data.startsAt as string)) : ''
    formData.value.endDate = data.endsAt ? toLocalInputValue(new Date(data.endsAt as string)) : ''
    formData.value.location = (data.location as string) || ''
    formData.value.languages = (data.languages as string[]) || []
    formData.value.priceAmount = data.priceAmount != null ? Number(data.priceAmount) : null
    formData.value.maxParticipants = data.capacity as number | null
    formData.value.minParticipants = (data.minParticipants as number | null) ?? null
    formData.value.durationHours = (data.durationHours as number | null) ?? null
    formData.value.certificateIssued = (data.certificateIssued as boolean | null) ?? null
    formData.value.currency = (data.currency as string) || 'UAH'
    formData.value.questions = (data.questions as QuestionInput[]) || []
    formData.value.status = data.status as GroupFormData['status']
    formData.value.rejectionReason = (data.rejectionReason as string) || null

    const rawCoOrg = (data.coOrganizers as Array<{
      userId: string
      role: string
      user?: { firstName: string, lastName: string, avatarUrl?: string | null }
    }>) || []
    formData.value.coOrganizers = rawCoOrg.map(c => ({
      userId: c.userId,
      role: c.role,
      userName: c.user ? `${c.user.firstName} ${c.user.lastName}` : '',
      avatarUrl: c.user?.avatarUrl ?? null,
    }))

    groupOwnerId.value = (data.organizerUserId as string) || ''
    groupOwnerName.value = (data.organizerName as string) || ''

    isDirty.value = false
  }

  return {
    currentSlug,
    formData,
    groupOwnerId,
    groupOwnerName,
    isDirty,
    isSaving,
    lastSaved,
    checklist,
    isReadyToPublish,
    loadGroup,
    flushSave,
  }
}
