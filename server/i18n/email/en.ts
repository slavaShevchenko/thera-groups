export default {
  'common.greeting': 'Hello, {name}!',
  'common.greetingGeneric': 'Hello!',
  'common.reasonLabel': 'Reason: {reason}',
  'common.footer.tagline': 'Psychotherapy groups catalog',
  'common.footer.unsubscribeHint':
    'You received this email because you have a PsyGroup account or submitted a group application.',
  'common.footer.unsubscribe': 'Manage notifications',
  'common.footer.privacy': 'Privacy policy',
  'common.footer.terms': 'Terms of service',
  'common.footer.contact': 'Contact us',
  'common.footer.address': 'PsyGroup, Kyiv, Ukraine',
  'common.footer.rights': '© {year} PsyGroup. All rights reserved.',

  'cta.viewGroup': 'View the group',
  'cta.viewApplications': 'View applications',
  'cta.editGroup': 'Edit the group',
  'cta.createGroup': 'Create a group',
  'cta.viewProfile': 'Go to your profile',
  'cta.adminPanel': 'Open the admin panel',
  'cta.browseGroups': 'Browse the catalog',

  'subject.applicationReceived': 'New application for "{groupTitle}"',
  'applicationReceived.preheader': '{applicantName} applied to your group.',
  'applicationReceived.body1': '{applicantName} applied to join your group "{groupTitle}".',
  'applicationReceived.body2': 'Review and process the application in the group management section.',

  'subject.applicationSubmitted': 'Application received — "{groupTitle}"',
  'applicationSubmitted.preheader': 'We received your application to "{groupTitle}".',
  'applicationSubmitted.body1':
    'Your application to join the group "{groupTitle}" has been received — the organizer can already see it in the group management section.',
  'applicationSubmitted.body2':
    'The organizer will review it and make a decision, which we will email you separately. Only the organizer of this group can read your questionnaire answers.',

  'subject.applicationApproved': 'Your application was approved — "{groupTitle}"',
  'applicationApproved.preheader': 'The organizer approved your application to "{groupTitle}".',
  'applicationApproved.body1':
    'The organizer approved your application to join the group "{groupTitle}".',
  'applicationApproved.body2':
    'The organizer will share the remaining participation details — keep an eye on the group page.',

  'subject.applicationRejected': 'Decision on your application — "{groupTitle}"',
  'applicationRejected.preheader': 'Your application to "{groupTitle}" was not approved.',
  'applicationRejected.body1':
    'Unfortunately, the organizer declined your application to join the group "{groupTitle}".',
  'applicationRejected.body2':
    'You can apply to other groups in the catalog — new places open regularly.',

  'subject.applicationWithdrawn': 'Application withdrawn — "{groupTitle}"',
  'applicationWithdrawn.preheader': '{applicantName} withdrew their application.',
  'applicationWithdrawn.body1':
    '{applicantName} withdrew their application to join the group "{groupTitle}".',
  'applicationWithdrawn.body2': 'No action needed: the place was released automatically.',

  'subject.groupPublished': 'Your group is published — "{groupTitle}"',
  'groupPublished.preheader': '"{groupTitle}" passed moderation and is visible to visitors.',
  'groupPublished.body1':
    'The group "{groupTitle}" passed moderation and is now available to catalog visitors.',
  'groupPublished.body2': 'We will email you as soon as someone applies.',

  'subject.groupRejected': 'Your group was not published — "{groupTitle}"',
  'groupRejected.preheader': 'A moderator rejected the group "{groupTitle}".',
  'groupRejected.body1': 'A moderator rejected your group "{groupTitle}".',
  'groupRejected.body2': 'Make the changes and submit the group for moderation again.',

  'subject.groupPendingReview': 'New group pending review — "{groupTitle}"',
  'groupPendingReview.preheader': 'The group "{groupTitle}" is waiting for review.',
  'groupPendingReview.body1': 'The group "{groupTitle}" was submitted for moderation.',
  'groupPendingReview.body2': 'Publish or reject it from the admin panel.',

  'subject.groupSubmitted': 'Your group is under review — "{groupTitle}"',
  'groupSubmitted.preheader': 'The group "{groupTitle}" awaits a moderator decision.',
  'groupSubmitted.body1': 'Your group "{groupTitle}" has been submitted for moderation.',
  'groupSubmitted.body2':
    'We will review it within 1–2 business days and email you the decision. The group stays out of the catalog while the review is in progress.',

  'subject.groupAutoRevert': 'Your group is back in review — "{groupTitle}"',
  'groupAutoRevert.preheader': 'The group "{groupTitle}" awaits review again after an edit.',
  'groupAutoRevert.body1':
    'Your group "{groupTitle}" was returned to moderation: details visible to visitors changed after it was published.',
  'groupAutoRevert.changedFields': 'Changed details: {fields}',
  'groupAutoRevert.body2':
    'Please wait for the review to finish — we will email you as soon as a moderator decides. Until then the group stays out of the catalog.',

  // Labels for the critical group fields named in `groupAutoRevert.changedFields`. Keyed by
  // the update-payload field name, not the database column, because that is what the
  // diff in `groupService` reports.
  'field.title': 'title',
  'field.description': 'description',
  'field.type': 'group type',
  'field.format': 'format',
  'field.location': 'location',
  'field.priceAmount': 'price',
  'field.currency': 'currency',
  'field.startDate': 'start date',
  'field.endDate': 'end date',
  'field.maxParticipants': 'number of places',

  'subject.organizerPendingReview': 'New profile pending verification — {organizerName}',
  'organizerPendingReview.preheader': 'The profile "{organizerName}" awaits verification.',
  'organizerPendingReview.body1':
    'The organizer "{organizerName}" registered and is waiting for verification.',
  'organizerPendingReview.body2': 'Approve or reject the profile from the admin panel.',

  'subject.organizerVerified': 'Your profile has been verified',
  'organizerVerified.preheader':
    'The profile "{organizerName}" is verified — you can now create groups.',
  'organizerVerified.body1': 'Your profile "{organizerName}" has been verified.',
  'organizerVerified.body2': 'You can now create and publish your own groups.',

  'subject.organizerRejected': 'Your profile was not verified',
  'organizerRejected.preheader': 'The profile "{organizerName}" was rejected.',
  'organizerRejected.body1': 'Unfortunately, your profile "{organizerName}" was not verified.',
  'organizerRejected.body2':
    'Update your profile details and submit it for review again — group creation unlocks once you are verified.',

  'subject.organizerWelcome': 'Welcome to PsyGroup — your profile is under review',
  'organizerWelcome.preheader': 'Your organizer profile was created and awaits verification.',
  'organizerWelcome.body1':
    'Thank you for registering! Your organizer profile has been created and is now awaiting verification.',
  'organizerWelcome.body2':
    'We will email you as soon as a moderator approves it — group creation unlocks once you are verified. In the meantime you can complete your profile: education, group facilitation experience and specializations.',
}
