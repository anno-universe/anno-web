import { getLabelName, labelOptionsFromMapping } from "@/lib/utils/labelMapping";

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
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        disabled={disabled}
        className="w-20 rounded-md border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="Label"
      />
    );
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      disabled={disabled}
      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export { getLabelName };
