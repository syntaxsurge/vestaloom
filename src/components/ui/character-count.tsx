import { cn } from '@/lib/utils'

type CharacterCountProps = {
  value?: string | null
  maxLength?: number
  className?: string
}

export function CharacterCount({
  value,
  maxLength,
  className
}: CharacterCountProps) {
  const length = value?.length ?? 0
  const limit = typeof maxLength === 'number' ? maxLength : null
  const overLimit = limit !== null && length > limit

  const text = limit !== null ? `${length}/${limit}` : `${length} characters`

  return (
    <span
      role='status'
      aria-live='polite'
      className={cn(
        'block text-right text-xs text-muted-foreground',
        overLimit && 'text-destructive',
        className
      )}
    >
      {text}
    </span>
  )
}

