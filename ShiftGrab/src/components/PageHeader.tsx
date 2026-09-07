type Props = {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function PageHeader({ title, subtitle, actions, children }: Props) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      <div className="page-body">{children}</div>
    </div>
  )
}
