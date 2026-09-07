import { useRef, useState, type DragEvent, type ReactNode } from 'react';

interface DropZoneProps {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  multiple?: boolean;
  accept?: string;
  compact?: boolean;
  onFiles: (files: File[]) => void;
}

export function DropZone({
  title,
  subtitle,
  icon,
  multiple = false,
  accept = 'image/png,image/jpeg,image/webp',
  compact = false,
  onFiles,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const take = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles(Array.from(list));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setActive(false);
    take(e.dataTransfer.files);
  };

  return (
    <div
      className={`dropzone ${compact ? 'compact' : ''} ${active ? 'active' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
    >
      <div>
        <div className="dz-icon">{icon}</div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          take(e.target.files);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
