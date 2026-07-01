import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { TagOutput } from "@/types/tag";

interface Props {
  projectTags: TagOutput[];
  appliedTagIds: Set<number>;
  onSelect: (tagId: number) => void;
  onClose: () => void;
}

/**
 * Searchable tag list for applying a tag, rendered as the content of a Popover.
 * Available = project tags minus already-applied ones. The parent Popover owns
 * open state and dismiss (click-outside / Escape); selecting a tag applies it
 * and closes the popover via `onClose`.
 */
export function TagPicker({
  projectTags,
  appliedTagIds,
  onSelect,
  onClose,
}: Props) {
  const available = projectTags.filter((t) => !appliedTagIds.has(t.id));

  if (available.length === 0) {
    return (
      <p className="px-3 py-2 text-center text-xs text-muted-foreground">
        No tags available.
        <br />
        <span className="text-[11px]">
          Ask a supervisor to define project tags in Settings.
        </span>
      </p>
    );
  }

  return (
    <Command>
      <CommandInput placeholder="Apply tag…" className="text-xs" />
      <CommandList>
        <CommandEmpty>No matching tags.</CommandEmpty>
        <CommandGroup>
          {available.map((tag) => {
            const label = tag.display_name || tag.name;
            return (
              <CommandItem
                key={tag.id}
                value={label}
                onSelect={() => {
                  onSelect(tag.id);
                  onClose();
                }}
                className="gap-2 text-xs"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="truncate text-foreground">{label}</span>
                {tag.description && (
                  <span className="ml-auto shrink-0 truncate text-[10px] text-muted-foreground max-w-[80px]">
                    {tag.description}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
