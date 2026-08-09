import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, MessageSquarePlus, Send, Square, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { useChatStore } from './chatStore'

function SessionList() {
  const { t } = useTranslation()
  const sessions = useChatStore((s) => s.sessions)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const selectSession = useChatStore((s) => s.selectSession)
  const deleteSession = useChatStore((s) => s.deleteSession)

  if (sessions.length === 0) {
    return <p className="px-2 py-4 text-sm text-muted-foreground">{t('chat.noSessions')}</p>
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={cn(
            'group flex items-center gap-1 rounded-md px-2 py-2 cursor-pointer text-sm',
            session.id === activeSessionId ? 'bg-accent' : 'hover:bg-accent/50'
          )}
          onClick={() => selectSession(session.id)}
        >
          <span className="flex-1 truncate">{session.title}</span>
          <button
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              deleteSession(session.id)
            }}
            aria-label={t('common.delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

function MessageBubble({ role, content, failed }: { role: string; content: string; failed?: boolean }) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'bg-primary text-primary-foreground'
            : failed
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted'
        )}
      >
        {content}
      </div>
    </div>
  )
}

export function ChatPage() {
  const { t } = useTranslation()
  const {
    providers,
    activeProviderId,
    messages,
    model,
    streaming,
    streamingContent,
    error,
    init,
    selectProvider,
    newSession,
    setModel,
    send,
    stop,
  } = useChatStore()

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  const activeProvider = providers.find((provider) => provider.id === activeProviderId)
  const models = activeProvider?.supportedModels ?? []

  const handleSend = () => {
    const text = input
    setInput('')
    send(text)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="w-60 flex-shrink-0 flex flex-col rounded-lg border p-3">
        <Select value={activeProviderId ?? ''} onValueChange={selectProvider}>
          <SelectTrigger>
            <SelectValue placeholder={t('chat.selectProvider')} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button className="mt-3" variant="outline" size="sm" onClick={newSession} disabled={!activeProviderId}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          {t('chat.newSession')}
        </Button>

        <div className="mt-3 flex-1 overflow-y-auto">
          <SessionList />
        </div>
      </aside>

      <section className="flex-1 flex flex-col rounded-lg border">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-2">
          <span className="text-sm font-medium truncate">
            {activeProvider?.name ?? t('chat.selectProvider')}
          </span>
          {models.length > 0 && (
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder={t('chat.selectModel')} />
              </SelectTrigger>
              <SelectContent>
                {models.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !streaming && (
            <p className="text-sm text-muted-foreground">{t('chat.emptyHint')}</p>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              failed={message.failed}
            />
          ))}

          {streaming && (
            <MessageBubble
              role="assistant"
              content={streamingContent || t('chat.thinking')}
            />
          )}
        </div>

        {error && <p className="px-4 pb-2 text-xs text-destructive">{error}</p>}

        <footer className="border-t p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            {streaming ? (
              <Button variant="outline" onClick={stop}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={!input.trim() || !activeProviderId}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          {streaming && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('chat.streaming')}
            </p>
          )}
        </footer>
      </section>
    </div>
  )
}

export default ChatPage
