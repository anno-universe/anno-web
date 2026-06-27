import type { ProjectMemberOutput } from "@/types/project";

interface MemberRoleSelectProps {
  member: ProjectMemberOutput;
  isCreator: boolean;
  disabled: boolean;
  onChange: (userId: number, newRole: string) => void;
}

export function MemberRoleSelect({
  member,
  isCreator,
  disabled,
  onChange,
}: MemberRoleSelectProps) {
  return (
    <select
      value={member.role}
      disabled={isCreator || disabled}
      onChange={(e) => onChange(member.user_id, e.target.value)}
      className="rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-50"
    >
      <option value="worker">Worker</option>
      <option value="supervisor">Supervisor</option>
    </select>
  );
}

interface MemberRemoveButtonProps {
  member: ProjectMemberOutput;
  isCreator: boolean;
  disabled: boolean;
  onRemove: (userId: number) => void;
}

export function MemberRemoveButton({
  member,
  isCreator,
  disabled,
  onRemove,
}: MemberRemoveButtonProps) {
  if (isCreator) return null;

  return (
    <button
      onClick={() => onRemove(member.user_id)}
      disabled={disabled}
      className="rounded-md border border-destructive/50 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
