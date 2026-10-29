import { z } from 'zod'

export const applySchema = z.object({
  name: z.string().min(2).max(100),
  // `[groupId, email]` is what stops one person applying twice, and it is a byte-for-byte
  // unique index: without the normalization `Ivan@x.com` and `ivan@x.com` were two
  // applicants, and a guest who registered afterwards could not find their own application.
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().regex(/^\+?[\d\s()-]{7,20}$/).optional(),
  message: z.string().max(2000).optional(),
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.string().max(2000),
  })).default([]),
})

export const applicationStatusSchema = z.object({
  // PENDING is the revert target, not a fourth decision: `applicationService.updateStatus`
  // accepts it only from REJECTED, so an organizer can undo a rejection instead of leaving
  // a wrong decision standing.
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
  // Required when rejecting, enforced by the service rather than here so the rule lives in
  // one place — the same split `admin/organizer-profiles/[id].patch.ts` and
  // `organizerService.moderateProfile` use.
  rejectionReason: z.string().trim().max(1000).optional(),
})
