import grabIcon from './assets/icon.png'

type Props = { className?: string; studio?: boolean; grab?: boolean }

/** ShiftZero studio mark + ShiftGrab grabber (single shared icon asset). */
export function Mark({ className, studio, grab }: Props) {
  if (grab) {
    return (
      <img
        className={className}
        src={grabIcon}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    )
  }

  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      {studio ? (
        <>
          <circle cx="50" cy="50" r="46" fill="#e4f3f3" />
          <path d="M50 12 L18 44 L34 60 L50 44 Z" fill="#157B86" />
          <path d="M50 12 L82 44 L66 60 L50 44 Z" fill="#0e5c65" />
          <polygon
            points="50,48 66,64 50,80 34,64"
            fill="#157B86"
            stroke="#E4F3F3"
            strokeWidth="3"
          />
          <circle cx="50" cy="56" r="6" fill="#f2f9f9" />
        </>
      ) : (
        <>
          <path d="M50 4 L12 42 L32 62 L50 44 Z" fill="#157B86" />
          <path d="M50 4 L88 42 L68 62 L50 44 Z" fill="#0e5c65" />
          <polygon
            points="50,52 68,70 50,88 32,70"
            fill="#157B86"
            stroke="#E4F3F3"
            strokeWidth="4"
          />
        </>
      )}
    </svg>
  )
}
