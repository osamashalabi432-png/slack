import { SignJWT } from "jose";

const E2E_TEST_SECRET = "openslaq-e2e-test-secret-do-not-use-in-prod";
const PROJECT_ID = "aefaf8ec-05a0-441f-ac7b-ef4a83a346b4";
const STACK_AUTH_BASE = `https://api.stack-auth.com/api/v1/projects/${PROJECT_ID}`;
const ISSUER = `${STACK_AUTH_BASE}`;
const BASE_URL = process.env.API_URL ?? "http://localhost:3001";

interface TestUser {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
}

const defaultUser: TestUser = {
  id: "mobile-e2e-user-001",
  displayName: "Mobile E2E User",
  email: "mobile-e2e@openslaq.dev",
  emailVerified: true,
};

function testId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function signTestJwt(
  user: TestUser = defaultUser,
): Promise<string> {
  const secret = new TextEncoder().encode(E2E_TEST_SECRET);
  return new SignJWT({
    email: user.email,
    name: user.displayName,
    email_verified: user.emailVerified,
    project_id: PROJECT_ID,
    branch_id: "main",
    refresh_token_id: `rt-${user.id}`,
    role: "authenticated",
    selected_team_id: null,
    is_anonymous: false,
    is_restricted: false,
    restricted_reason: null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

export async function createTestWorkspace(
  token: string,
): Promise<{ id: string; name: string; slug: string }> {
  const name = `Test Workspace ${testId()}`;
  const res = await fetch(`${BASE_URL}/api/workspaces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (res.status !== 201) {
    throw new Error(`Failed to create workspace: ${res.status}`);
  }

  return res.json();
}

export async function deleteTestWorkspace(
  token: string,
  slug: string,
): Promise<void> {
  await fetch(`${BASE_URL}/api/workspaces/${slug}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getWorkspaceChannels(
  token: string,
  slug: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${slug}/channels`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to get channels: ${res.status}`);
  return res.json();
}

export async function sendTestMessage(
  token: string,
  slug: string,
  channelId: string,
  content: string,
): Promise<{ id: string; content: string }> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${slug}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    },
  );
  if (res.status !== 201) throw new Error(`Failed to send message: ${res.status}`);
  return res.json();
}

export async function sendTestReply(
  token: string,
  slug: string,
  channelId: string,
  parentMessageId: string,
  content: string,
): Promise<{ id: string; content: string }> {
  const res = await fetch(
    `${BASE_URL}/api/workspaces/${slug}/channels/${channelId}/messages/${parentMessageId}/replies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    },
  );
  if (res.status !== 201) throw new Error(`Failed to send reply: ${res.status}`);
  return res.json();
}

export async function editTestMessage(
  token: string,
  messageId: string,
  content: string,
): Promise<{ id: string; content: string }> {
  const res = await fetch(`${BASE_URL}/api/messages/${messageId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Failed to edit message: ${res.status}`);
  return res.json();
}

export async function deleteTestMessage(
  token: string,
  messageId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/messages/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to delete message: ${res.status}`);
}

export async function toggleTestReaction(
  token: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/messages/${messageId}/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw new Error(`Failed to toggle reaction: ${res.status}`);
}

export async function createTestChannel(
  token: string,
  slug: string,
  name: string,
  type: "public" | "private" = "public",
  description?: string,
): Promise<{ id: string; name: string; type: string }> {
  const body: Record<string, string> = { name, type };
  if (description) body.description = description;
  const res = await fetch(`${BASE_URL}/api/workspaces/${slug}/channels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status !== 201) throw new Error(`Failed to create channel: ${res.status}`);
  return res.json();
}

export async function browseTestChannels(
  token: string,
  slug: string,
): Promise<Array<{ id: string; name: string; isMember: boolean }>> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${slug}/channels/browse`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to browse channels: ${res.status}`);
  return res.json();
}

export async function joinTestChannel(
  token: string,
  slug: string,
  channelId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${slug}/channels/${channelId}/join`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to join channel: ${res.status}`);
}

export async function leaveTestChannel(
  token: string,
  slug: string,
  channelId: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${slug}/channels/${channelId}/leave`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to leave channel: ${res.status}`);
}

const secondUser: TestUser = {
  id: "mobile-e2e-user-002",
  displayName: "Second E2E User",
  email: "mobile-e2e-002@openslaq.dev",
  emailVerified: true,
};

/** Add a user to a workspace via the invite flow */
export async function addToWorkspace(
  ownerToken: string,
  slug: string,
  joinerToken: string,
): Promise<void> {
  const inviteRes = await fetch(`${BASE_URL}/api/workspaces/${slug}/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({}),
  });
  if (inviteRes.status !== 201) {
    throw new Error(`Failed to create invite: ${inviteRes.status}`);
  }
  const { code } = (await inviteRes.json()) as { code: string };

  const acceptRes = await fetch(`${BASE_URL}/api/invites/${code}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${joinerToken}` },
  });
  if (acceptRes.status !== 200) {
    throw new Error(`Failed to accept invite: ${acceptRes.status}`);
  }
}

/** Create a DM conversation via the API */
export async function createTestDm(
  token: string,
  slug: string,
  targetUserId: string,
): Promise<{ channel: { id: string } }> {
  const res = await fetch(`${BASE_URL}/api/workspaces/${slug}/dm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId: targetUserId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create DM: ${res.status}`);
  }
  return res.json();
}

export { defaultUser, secondUser, type TestUser };
