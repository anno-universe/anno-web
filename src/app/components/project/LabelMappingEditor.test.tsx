import { useState } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { LabelMappingEditor } from "./LabelMappingEditor";
import type {
  LabelMappingEntry,
  SupercategoryEntry,
} from "@/lib/utils/labelMapping";

beforeAll(() => {
  // The labels table renders a Radix Select per row; stub the browser APIs
  // jsdom lacks so a closed Select can mount in the reparent test.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.setPointerCapture = () => {};
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});

afterEach(() => cleanup());

const noop = () => {};

describe("LabelMappingEditor", () => {
  it("seeds rows from props once and ignores later prop changes", () => {
    // The editor's local rows are the single source of truth while editing.
    // The removed prop-sync effect re-seeded rows (with fresh keys) whenever
    // value/supercategories changed identity — including on the editor's own
    // per-keystroke onChange round-trip — which remounted the inputs and stole
    // focus. This locks in that a prop change no longer rebuilds the rows.
    const { rerender } = render(
      <LabelMappingEditor
        value={{}}
        supercategories={{ mammal: {} }}
        onChange={noop}
      />,
    );
    expect(screen.getByDisplayValue("mammal")).toBeInTheDocument();

    rerender(
      <LabelMappingEditor
        value={{}}
        supercategories={{ reptile: {} }}
        onChange={noop}
      />,
    );

    // Still the originally-seeded row; the new prop was not adopted.
    expect(screen.getByDisplayValue("mammal")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("reptile")).toBeNull();
  });

  it("does not reparent unparented labels when naming a fresh supercategory", async () => {
    const user = userEvent.setup();
    let latest: Record<string, LabelMappingEntry> = {};

    // Mirrors the settings page / create dialog: the parent feeds the editor's
    // own onChange straight back as props on every keystroke.
    function Harness() {
      const [labels, setLabels] = useState<Record<string, LabelMappingEntry>>({
        cat: { id: 1, color: "#2563EB" },
      });
      const [supers, setSupers] = useState<
        Record<string, SupercategoryEntry>
      >({});
      return (
        <LabelMappingEditor
          value={labels}
          supercategories={supers}
          onChange={(nextLabels, nextSupers) => {
            latest = nextLabels;
            setLabels(nextLabels);
            setSupers(nextSupers);
          }}
        />
      );
    }
    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: /add supercategory/i }),
    );
    await user.type(screen.getByPlaceholderText("dog"), "mammal");

    // The pre-existing label had no supercategory; naming a brand-new
    // supercategory must not adopt every unparented label.
    expect(latest.cat?.supercategory).toBeUndefined();
  });
});
