import { getLabelName, labelOptionsFromMapping } from "@/lib/utils/labelMapping";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  labelMapping: Record<string, unknown>;
  value: number | null;
  onChange: (label: number | null) => void;
  disabled?: boolean;
}

export function LabelSelect({
  labelMapping,
  value,
  onChange,
  disabled,
}: Props) {
  const options = labelOptionsFromMapping(labelMapping);

  if (options.length === 0) {
    // No label_mapping: allow manual number input
    return (
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        disabled={disabled}
        className="h-8 w-20 text-xs"
        placeholder="Label"
      />
    );
  }

  return (
    <Select
      value={value != null ? String(value) : undefined}
      onValueChange={(v) => onChange(v === "" ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-full text-xs">
        <SelectValue placeholder="Label" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export { getLabelName };
