export default {
  'common.greeting': 'Вітаємо, {name}!',
  'common.greetingGeneric': 'Вітаємо!',
  'common.reasonLabel': 'Причина: {reason}',
  'common.footer.tagline': 'Каталог психотерапевтичних груп',
  'common.footer.unsubscribeHint':
    'Ви отримали цей лист, бо маєте обліковий запис на PsyGroup або подавали заявку на участь у групі.',
  'common.footer.unsubscribe': 'Керувати сповіщеннями',
  'common.footer.privacy': 'Політика приватності',
  'common.footer.terms': 'Умови користування',
  'common.footer.contact': 'Написати нам',
  'common.footer.address': 'PsyGroup, Київ, Україна',
  'common.footer.rights': '© {year} PsyGroup. Усі права захищено.',

  'cta.viewGroup': 'Переглянути групу',
  'cta.viewApplications': 'Переглянути заявки',
  'cta.editGroup': 'Редагувати групу',
  'cta.createGroup': 'Створити групу',
  'cta.viewProfile': 'Перейти до профілю',
  'cta.adminPanel': 'Відкрити панель адміністратора',
  'cta.browseGroups': 'Переглянути каталог',

  'subject.applicationReceived': 'Нова заявка на групу «{groupTitle}»',
  'applicationReceived.preheader': '{applicantName} подав(ла) заявку на вашу групу.',
  'applicationReceived.body1':
    '{applicantName} подав(ла) заявку на участь у вашій групі «{groupTitle}».',
  'applicationReceived.body2': 'Перегляньте та опрацюйте заявку у розділі керування групою.',

  'subject.applicationSubmitted': 'Заявку отримано — «{groupTitle}»',
  'applicationSubmitted.preheader': 'Ми отримали вашу заявку на групу «{groupTitle}».',
  'applicationSubmitted.body1':
    'Вашу заявку на участь у групі «{groupTitle}» отримано — організатор уже бачить її у розділі керування групою.',
  'applicationSubmitted.body2':
    'Організатор розгляне заявку та ухвалить рішення, про яке ми повідомимо окремим листом. Ваші відповіді на запитання анкети бачить лише організатор цієї групи.',

  'subject.applicationApproved': 'Вашу заявку схвалено — «{groupTitle}»',
  'applicationApproved.preheader': 'Організатор схвалив вашу заявку на групу «{groupTitle}».',
  'applicationApproved.body1':
    'Організатор схвалив вашу заявку на участь у групі «{groupTitle}».',
  'applicationApproved.body2':
    'Подальші деталі участі організатор повідомить окремо — слідкуйте за сторінкою групи.',

  'subject.applicationRejected': 'Рішення щодо вашої заявки — «{groupTitle}»',
  'applicationRejected.preheader': 'Вашу заявку на групу «{groupTitle}» відхилено.',
  'applicationRejected.body1':
    'На жаль, організатор відхилив вашу заявку на участь у групі «{groupTitle}».',
  'applicationRejected.body2':
    'Ви можете подати заявку на інші групи каталогу — місця з’являються регулярно.',

  'subject.applicationWithdrawn': 'Заявку відкликано — «{groupTitle}»',
  'applicationWithdrawn.preheader': '{applicantName} відкликав(ла) заявку на вашу групу.',
  'applicationWithdrawn.body1':
    '{applicantName} відкликав(ла) свою заявку на участь у групі «{groupTitle}».',
  'applicationWithdrawn.body2': 'Дії не потрібно: місце автоматично повернулося у вільні.',

  'subject.groupPublished': 'Вашу групу опубліковано — «{groupTitle}»',
  'groupPublished.preheader': 'Група «{groupTitle}» пройшла модерацію і доступна відвідувачам.',
  'groupPublished.body1':
    'Група «{groupTitle}» успішно пройшла модерацію і тепер доступна відвідувачам каталогу.',
  'groupPublished.body2': 'Ми надішлемо листа, щойно хтось подасть заявку на участь.',

  'subject.groupRejected': 'Групу не опубліковано — «{groupTitle}»',
  'groupRejected.preheader': 'Модератор відхилив групу «{groupTitle}».',
  'groupRejected.body1': 'Модератор відхилив вашу групу «{groupTitle}».',
  'groupRejected.body2': 'Внесіть зміни та надішліть групу на повторну модерацію.',

  'subject.groupPendingReview': 'Нова група на модерації — «{groupTitle}»',
  'groupPendingReview.preheader': 'Група «{groupTitle}» очікує перевірки.',
  'groupPendingReview.body1': 'Групу «{groupTitle}» надіслано на модерацію.',
  'groupPendingReview.body2': 'Опублікуйте або відхиліть її в панелі адміністратора.',

  'subject.groupSubmitted': 'Групу надіслано на модерацію — «{groupTitle}»',
  'groupSubmitted.preheader': 'Група «{groupTitle}» очікує перевірки модератором.',
  'groupSubmitted.body1': 'Вашу групу «{groupTitle}» надіслано на модерацію.',
  'groupSubmitted.body2':
    'Ми переглянемо її протягом 1–2 робочих днів і повідомимо про рішення окремим листом. Доки триває перевірка, група не показується у каталозі.',

  'subject.groupAutoRevert': 'Групу повернуто на модерацію — «{groupTitle}»',
  'groupAutoRevert.preheader': 'Група «{groupTitle}» знову очікує перевірки після редагування.',
  'groupAutoRevert.body1':
    'Вашу групу «{groupTitle}» повернуто на модерацію: після публікації змінилися дані, які бачать відвідувачі.',
  'groupAutoRevert.changedFields': 'Змінені дані: {fields}',
  'groupAutoRevert.body2':
    'Будь ласка, зачекайте повторної перевірки — ми надішлемо листа, щойно модератор ухвалить рішення. До того часу група не показується у каталозі.',

  // Labels for the critical group fields named in `groupAutoRevert.changedFields`. Keyed by
  // the update-payload field name, not the database column, because that is what the
  // diff in `groupService` reports.
  'field.title': 'назва',
  'field.description': 'опис',
  'field.type': 'тип групи',
  'field.format': 'формат проведення',
  'field.location': 'локація',
  'field.priceAmount': 'вартість участі',
  'field.currency': 'валюта',
  'field.startDate': 'дата початку',
  'field.endDate': 'дата завершення',
  'field.maxParticipants': 'кількість місць',

  'subject.organizerPendingReview': 'Новий профіль на верифікації — {organizerName}',
  'organizerPendingReview.preheader': 'Профіль «{organizerName}» очікує верифікації.',
  'organizerPendingReview.body1':
    'Організатор «{organizerName}» зареєструвався і очікує верифікації.',
  'organizerPendingReview.body2': 'Підтвердьте або відхиліть профіль у панелі адміністратора.',

  'subject.organizerVerified': 'Ваш профіль верифіковано',
  'organizerVerified.preheader':
    'Профіль «{organizerName}» підтверджено — тепер ви можете створювати групи.',
  'organizerVerified.body1': 'Ваш профіль «{organizerName}» успішно верифіковано.',
  'organizerVerified.body2': 'Тепер ви можете створювати та публікувати власні групи.',

  'subject.organizerRejected': 'Профіль не верифіковано',
  'organizerRejected.preheader': 'Профіль «{organizerName}» відхилено.',
  'organizerRejected.body1': 'На жаль, ваш профіль «{organizerName}» не пройшов верифікацію.',
  'organizerRejected.body2':
    'Оновіть дані профілю та надішліть його на повторну перевірку — після верифікації стане доступним створення груп.',

  'subject.organizerWelcome': 'Вітаємо у PsyGroup — ваш профіль на перевірці',
  'organizerWelcome.preheader': 'Профіль організатора створено та очікує верифікації.',
  'organizerWelcome.body1':
    'Дякуємо за реєстрацію! Ваш профіль організатора створено і зараз перебуває на перевірці.',
  'organizerWelcome.body2':
    'Ми надішлемо листа, щойно модератор підтвердить профіль — після верифікації стане доступним створення груп. До того часу ви можете доповнити дані профілю: освіту, досвід групової роботи та спеціалізації.',
}
