import { authorizedRequest } from "../api/api-client";
import type { SidebarGroupSection, UserGroup, UserGroupDetail } from "@openslaq/shared";
import type { OperationDeps } from "./types";

type Deps = Pick<OperationDeps, "api" | "auth">;

export async function fetchUserGroups(
  deps: Deps,
  params: { workspaceSlug: string },
): Promise<UserGroup[]> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups.$get(
      { param: { slug: params.workspaceSlug } },
      { headers },
    ),
  );
  return (await res.json()) as UserGroup[];
}

export async function fetchUserGroup(
  deps: Deps,
  params: { workspaceSlug: string; groupId: string },
): Promise<UserGroupDetail> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups[":groupId"].$get(
      { param: { slug: params.workspaceSlug, groupId: params.groupId } },
      { headers },
    ),
  );
  return (await res.json()) as UserGroupDetail;
}

/** Groups the caller belongs to that want their own sidebar heading. */
export async function fetchGroupSections(
  deps: Deps,
  params: { workspaceSlug: string },
): Promise<SidebarGroupSection[]> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups.sections.$get(
      { param: { slug: params.workspaceSlug } },
      { headers },
    ),
  );
  return (await res.json()) as SidebarGroupSection[];
}

export async function createUserGroup(
  deps: Deps,
  params: {
    workspaceSlug: string;
    name: string;
    handle: string;
    purpose?: string | null;
    showAsSection?: boolean;
    channelIds?: string[];
    memberIds?: string[];
  },
): Promise<UserGroup> {
  const { workspaceSlug, ...body } = params;
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups.$post(
      { param: { slug: workspaceSlug }, json: body },
      { headers },
    ),
  );
  return (await res.json()) as UserGroup;
}

export async function updateUserGroup(
  deps: Deps,
  params: {
    workspaceSlug: string;
    groupId: string;
    name?: string;
    handle?: string;
    purpose?: string | null;
    showAsSection?: boolean;
  },
): Promise<UserGroupDetail> {
  const { workspaceSlug, groupId, ...body } = params;
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups[":groupId"].$patch(
      { param: { slug: workspaceSlug, groupId }, json: body },
      { headers },
    ),
  );
  return (await res.json()) as UserGroupDetail;
}

export async function deleteUserGroup(
  deps: Deps,
  params: { workspaceSlug: string; groupId: string },
): Promise<void> {
  await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups[":groupId"].$delete(
      { param: { slug: params.workspaceSlug, groupId: params.groupId } },
      { headers },
    ),
  );
}

export async function addUserGroupMembers(
  deps: Deps,
  params: { workspaceSlug: string; groupId: string; userIds: string[] },
): Promise<UserGroupDetail> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups[":groupId"].members.$post(
      {
        param: { slug: params.workspaceSlug, groupId: params.groupId },
        json: { userIds: params.userIds },
      },
      { headers },
    ),
  );
  return (await res.json()) as UserGroupDetail;
}

export async function removeUserGroupMember(
  deps: Deps,
  params: { workspaceSlug: string; groupId: string; userId: string },
): Promise<UserGroupDetail> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups[":groupId"].members[":userId"].$delete(
      { param: { slug: params.workspaceSlug, groupId: params.groupId, userId: params.userId } },
      { headers },
    ),
  );
  return (await res.json()) as UserGroupDetail;
}

export async function addUserGroupChannels(
  deps: Deps,
  params: { workspaceSlug: string; groupId: string; channelIds: string[] },
): Promise<UserGroupDetail> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups[":groupId"].channels.$post(
      {
        param: { slug: params.workspaceSlug, groupId: params.groupId },
        json: { channelIds: params.channelIds },
      },
      { headers },
    ),
  );
  return (await res.json()) as UserGroupDetail;
}

export async function removeUserGroupChannel(
  deps: Deps,
  params: { workspaceSlug: string; groupId: string; channelId: string },
): Promise<UserGroupDetail> {
  const res = await authorizedRequest(deps.auth, (headers) =>
    deps.api.api.workspaces[":slug"].groups[":groupId"].channels[":channelId"].$delete(
      {
        param: {
          slug: params.workspaceSlug,
          groupId: params.groupId,
          channelId: params.channelId,
        },
      },
      { headers },
    ),
  );
  return (await res.json()) as UserGroupDetail;
}
