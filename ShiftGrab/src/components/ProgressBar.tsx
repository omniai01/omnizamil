type Props = {
  percent: number
  label: string
  detail?: string
}

export function ProgressBar({ percent, label, detail }: Props) {
  return (
    <div className="progress-card">
      <div className="progress-top">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <div className="bar">
        <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  )
}
