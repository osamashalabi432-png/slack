import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "../../test-utils";
import { fireEvent, waitFor } from "@testing-library/react";

const members = [
  { id: "u1", displayName: "Ada Lovelace", email: "ada@example.com", avatarUrl: null, role: "admin" },
  { id: "u2", displayName: "Grace Hopper", email: "grace@example.com", avatarUrl: null, role: "member" },
];

const channels = [
  { id: "c1", name: "general", type: "public", memberCount: 2, isMember: true, description: null },
  { id: "c2", name: "marketing", type: "private", memberCount: 1, isMember: false, description: "campaigns" },
];

const groups = [
  {
    id: "g1",
    workspaceId: "w1",
    name: "Marketing Team",
    handle: "marketing-team",
    purpose: "this is for marketing purposes",
    showAsSection: true,
    memberCount: 1,
    channelCount: 1,
    isMember: false,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

vi.mock("@openslaq/client-core", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    listWorkspaceMembers: () => Promise.resolve(members),
    browseChannels: () => Promise.resolve(channels),
    fetchUserGroups: () => Promise.resolve(groups),
    fetchGroupSections: () => Promise.resolve([]),
  };
});

vi.mock("../../lib/api-client", () => ({
  useAuthProvider: () => ({ requireAccessToken: async () => "tok" }),
  authorizedRequest: async () => new Response("{}"),
}));

vi.mock("../../api", () => ({ api: {} }));

// Not under test here, and it reaches for the auth provider on mount.
vi.mock("../channel/CreateChannelDialog", () => ({
  CreateChannelDialog: () => null,
}));
vi.mock("./CreateUserGroupDialog", () => ({ CreateUserGroupDialog: () => null }));
vi.mock("./UserGroupDetailDialog", () => ({ UserGroupDetailDialog: () => null }));

import { DirectoryView } from "./DirectoryView";
import type { UserGroupActions } from "../../hooks/chat/useUserGroups";

const noop = () => Promise.reject(new Error("not used in this test"));
const groupActions = {
  groups,
  sections: [],
  loading: false,
  error: null,
  reload: () => Promise.resolve(),
  getGroup: noop,
  create: noop,
  update: noop,
  remove: () => Promise.resolve(),
  addMembers: noop,
  removeMember: noop,
  addChannels: noop,
  removeChannel: noop,
} as unknown as UserGroupActions;

function renderDirectory(canManage = true) {
  return render(
    <DirectoryView
      workspaceSlug="acme"
      canManage={canManage}
      currentUserId="u1"
      presence={{}}
      groupActions={groupActions}
      onOpenInvite={() => {}}
      onOpenDm={() => {}}
      onSelectChannel={() => {}}
    />,
  );
}

describe("DirectoryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  test("opens on People and lists the workspace", async () => {
    renderDirectory();
    expect(await screen.findByTestId("directory-person-u1")).toBeTruthy();
    expect(screen.getByTestId("directory-person-u2")).toBeTruthy();
  });

  test("searching filters the people down", async () => {
    renderDirectory();
    await screen.findByTestId("directory-person-u1");

    fireEvent.change(screen.getByTestId("directory-search"), { target: { value: "grace" } });

    expect(screen.queryByTestId("directory-person-u1")).toBeNull();
    expect(screen.getByTestId("directory-person-u2")).toBeTruthy();
  });

  test("the Channels tab shows joined state and member counts", async () => {
    renderDirectory();
    fireEvent.click(screen.getByTestId("directory-tab-channels"));

    expect(await screen.findByTestId("directory-channel-c1")).toBeTruthy();
    expect(screen.getByTestId("directory-channel-c1").textContent).toContain("Joined");
    expect(screen.getByTestId("directory-channel-c2").textContent).toContain("1 member");
  });

  test("the User Groups tab shows the handle, counts and purpose", async () => {
    renderDirectory();
    fireEvent.click(screen.getByTestId("directory-tab-groups"));

    const row = await screen.findByTestId("directory-group-g1");
    expect(row.textContent).toContain("Marketing Team");
    expect(row.textContent).toContain("@marketing-team");
    expect(row.textContent).toContain("1 member");
    expect(row.textContent).toContain("1 channel");
    expect(row.textContent).toContain("this is for marketing purposes");
  });

  test("only admins are offered the create-group button", async () => {
    const { unmount } = renderDirectory(true);
    fireEvent.click(screen.getByTestId("directory-tab-groups"));
    await waitFor(() =>
      expect(screen.getByTestId("directory-action").textContent).toContain("Create user group"),
    );
    unmount();

    renderDirectory(false);
    fireEvent.click(screen.getByTestId("directory-tab-groups"));
    await waitFor(() => expect(screen.queryByTestId("directory-action")).toBeNull());
  });

  test("each tab offers its own action", async () => {
    renderDirectory();
    expect(screen.getByTestId("directory-action").textContent).toContain("Invite People");

    fireEvent.click(screen.getByTestId("directory-tab-channels"));
    await waitFor(() =>
      expect(screen.getByTestId("directory-action").textContent).toContain("Create Channel"),
    );
  });
});
