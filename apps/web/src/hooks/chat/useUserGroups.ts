import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchUserGroups,
  fetchGroupSections,
  fetchUserGroup,
  createUserGroup,
  updateUserGroup,
  deleteUserGroup,
  addUserGroupMembers,
  removeUserGroupMember,
  addUserGroupChannels,
  removeUserGroupChannel,
} from "@openslaq/client-core";
import type { SidebarGroupSection, UserGroup, UserGroupDetail } from "@openslaq/shared";
import { api } from "../../api";
import { useAuthProvider } from "../../lib/api-client";

export interface UserGroupActions {
  groups: UserGroup[];
  sections: SidebarGroupSection[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  getGroup: (groupId: string) => Promise<UserGroupDetail>;
  create: (input: {
    name: string;
    handle: string;
    purpose?: string | null;
    showAsSection?: boolean;
    channelIds?: string[];
    memberIds?: string[];
  }) => Promise<UserGroup>;
  update: (
    groupId: string,
    input: { name?: string; handle?: string; purpose?: string | null; showAsSection?: boolean },
  ) => Promise<UserGroupDetail>;
  remove: (groupId: string) => Promise<void>;
  addMembers: (groupId: string, userIds: string[]) => Promise<UserGroupDetail>;
  removeMember: (groupId: string, userId: string) => Promise<UserGroupDetail>;
  addChannels: (groupId: string, channelIds: string[]) => Promise<UserGroupDetail>;
  removeChannel: (groupId: string, channelId: string) => Promise<UserGroupDetail>;
}

/**
 * Groups double as access rules, so every change reloads the list: adding a
 * channel or a person changes what other people can see, and a stale count on
 * screen would misrepresent that.
 */
export function useUserGroups(workspaceSlug: string): UserGroupActions {
  const auth = useAuthProvider();
  const deps = useMemo(() => ({ api, auth }), [auth]);

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [sections, setSections] = useState<SidebarGroupSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspaceSlug) return;
    try {
      setError(null);
      const [list, sectionList] = await Promise.all([
        fetchUserGroups(deps, { workspaceSlug }),
        fetchGroupSections(deps, { workspaceSlug }),
      ]);
      setGroups(list);
      setSections(sectionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load user groups");
    } finally {
      setLoading(false);
    }
  }, [deps, workspaceSlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const getGroup = useCallback(
    (groupId: string) => fetchUserGroup(deps, { workspaceSlug, groupId }),
    [deps, workspaceSlug],
  );

  const create = useCallback<UserGroupActions["create"]>(
    async (input) => {
      const group = await createUserGroup(deps, { workspaceSlug, ...input });
      await reload();
      return group;
    },
    [deps, workspaceSlug, reload],
  );

  const update = useCallback<UserGroupActions["update"]>(
    async (groupId, input) => {
      const detail = await updateUserGroup(deps, { workspaceSlug, groupId, ...input });
      await reload();
      return detail;
    },
    [deps, workspaceSlug, reload],
  );

  const remove = useCallback(
    async (groupId: string) => {
      await deleteUserGroup(deps, { workspaceSlug, groupId });
      await reload();
    },
    [deps, workspaceSlug, reload],
  );

  const addMembers = useCallback(
    async (groupId: string, userIds: string[]) => {
      const detail = await addUserGroupMembers(deps, { workspaceSlug, groupId, userIds });
      await reload();
      return detail;
    },
    [deps, workspaceSlug, reload],
  );

  const removeMember = useCallback(
    async (groupId: string, userId: string) => {
      const detail = await removeUserGroupMember(deps, { workspaceSlug, groupId, userId });
      await reload();
      return detail;
    },
    [deps, workspaceSlug, reload],
  );

  const addChannels = useCallback(
    async (groupId: string, channelIds: string[]) => {
      const detail = await addUserGroupChannels(deps, { workspaceSlug, groupId, channelIds });
      await reload();
      return detail;
    },
    [deps, workspaceSlug, reload],
  );

  const removeChannel = useCallback(
    async (groupId: string, channelId: string) => {
      const detail = await removeUserGroupChannel(deps, { workspaceSlug, groupId, channelId });
      await reload();
      return detail;
    },
    [deps, workspaceSlug, reload],
  );

  return {
    groups,
    sections,
    loading,
    error,
    reload,
    getGroup,
    create,
    update,
    remove,
    addMembers,
    removeMember,
    addChannels,
    removeChannel,
  };
}
