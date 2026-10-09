export default {
  'group.published': {
    subject: 'Вашу групу опубліковано',
    body: 'Ваша група «{title}» опублікована і доступна відвідувачам',
  },
  'group.rejected': {
    subject: 'Групу відхилено',
    body: 'Ваша група «{title}» відхилена. Причина: {reason}',
  },
  'group.submitted': {
    subject: 'Групу надіслано на модерацію',
    body: 'Ваша група «{title}» очікує перевірки модератором',
  },
  'group.autoRevert': {
    subject: 'Групу повернуто на модерацію',
    body: 'Ваша група «{title}» знову на модерації: після публікації змінилися дані, які бачать відвідувачі',
  },
  'group.completedOwner': {
    subject: 'Групу завершено',
    body: 'Вашу групу «{title}» позначено завершеною — вона залишається в каталозі як архівна',
  },
  'group.completedApplicant': {
    subject: 'Групу завершено',
    body: 'Група «{groupTitle}», на яку вашу заявку схвалили, завершилася — дякуємо за участь',
  },
  'group.cancelledOwner': {
    subject: 'Групу скасовано',
    body: 'Вашу групу «{title}» скасовано — схвалені заявники отримали повідомлення',
  },
  'group.cancelledApplicant': {
    subject: 'Групу скасовано',
    body: 'Групу «{groupTitle}», на яку вашу заявку схвалили, скасовано',
  },
  'application.new': {
    subject: 'Нова заявка',
    body: '{applicantName} подав заявку на групу «{groupTitle}»',
  },
  'application.submitted': {
    subject: 'Заявку отримано',
    body: 'Ваша заявка на групу «{groupTitle}» отримана — організатор розгляне її найближчим часом',
  },
  'application.approved': {
    subject: 'Вашу заявку схвалено',
    body: 'Ваша заявка на групу «{groupTitle}» була схвалена.',
  },
  'application.rejected': {
    subject: 'Вашу заявку відхилено',
    body: 'Ваша заявка на групу «{groupTitle}» була відхилена.',
  },
  'application.withdrawn': {
    subject: 'Заявку відкликано',
    body: '{applicantName} відкликав(ла) заявку на групу «{groupTitle}»',
  },
  'organizer.welcome': {
    subject: 'Профіль організатора створено',
    body: 'Ваш профіль очікує верифікації — ми повідомимо, щойно модератор його підтвердить',
  },
  'organizer.verified': {
    subject: 'Профіль верифіковано',
    body: 'Ваш профіль «{name}» верифіковано',
  },
  'organizer.rejected': {
    subject: 'Профіль відхилено',
    body: 'Ваш профіль «{name}» відхилено. Причина: {reason}',
  },
  'admin.group.pending': {
    subject: 'Нова група на модерації',
    body: '{title}',
  },
  'admin.organizer.pending': {
    subject: 'Новий профіль на верифікації',
    body: '{name}',
  },
}
