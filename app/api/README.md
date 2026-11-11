# Wrold API specification
A guide to the Spaceship REST endpoints used by the web app.

## Global behavior
- Authentication is session-based. The app expects a cookie named `session`.
- Every request is sent as JSON unless the endpoint explicitly returns a redirect.
- On failure, the API responds with an object shaped like `{ "error": "..." }` and a matching HTTP status code.
- The implementation also uses redirects for sign-up and GitHub installation flows.

## 1. Authentication

### `POST /api/auth/create_user`
Creates a new account.

Request body:
```json
{
  "username": "alice",
  "password": "secret123"
}
```

Validation:
- `username` and `password` must be strings.
- Length must be between 6 and 25 characters.
- The username must be unique.
- The client IP must not already be used by another account.

Success:
- Creates the user entry.
- Stores a new session and sets the `session` cookie.
- Redirects to the GitHub app installation URL.

Possible errors:
- `400 Bad Request` for malformed input.
- `401 Unauthorized` for duplicate IP/username.
- `500 Internal Server Error` for unexpected database failures.

### `POST /api/auth/check_auth`
Logs an existing user in.

Request body:
```json
{
  "user": "alice",
  "password": "secret123"
}
```

Behavior:
- Looks up the account by `pseudo`.
- Verifies the Argon2 password hash.
- Reuses the existing session when valid, otherwise creates a new one.
- Persists the session and stores the hashed session value in the cookie.

Success response:
```json
{
  "id": 1,
  "pseudo": "alice",
  "password": "<argon2 hash>",
  "ip": "127.0.0.1",
  "githubAppId": null,
  "githubAccount": null,
  "sessionKey": "...",
  "sessionKeyCreation": 1730000000000,
  "projects": [1, 2],
  "accountCreation": 1730000000000
}
```

Possible errors:
- `404 Not Found` if the user does not exist.
- `401 Unauthorized` if the password is wrong.
- `400 Bad Request` for invalid input.

### `DELETE /api/auth/delete_session`
Invalidates or rotates the active session.

Request body:
```json
{
  "recreate": true
}
```

Behavior:
- Requires a valid session.
- If `recreate` is `true`, a new session key is generated.
- If `recreate` is `false`, the session is cleared.
- The `session` cookie is replaced with a hashed value corresponding to the new session.

Success response:
```json
{
  "ok": true
}
```

Possible errors:
- `401 Unauthorized` if the current session is invalid.
- `500 Internal Server Error` on database issues.

## 2. GitHub integration

### `GET /api/github/install_app?installation_id=<id>`
Finalizes the GitHub app connection after the user installs the Spaceship GitHub App.

Query params:
- `installation_id`: GitHub installation ID.

Behavior:
- Validates the current session.
- Fetches the currently authenticated GitHub user from the installation app.
- Confirms that the installation belongs to the same user.
- Stores `githubAppId` and `githubAccount` on the current user.

Success:
- Redirects to `/dashboard` with HTTP 200/redirect semantics.

Possible errors:
- `401 Unauthorized` for invalid session.
- `403 Forbidden` if the installation does not belong to the user.
- `500 Internal Server Error` for unexpected failures.

### `GET /api/github/get_repos`
Returns the repositories available to the authenticated GitHub installation.

Behavior:
- Requires an active session.
- Requires a linked GitHub App (`userData.githubAppId`).
- Lists repositories for the authenticated GitHub user.

Success response:
```json
{
  "repos": [
    "octocat/hello-world",
    "acme/translations"
  ]
}
```

Possible errors:
- `401 Unauthorized` if no GitHub account is linked or session is invalid.
- `500 Internal Server Error` if the GitHub API fails.

### `GET /api/github/content`
Fetches a source or target translation resource for a project.

Request body:
```json
{
  "project": 12,
  "path": "locales/en.json",
  "locale": "fr"
}
```

Behavior:
- Validates project existence and permissions.
- Verifies the project has a translation branch configured.
- Reads the source content and optionally the target locale file.
- Returns JSON content for the requested resource.

Success response:
```json
{
  "readonly": false,
  "source": { "hello": "world" },
  "target": { "hello": "bonjour" }
}
```

Possible errors:
- `400 Bad Request` for invalid project/path.
- `404 Not Found` if the translation file or branch is missing.
- `403 Forbidden` if the user lacks project access.

## 3. User data

### `GET /api/user_data`
Returns the current authenticated user payload.

Success response:
```json
{
  "id": 1,
  "pseudo": "alice",
  "projects": [1, 2],
  "githubAppId": 123,
  "githubAccount": "alice"
}
```

### `PATCH /api/user_data`
Updates editable account properties.

Request body example:
```json
{
  "pseudo": "new_name",
  "oldPassword": "old-secret",
  "newPassword": "new-secret",
  "ghAPI": 456
}
```

Rules:
- `oldPassword` and `newPassword` must be provided together.
- If `oldPassword` is supplied, the current password must match.
- `pseudo` is updated if provided.
- `ghAPI` is treated as the GitHub app installation ID.

Success response:
```json
{
  "pseudo": "new_name"
}
```

### `PUT /api/user_data`
Adds a project to the current logged-in user.

Request body:
```json
{
  "project": 7
}
```

Behavior:
- Requires a valid session.
- Appends the project ID to the user's `projects` array.

### `DELETE /api/user_data`
Deletes the user or removes a project membership.

Request body examples:

Delete account:
```json
{
  "password": "secret123"
}
```

Remove project membership:
```json
{
  "project": 7
}
```

Behavior:
- If `password` is present, the account is deleted after password verification.
- If `project` is present, the project is removed from the user's `projects` list.

## 4. Projects

### `POST /api/projects`
Fetches a project by ID.

Request body:
```json
{
  "id": 12
}
```

Success response:
```json
{
  "id": 12,
  "name": "Website",
  "description": null,
  "targetOwner": "acme",
  "targetRepo": "website",
  "owner": 1,
  "admins": [1],
  "contributors": [2, 3],
  "isPublic": true,
  "defaultLanguage": "en",
  "translationBranch": "translations",
  "translationNames": ["home.json"],
  "translationSources": ["locales/en.json"],
  "translationTargets": ["locales/fr.json"],
  "projectCreation": 1730000000000
}
```

### `PUT /api/projects`
Creates a project.

Request body:
```json
{
  "name": "Website",
  "targetOwner": "acme",
  "targetRepo": "website",
  "isPublic": true,
  "defaultLanguage": "en"
}
```

Rules:
- `name` cannot be `"new"`.
- The authenticated user must own the GitHub account named in `targetOwner`.
- A user may create up to 10 projects.
- Project names must be unique.

Success response:
```json
{
  "ok": true
}
```

### `PATCH /api/projects`
Updates a project.

Request body examples:
```json
{
  "id": 12,
  "name": "Website V2",
  "defaultLanguage": "fr",
  "translationBranch": "translations"
}
```

Behavior:
- Requires admin-level permission.
- Supports updates to project metadata and translation branch configuration.
- If a translation branch is changed, the GitHub branch is created if needed.

### `DELETE /api/projects`
Deletes a project or removes a user from a project.

Delete project (owner only):
```json
{
  "id": 12,
  "password": "secret123"
}
```

Remove a member:
```json
{
  "id": 12,
  "user": 4
}
```

Behavior:
- Owners can delete the project after password verification.
- Admins and owners may remove members from the project.

## 5. Invite tokens

Invite tokens are project-scoped membership links.

### `POST /api/invite_tokens`
Redeems an invite token.

Request body:
```json
{
  "token": "project-invite-abc123"
}
```

Behavior:
- Validates the token exists and is still valid.
- Adds the user as contributor or admin for the linked project.
- Decrements `leftUses` on the token.
- Adds the project to the user's project list.

Success response:
```json
{
  "project": "Website"
}
```

### `PUT /api/invite_tokens`
Creates a new invite token.

Request body:
```json
{
  "name": "invite-2025",
  "linksTo": 12,
  "admin": false,
  "expireDate": 1730000000000,
  "leftUses": 5
}
```

Rules:
- A project may not have more than 5 active invite tokens.
- The caller must have permissions on the project.

### `PATCH /api/invite_tokens`
Updates an invite token.

Request body:
```json
{
  "id": 4,
  "project": 12,
  "name": "invite-2026",
  "leftUses": 3
}
```

Behavior:
- Restricts the update to a token belonging to the specified project.
- Only project admins/owners may change token data.

### `DELETE /api/invite_tokens`
Deletes an invite token.

Request body:
```json
{
  "id": 4,
  "project": 12
}
```

## 6. Common response patterns

The API uses a small number of standard response patterns:

- Success: usually `200 OK` or `302 Found` for redirects.
- Validation failure: `400 Bad Request`.
- Auth failure: `401 Unauthorized` or `403 Forbidden`.
- Missing resource: `404 Not Found`.
- Database or unexpected runtime error: `500 Internal Server Error`.

If the server encounters an unexpected exception, it usually aborts the request and returns:
```json
{ "error": "..." }
```

## 7. Notes for clients
- Always include the `session` cookie if you are already logged in.
- For mutation endpoints, use the correct HTTP method: `POST`, `PUT`, `PATCH`, or `DELETE`.
- The client is expected to handle redirects when creating a user or linking GitHub.
- Most project and user details are returned as full database rows or partial row objects, not strict DTOs.
