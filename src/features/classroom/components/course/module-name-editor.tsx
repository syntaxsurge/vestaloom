'use client'

import { ElementRef, useRef, useState } from 'react'

import { useMutation } from 'convex/react'
import TextareaAutosize from 'react-textarea-autosize'

import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'

interface NameEditorProps {
  id: Id<'modules'>
  name: string
  ownerAddress?: string | null
}

export const ModuleNameEditor = ({
  id,
  name,
  ownerAddress
}: NameEditorProps) => {
  const inputRef = useRef<ElementRef<'textarea'>>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(name)

  const update = useMutation(api.modules.updateTitle)

  const enableInput = () => {
    setIsEditing(true)
    setTimeout(() => {
      setValue(name)
      const inputElement = inputRef.current
      inputRef.current?.focus()
      inputElement?.setSelectionRange(
        inputElement.value.length,
        inputElement.value.length
      )
    }, 0)
  }

  const disableEditing = () => setIsEditing(false)

  const onInput = (value: string) => {
    setValue(value)
    if (!ownerAddress) return
    update({
      id,
      title: value || 'Untitled',
      address: ownerAddress
    })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      disableEditing()
    }
  }

  return (
    <div>
      {isEditing ? (
        <TextareaAutosize
          ref={inputRef}
          onBlur={disableEditing}
          onKeyDown={onKeyDown}
          value={value}
          onChange={e => onInput(e.target.value)}
          className='text-md w-full break-words bg-transparent text-center font-semibold text-foreground outline-none'
          maxLength={60}
        />
      ) : (
        <div
          onClick={enableInput}
          className='text-md w-full break-words pb-[11.5px] text-center font-semibold text-foreground outline-none'
        >
          {name}
        </div>
      )}
    </div>
  )
}
