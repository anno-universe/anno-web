import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
  onConfigureKeypoints?: () => void;
  keypointConfigurationAvailable?: boolean;
  disabled?: boolean;
}

/**
 * Structured configuration editor that replaces the raw MetaInfoEditor on the
 * project settings page. Presents annotation-related feature flags as labelled
 * toggles / inputs while reading/writing plain meta_info keys.
 */
export function AnnotationSettings({
  value,
  onChange,
  onConfigureKeypoints,
  keypointConfigurationAvailable = true,
  disabled,
}: Props) {
  function setMeta(key: string, v: unknown) {
    const next = { ...value, version: PROJECT_CONFIG_VERSION, [key]: v };
    onChange(next as MetaInfoConfigV2);
  }

  const boxRotation = value.box_rotation_enabled === true;

  const keypointEnabled = value.keypoint_enabled === true;

  return (
    <FieldGroup className="gap-4">
      {/* ---- Box ---- */}
      <FieldSet className="rounded-md border px-4 py-3">
        <FieldLegend variant="label" className="px-1">
          Box annotation
        </FieldLegend>
        <Field orientation="responsive">
          <FieldContent>
            <FieldTitle>Rotation handle</FieldTitle>
            <FieldDescription>
              Show rotate and scale handles on selected boxes so annotators can
              adjust the angle.
            </FieldDescription>
          </FieldContent>
          <div className="flex justify-end">
            <Switch
              checked={boxRotation}
              onCheckedChange={(on) => setMeta("box_rotation_enabled", on)}
              disabled={disabled}
              aria-label="Enable box rotation handles"
            />
          </div>
        </Field>
      </FieldSet>

      {/* ---- Keypoint ---- */}
      {keypointConfigurationAvailable ? (
        <FieldSet className="rounded-md border px-4 py-3">
          <FieldLegend variant="label" className="px-1">
            Keypoint annotation
          </FieldLegend>
          <Field orientation="responsive">
            <FieldContent>
              <FieldTitle>Enable keypoint annotation</FieldTitle>
              <FieldDescription>
                Turning this on opens a guided setup for point templates and
                connections; it stays off until you finish setup. Turning it off
                later keeps the saved configuration.
              </FieldDescription>
            </FieldContent>
            <div className="flex items-center justify-end gap-2">
              {!disabled && keypointEnabled && onConfigureKeypoints ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onConfigureKeypoints}
                >
                  Configure
                </Button>
              ) : null}
              <Switch
                checked={keypointEnabled}
                onCheckedChange={(enabled) => {
                  // Enabling is a two-step commit: opening the guided setup does
                  // not flip the flag — the wizard saves keypoint_enabled itself,
                  // so the switch only shows on once setup is actually complete.
                  if (enabled && !keypointEnabled && onConfigureKeypoints) {
                    onConfigureKeypoints();
                    return;
                  }
                  setMeta("keypoint_enabled", enabled);
                }}
                disabled={disabled}
                aria-label="Enable keypoint annotation"
              />
            </div>
          </Field>
        </FieldSet>
      ) : null}
    </FieldGroup>
  );
}
