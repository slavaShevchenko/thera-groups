# Permissions System

## Overview

Permissions are defined in `shared/utils/permissions.ts` as a const object with type-safe keys.

```typescript
import { can } from '~~/shared/utils/permissions'

if (!can('group.edit', user, resource)) {
  throw new ForbiddenError()
}
```

The server provides a convenience wrapper in `server/utils/permissions.ts`:

```typescript
import { requirePermission } from '~~/server/utils/permissions'

requirePermission(user, 'group.edit', group)
// Throws 403 if permission denied
```

## Permission Keys

### Admin

| Key | Description | Who |
|-----|-------------|-----|
| `admin.panel` | Access admin panel | ADMIN |
| `admin.groups.view` | List all groups | ADMIN |
| `admin.groups.moderate` | Moderate groups | ADMIN |
| `admin.profiles.view` | List profiles pending verification | ADMIN |
| `admin.profiles.moderate` | Verify/reject organizer profiles | ADMIN |
| `admin.applications.view` | View all applications | ADMIN |
| `admin.users.view` | View all users | ADMIN |
| `admin.organizers.view` | View all organizers | ADMIN |
| `admin.organizers.moderate` | Activate/deactivate an organizer | ADMIN |

Every `*.view` key guards a read; every `*.moderate` key guards a write. Deactivation is
destructive — it locks an organizer out of everything they own — so it must not be reachable
with the permission that merely lists them.

### Groups

| Key | Description | Who |
|-----|-------------|-----|
| `group.view` | View group details | Anyone (PUBLISHED), ADMIN, owner, co-organizer |
| `group.create` | Create new group | ADMIN, or ORGANIZER with VERIFIED status |
| `group.edit` | Edit group | ADMIN, owner, or co-organizer |
| `group.delete` | Delete group | ADMIN or owner (not co-organizer) |
| `group.publish` | Publish group | ADMIN only |
| `group.moderate` | Moderate group | ADMIN only |
| `group.viewMyList` | View own groups list | ORGANIZER or ADMIN |

### Applications

| Key | Description | Who |
|-----|-------------|-----|
| `application.create` | Submit application | Anyone (public) |
| `application.viewOwn` | View own applications | Any authenticated user |
| `application.viewForGroup` | View applications for a group | ADMIN, owner, or co-organizer |
| `application.manage` | Approve/reject applications | ADMIN or group owner |

### Favorites

| Key | Description | Who |
|-----|-------------|-----|
| `favorite.manage` | Add/remove favorites | Any authenticated user |

### User

| Key | Description | Who |
|-----|-------------|-----|
| `user.profile.view` | View user profile | Any authenticated user |

### Organizer Profile

| Key | Description | Who |
|-----|-------------|-----|
| `organizer.profile.view` | View organizer profile | Anyone (if VERIFIED), ADMIN, or owner |
| `organizer.profile.edit` | Edit organizer profile | ORGANIZER or ADMIN |
| `organizer.profile.moderate` | Moderate profile | ADMIN only |

### Notifications

| Key | Description | Who |
|-----|-------------|-----|
| `notification.manage` | View/manage notifications | Any authenticated user |

## Resource-Based Checks

### isOwner

Checks if `resource.organizerUserId` (or `resource.organizer.userId`) matches `user.id`.

### isOwnerOrCoOrganizer

Checks isOwner first, then checks if `user.id` is in `resource.coOrganizerUserIds` (or `resource.coOrganizers[].userId`).

## Usage in API Handlers

```typescript
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const group = await groupRepository.findBySlugForUpdate(slug)

  requirePermission(user, 'group.edit', {
    organizerUserId: group.organizer.userId,
    coOrganizerUserIds: group.coOrganizers.map(c => c.userId),
  })

  // ... proceed with update
})
```

## Type Safety

The `Permission` type is derived from the keys of the `permissions` object:

```typescript
export type Permission = keyof typeof permissions
```

The `as const satisfies Record<string, PermissionCheck>` pattern ensures:
1. All values are valid `PermissionCheck` functions
2. Keys are inferred as literal types
3. Adding a new permission is a single-step process
