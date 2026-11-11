type TopicChip = {
  id: number
  text: string
}

type TopicBarProps = {
  nodes: TopicChip[]
  darkMode: boolean
  onFocus: (id: number) => void
  onRemove: (id: number) => void
}

export const TopicBar = (props: TopicBarProps) => {
  const { nodes, darkMode, onFocus, onRemove } = props
  if (nodes.length === 0) {
    return null
  }

  const barClass =
    'fixed top-2 left-1/2 z-40 flex max-w-[80%] -translate-x-1/2 gap-1 border border-zinc-500 px-1 py-1 ' +
    (darkMode ? 'bg-black text-white' : 'bg-white text-black')

  return (
    <div className={barClass}>
      {nodes.map((node) => (
        <span key={node.id} className="flex items-center border border-amber-500">
          <button
            type="button"
            className="max-w-[12rem] truncate px-2 py-0.5 text-left text-sm"
            onClick={() => onFocus(node.id)}
          >
            {node.text === '' ? '（無題）' : node.text}
          </button>
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm"
            aria-label={`${node.text === '' ? '（無題）' : node.text} を話題から外す`}
            onClick={() => onRemove(node.id)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
