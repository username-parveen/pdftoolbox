import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThemePreference } from "./appearance";
import { useResolvedTheme } from "./useResolvedTheme";

function Harness({ preference, matchMedia }: { preference: ThemePreference; matchMedia: typeof window.matchMedia }) {
  return <output>{useResolvedTheme(preference, matchMedia)}</output>;
}

describe("useResolvedTheme", () => {
  it("subscribes only in system mode, updates live, and cleans up", () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const addEventListener = vi.fn((_type: string, next: (event: MediaQueryListEvent) => void) => { listener = next; });
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn(() => ({ matches: false, addEventListener, removeEventListener } as unknown as MediaQueryList));
    const { rerender, unmount } = render(<Harness preference="system" matchMedia={matchMedia} />);

    expect(screen.getByText("light")).toBeTruthy();
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    act(() => listener?.({ matches: true } as MediaQueryListEvent));
    expect(screen.getByText("dark")).toBeTruthy();

    rerender(<Harness preference="light" matchMedia={matchMedia} />);
    expect(screen.getByText("light")).toBeTruthy();
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
    const calls = matchMedia.mock.calls.length;
    rerender(<Harness preference="dark" matchMedia={matchMedia} />);
    expect(screen.getByText("dark")).toBeTruthy();
    expect(matchMedia).toHaveBeenCalledTimes(calls);
    unmount();
  });

  it("cleans the system listener on unmount", () => {
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener } as unknown as MediaQueryList));
    const { unmount } = render(<Harness preference="system" matchMedia={matchMedia} />);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
