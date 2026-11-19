import { describe, expect, it, vi } from "vitest";
import { focusCamera, scanPhoto } from "./scanner";

describe("optional camera focus", () => {
  it("requests continuous focus only if the camera supports it", async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    await focusCamera({
      getCapabilities: () => ({ focusMode: ["continuous"] }),
      applyConstraints,
    } as unknown as MediaStreamTrack);
    expect(applyConstraints).toHaveBeenCalledWith({
      advanced: [{ focusMode: "continuous" }],
    });
  });
  it("keeps fixed-focus webcams working without requesting focus", async () => {
    const applyConstraints = vi.fn();
    await focusCamera({
      getCapabilities: () => ({}),
      applyConstraints,
    } as unknown as MediaStreamTrack);
    expect(applyConstraints).not.toHaveBeenCalled();
  });
  it("does not fail scanning when an optional constraint is rejected", async () => {
    await expect(
      focusCamera({
        getCapabilities: () => ({ focusMode: ["continuous"] }),
        applyConstraints: vi.fn().mockRejectedValue(new Error("unsupported")),
      } as unknown as MediaStreamTrack),
    ).resolves.toBeUndefined();
  });
});

it("rejects non-images and oversized photos before allocating image resources", async () => {
  await expect(
    scanPhoto({ type: "text/plain", size: 100 } as File),
  ).rejects.toThrow("Choose a photo");
  await expect(
    scanPhoto({ type: "image/jpeg", size: 21 * 1024 * 1024 } as File),
  ).rejects.toThrow("20 MB");
});
