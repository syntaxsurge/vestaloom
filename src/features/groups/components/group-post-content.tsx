'use client'

import { cn } from '@/lib/utils'

type GroupPostContentProps = {
  content?: string | null
  className?: string
}

function gatherText(node: unknown): string {
  if (!node) return ''

  if (typeof node === 'string') {
    return node
  }

  if (typeof node === 'number') {
    return String(node)
  }

  if (typeof node !== 'object') {
    return ''
  }

  const record = node as Record<string, unknown>
  const parts: string[] = []

  if (typeof record.text === 'string') {
    parts.push(record.text)
  }

  if (Array.isArray(record.content)) {
    for (const child of record.content) {
      const childText = gatherText(child)
      if (childText) {
        parts.push(childText)
      }
    }
  }

  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      const childText = gatherText(child)
      if (childText) {
        parts.push(childText)
      }
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function toPlainText(raw: string | null | undefined): string {
  if (!raw) {
    return ''
  }

  const trimmed = raw.trim()

  if (!trimmed) {
    return ''
  }

  try {
    const parsed = JSON.parse(trimmed)

    const blocks = Array.isArray(parsed) ? parsed : [parsed]
    const lines = blocks
      .map(block => gatherText(block))
      .map(line => line.trim())
      .filter(Boolean)

    if (lines.length > 0) {
      return lines.join('\n\n')
    }
  } catch {
    // ignore malformed JSON and fall back to raw text
  }

  return trimmed
}

export function GroupPostContent({ content, className }: GroupPostContentProps) {
  const text = toPlainText(content)

  if (text.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'whitespace-pre-line text-base leading-7 text-foreground',
        className
      )}
    >
      {text}
    </div>
  )
}
