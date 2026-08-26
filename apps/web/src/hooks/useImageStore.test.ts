import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "../test-utils";

vi.mock("../lib/api-client", () => ({
  useAuthProvider: () => ({ requireAccessToken: async () => "tok-abc" }),
}));

const galleryMode = { on: false };
vi.mock("../gallery/gallery-context", () => ({
  useGalleryMode: () => galleryMode.on,
}));

const { useImageStore } = await import("./useImageStore");

const file = new File(["x"], "shot.png", { type: "image/png" });

beforeEach(() => {
  galleryMode.on = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useImageStore.upload", () => {
  test("sends the file against its page, and reports where it went", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ attachments: [{ id: "att-1", downloadUrl: "https://cdn/x.png" }] }),
          { status: 201 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useImageStore());
    await expect(result.current.upload(file, "page-7")).resolves.toEqual({
      attachmentId: "att-1",
      url: "https://cdn/x.png",
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/uploads");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-abc");
    const body = init.body as FormData;
    expect(body.get("files")).toBe(file);
    // Without this the image would only ever load for whoever pasted it.
    expect(body.get("pageId")).toBe("page-7");
  });

  test("surfaces the server's reason when the upload is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "File too large" }), { status: 413 })),
    );

    const { result } = renderHook(() => useImageStore());
    await expect(result.current.upload(file, "page-7")).rejects.toThrow("File too large");
  });

  test("keeps the image local in gallery mode, where there is no backend", async () => {
    galleryMode.on = true;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:local" });

    const { result } = renderHook(() => useImageStore());
    await expect(result.current.upload(file, "page-7")).resolves.toEqual({
      attachmentId: null,
      url: "blob:local",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useImageStore.resolve", () => {
  test("asks for a freshly signed URL, because stored ones expire", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ downloadUrl: "https://cdn/fresh.png" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useImageStore());
    await expect(result.current.resolve("att-1")).resolves.toBe("https://cdn/fresh.png");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("/api/uploads/att-1/url");
  });

  test("gives nothing back for an image that is gone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const { result } = renderHook(() => useImageStore());
    await expect(result.current.resolve("att-gone")).resolves.toBeNull();
  });
});
