import type { ReactNode } from "react";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";

interface SettingsSectionProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <FieldSet className="min-w-0 rounded-md border px-4 py-3">
      <FieldLegend variant="label" className="px-1">
        {title}
      </FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      {children}
    </FieldSet>
  );
}
