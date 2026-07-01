import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <Select
      value={member.role}
      disabled={isCreator || disabled}
      onValueChange={(v) => onChange(member.user_id, v)}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="worker">Worker</SelectItem>
          <SelectItem value="supervisor">Supervisor</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
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
    <Button
      variant="outline"
      size="xs"
      onClick={() => onRemove(member.user_id)}
      disabled={disabled}
      className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      Remove
    </Button>
  );
}
