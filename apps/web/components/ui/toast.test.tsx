import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToastShortcuts } from "./toast";

function FireOnMount({ tone }: { tone: "success" | "info" | "error" }) {
  const toast = useToastShortcuts();
  return (
    <button
      type="button"
      onClick={() => toast[tone]({ title: `${tone} title`, description: "body" })}
    >
      fire
    </button>
  );
}

describe("useToastShortcuts + ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a toast when `success` is called and auto-dismisses", () => {
    render(
      <ToastProvider>
        <FireOnMount tone="success" />
      </ToastProvider>
    );

    act(() => {
      screen.getByText("fire").click();
    });

    expect(screen.getByText("success title")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();

    // Underlying provider auto-dismisses after 4500ms (R10 default).
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("success title")).not.toBeInTheDocument();
  });

  it.each(["info", "error"] as const)(
    "renders the %s variant",
    (tone) => {
      render(
        <ToastProvider>
          <FireOnMount tone={tone} />
        </ToastProvider>
      );
      act(() => {
        screen.getByText("fire").click();
      });
      expect(screen.getByText(`${tone} title`)).toBeInTheDocument();
    }
  );
});
