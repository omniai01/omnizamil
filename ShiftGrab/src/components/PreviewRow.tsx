type Props = {
  title: string
  author?: string
  thumbnail?: string
  chips?: string[]
}

export function PreviewRow({ title, author, thumbnail, chips }: Props) {
  return (
    <section className="preview" aria-label="Media preview">
      {thumbnail ? (
        <img src={thumbnail} alt="" />
      ) : (
        <div className="preview-ph" />
      )}
      <div className="preview-meta">
        <h2 title={title}>{title}</h2>
        {author ? <p>{author}</p> : null}
        {chips && chips.length > 0 ? (
          <div className="chip-row">
            {chips.map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
