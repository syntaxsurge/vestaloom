'use client'

import { useEffect, useRef, useState } from 'react'

import { useMutation } from 'convex/react'
import TextareaAutosize from 'react-textarea-autosize'
import { useAccount } from 'wagmi'

import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

type GroupNameEditorProps = {
  groupId: Id<'groups'>
  name: string
}

export function GroupNameEditor({ groupId, name }: GroupNameEditorProps) {
  const { address } = useAccount()
  const updateName = useMutation(api.groups.updateName)

  const [value, setValue] = useState(name)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setValue(name)
  }, [name])

  const commitChange = async (nextValue: string) => {
    if (!address) return

    const sanitizedName = nextValue.trim() || 'Untitled group'
    setValue(sanitizedName)

    await updateName({
      id: groupId,
      name: sanitizedName,
      ownerAddress: address
    })
  }

  return (
    <div className='relative'>
      {isEditing ? (
        <TextareaAutosize
          ref={inputRef}
          value={value}
          onChange={event => setValue(event.target.value)}
          onBlur={() => {
            setIsEditing(false)
            void commitChange(value)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              inputRef.current?.blur()
            }
          }}
          className='w-full resize-none bg-transparent text-4xl font-semibold outline-none'
          maxLength={80}
        />
      ) : (
        <button
          type='button'
          onClick={() => {
            setIsEditing(true)
            requestAnimationFrame(() => {
              inputRef.current?.focus()
            })
          }}
          className='w-full text-left text-4xl font-semibold text-foreground transition hover:text-primary'
        >
          {value}
        </button>
      )}
    </div>
  )
}
