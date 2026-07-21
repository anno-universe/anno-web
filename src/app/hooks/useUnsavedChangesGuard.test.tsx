import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  createMemoryRouter,
  RouterProvider,
  useNavigate,
} from "react-router";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

function GuardedPage({ block }: { block: boolean }) {
  const navigate = useNavigate();
  const guard = useUnsavedChangesGuard(block);
  return (
    <div>
      <h1>home</h1>
      <button onClick={() => navigate("/other")}>leave</button>
      {guard.blocked && (
        <div>
          <p>guard-open</p>
          <button onClick={guard.proceed}>confirm-leave</button>
          <button onClick={guard.cancel}>stay</button>
        </div>
      )}
    </div>
  );
}

function renderWithRouter(block: boolean) {
  const router = createMemoryRouter([
    { path: "/", element: <GuardedPage block={block} /> },
    { path: "/other", element: <h1>other</h1> },
  ]);
  return render(<RouterProvider router={router} />);
}

afterEach(() => cleanup());

describe("useUnsavedChangesGuard", () => {
  it("allows navigation when nothing is dirty", async () => {
    renderWithRouter(false);
    fireEvent.click(screen.getByText("leave"));
    expect(await screen.findByText("other")).toBeInTheDocument();
  });

  it("blocks navigation when dirty, then proceeds on confirm", async () => {
    renderWithRouter(true);
    fireEvent.click(screen.getByText("leave"));

    // Blocked: prompt shown, still on the home route.
    expect(await screen.findByText("guard-open")).toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(screen.queryByText("other")).not.toBeInTheDocument();

    // Confirming completes the navigation.
    fireEvent.click(screen.getByText("confirm-leave"));
    expect(await screen.findByText("other")).toBeInTheDocument();
  });

  it("blocks navigation when dirty, then stays on cancel", async () => {
    renderWithRouter(true);
    fireEvent.click(screen.getByText("leave"));
    expect(await screen.findByText("guard-open")).toBeInTheDocument();

    fireEvent.click(screen.getByText("stay"));
    await waitFor(() =>
      expect(screen.queryByText("guard-open")).not.toBeInTheDocument()
    );
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(screen.queryByText("other")).not.toBeInTheDocument();
  });

  it("prevents beforeunload when dirty", () => {
    renderWithRouter(true);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not prevent beforeunload when not dirty", () => {
    renderWithRouter(false);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
