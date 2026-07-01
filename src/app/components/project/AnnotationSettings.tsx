import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldContent,
  FieldTitle,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldGroup,
} from "@/components/ui/field";
import {
  PROJECT_CONFIG_VERSION,
  type MetaInfoConfigV2,
} from "@/lib/project/configVersion";

interface Props {
  /** The raw meta_info object from the project (read/write via onChange). */
  value: MetaInfoConfigV2;
  onChange: (meta: MetaInfoConfigV2) => void;
  disabled?: boolean;
}

/**
 * Structured configuration editor that replaces the raw MetaInfoEditor on the
 * project settings page. Presents annotation-related feature flags as labelled
 * toggles / inputs while reading/writing plain meta_info keys.
 */
export function AnnotationSettings({ value, onChange, disabled }: Props) {
  function setMeta(key: string, v: unknown) {
    const next = { ...value, version: PROJECT_CONFIG_VERSION, [key]: v };
    onChange(next as MetaInfoConfigV2);
  }

  const boxRotation =
    value.box_rotation_enabled === true;

  const keypointEnabled =
    value.keypoint_enabled === true; // default off

  return (
    <FieldGroup className="gap-4">
      {/* ---- Box ---- */}
      <FieldSet className="rounded-md border px-4 py-3">
        <FieldLegend variant="label" className="px-1">
          Box annotation
        </FieldLegend>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Rotation handle</FieldTitle>
            <FieldDescription>
              Show rotate and scale handles on selected boxes so annotators can
              adjust the angle.
            </FieldDescription>
          </FieldContent>
          <Switch
            checked={boxRotation}
            onCheckedChange={(on) => setMeta("box_rotation_enabled", on)}
            disabled={disabled}
          />
        </Field>
      </FieldSet>

      {/* ---- Keypoint ---- */}
      <FieldSet className="rounded-md border px-4 py-3">
        <FieldLegend variant="label" className="px-1">
          Keypoint annotation
        </FieldLegend>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldTitle>Show keypoint tool</FieldTitle>
            <FieldDescription>
              Let annotators place keypoint markers on images.
            </FieldDescription>
          </FieldContent>
          <Switch
            checked={keypointEnabled}
            onCheckedChange={(on) => setMeta("keypoint_enabled", on)}
            disabled={disabled}
          />
        </Field>
      </FieldSet>
    </FieldGroup>
  );
}
