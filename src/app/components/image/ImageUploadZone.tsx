import { useState, useRef, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
}

export function ImageUploadZone({
  onFilesSelected,
  disabled,
}: ImageUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleInputChange() {
    const files = inputRef.current?.files;
    if (!files || files.length === 0) return;
    onFilesSelected(Array.from(files));
    // Reset so re-selecting the same files fires onChange again
    inputRef.current.value = "";
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (dropped.length > 0) {
      onFilesSelected(dropped);
    }
  }

  return (
    <div
      onClick={disabled ? undefined : handleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border-2 border-dashed p-8 text-center transition-colors select-none",
        disabled
          ? "border-muted-foreground/20 opacity-50"
          : isDragOver
            ? "border-primary bg-primary/5 cursor-copy"
            : "border-muted-foreground/30 hover:border-muted-foreground/50 cursor-pointer"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={handleInputChange}
      />

      <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />

      {disabled ? (
        <p className="text-sm text-muted-foreground">Upload in progress…</p>
      ) : isDragOver ? (
        <p className="text-sm font-medium text-primary">Drop to add images</p>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">
            Drop images here or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPG, JPEG, TIFF, BMP, GIF
          </p>
        </div>
      )}
    </div>
  );
}
