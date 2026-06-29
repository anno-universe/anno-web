import { useState } from "react";
import { Plus, X } from "lucide-react";
import { TagPicker } from "./TagPicker";
import type { TagOutput, ImageTagOutput } from "@/types/tag";

interface Props {
  imageTags: ImageTagOutput[];
  projectTags: TagOutput[];
  onApplyTag: (tagId: number) => void;
  onRemoveTag: (tagId: number) => void;
  disabled?: boolean;
  /** Current user ID — used to enforce "workers can only remove own tags" */
  currentUserId?: number | null;
  /** Current user's project role */
  userRole?: string | null;
}

/**
 * Does the current user have permission to remove this tag?
 *
 * Backend rule (ImageTagController.remove):
 * - Admins and supervisors can remove any tag
 * - Workers can only remove tags they themselves applied
 */
function canRemoveTag(
  tag: ImageTagOutput,
  userRole?: string | null,
  currentUserId?: number | null,
): boolean {
  const role = (userRole ?? "").toLowerCase();
  if (role === "admin" || role === "supervisor") return true;
  if (role === "worker") return tag.applied_by_id === currentUserId;
  return false;
}

/**
 * Compact tag bar for the annotation page top bar.
 * Shows applied tags as colored pills with remove buttons,
 * and a "+" button to open the tag picker.
 */
export function ImageTagBar({
  imageTags,
  projectTags,
  onApplyTag,
  onRemoveTag,
  disabled = false,
  currentUserId,
  userRole,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const appliedTagIds = new Set(imageTags.map((t) => t.tag_id));

  return (
    <div className="relative flex items-center gap-1.5">
      {imageTags.map((t) => {
        const canRemove = canRemoveTag(t, userRole, currentUserId);
        return (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight"
          style={{
            borderColor: t.tag_color,
            backgroundColor: `${t.tag_color}18`,
            color: t.tag_color,
          }}
          title={
            t.note
              ? `${t.tag_display_name || t.tag_name}: ${t.note}`
              : t.tag_display_name || t.tag_name
          }
        >
          <span className="max-w-[100px] truncate">
            {t.tag_display_name || t.tag_name}
          </span>
          {!disabled && canRemove && (
            <button
              type="button"
              onClick={() => onRemoveTag(t.tag_id)}
              className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-black/10"
              title={`Remove "${t.tag_display_name || t.tag_name}" tag`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </span>
        );
      })}

      {!disabled && (
        <button
          type="button"
          onClick={() => setPickerOpen(!pickerOpen)}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed text-muted-foreground transition-colors hover:border-foreground hover:text-foreground ${
            pickerOpen ? "border-foreground text-foreground" : ""
          }`}
          title="Add tag"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}

      {pickerOpen && (
        <TagPicker
          projectTags={projectTags}
          appliedTagIds={appliedTagIds}
          onSelect={onApplyTag}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
