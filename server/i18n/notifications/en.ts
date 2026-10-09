export default {
  'group.published': {
    subject: 'Your group has been published',
    body: 'Your group "{title}" has been published and is now available to visitors',
  },
  'group.rejected': {
    subject: 'Group rejected',
    body: 'Your group "{title}" has been rejected. Reason: {reason}',
  },
  'group.submitted': {
    subject: 'Group submitted for review',
    body: 'Your group "{title}" is awaiting a moderator decision',
  },
  'group.autoRevert': {
    subject: 'Group returned to review',
    body: 'Your group "{title}" is back in review: details visible to visitors changed after it was published',
  },
  'group.completedOwner': {
    subject: 'Group completed',
    body: 'Your group "{title}" has been marked as completed — it stays in the catalog as an archive',
  },
  'group.completedApplicant': {
    subject: 'Group completed',
    body: 'The group "{groupTitle}", which approved your application, has ended — thank you for taking part',
  },
  'group.cancelledOwner': {
    subject: 'Group cancelled',
    body: 'Your group "{title}" has been cancelled — approved applicants have been notified',
  },
  'group.cancelledApplicant': {
    subject: 'Group cancelled',
    body: 'The group "{groupTitle}", which approved your application, has been cancelled',
  },
  'application.new': {
    subject: 'New application',
    body: '{applicantName} has applied to your group "{groupTitle}"',
  },
  'application.submitted': {
    subject: 'Application received',
    body: 'Your application to group "{groupTitle}" has been received — the organizer will review it shortly',
  },
  'application.approved': {
    subject: 'Your application has been approved',
    body: 'Your application to group "{groupTitle}" has been approved.',
  },
  'application.rejected': {
    subject: 'Your application has been rejected',
    body: 'Your application to group "{groupTitle}" has been rejected.',
  },
  'application.withdrawn': {
    subject: 'Application withdrawn',
    body: '{applicantName} withdrew their application to group "{groupTitle}"',
  },
  'organizer.welcome': {
    subject: 'Organizer profile created',
    body: 'Your profile is awaiting verification — we will let you know as soon as a moderator approves it',
  },
  'organizer.verified': {
    subject: 'Profile verified',
    body: 'Your profile "{name}" has been verified',
  },
  'organizer.rejected': {
    subject: 'Profile rejected',
    body: 'Your profile "{name}" has been rejected. Reason: {reason}',
  },
  'admin.group.pending': {
    subject: 'New group pending review',
    body: '{title}',
  },
  'admin.organizer.pending': {
    subject: 'New profile pending verification',
    body: '{name}',
  },
}
