export default {
  'group.published': {
    subject: 'Your group has been published',
    body: 'Your group "{title}" has been published and is now available to visitors',
  },
  'group.rejected': {
    subject: 'Group rejected',
    body: 'Your group "{title}" has been rejected. Reason: {reason}',
  },
  'application.new': {
    subject: 'New application',
    body: '{applicantName} has applied to your group "{groupTitle}"',
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
