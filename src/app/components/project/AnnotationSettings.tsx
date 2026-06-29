import { Switch } from "@/components/shared/Switch";
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
    <div className="space-y-4">
      {/* ---- Box ---- */}
      <fieldset className="rounded-md border px-4 py-3">
        <legend className="px-1 text-sm font-medium text-foreground">
          Box annotation
        </legend>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-foreground">Rotation handle</p>
            <p className="text-xs text-muted-foreground">
              Show rotate and scale handles on selected boxes so annotators can
              adjust the angle.
            </p>
          </div>
          <Switch
            checked={boxRotation}
            onCheckedChange={(on) => setMeta("box_rotation_enabled", on)}
            disabled={disabled}
          />
        </div>
      </fieldset>

      {/* ---- Keypoint ---- */}
      <fieldset className="rounded-md border px-4 py-3">
        <legend className="px-1 text-sm font-medium text-foreground">
          Keypoint annotation
        </legend>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm text-foreground">Show keypoint tool</p>
              <p className="text-xs text-muted-foreground">
                Let annotators place keypoint markers on images.
              </p>
            </div>
            <Switch
              checked={keypointEnabled}
              onCheckedChange={(on) => setMeta("keypoint_enabled", on)}
              disabled={disabled}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
