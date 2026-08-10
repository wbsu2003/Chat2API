import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { ProxyRule } from '@/types/electron'

import { EMPTY_DRAFT, draftToRule, ruleToDraft, useNetworkStore } from './networkStore'
import { ProviderProxyRow, RuleForm } from './ProviderProxyRow'

function GlobalProxyCard() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const config = useNetworkStore((s) => s.config)
  const saveGlobal = useNetworkStore((s) => s.saveGlobal)

  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    setEnabled(Boolean(config.global))
    setDraft(ruleToDraft(config.global))
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    try {
      let rule: ProxyRule | null = null

      if (enabled) {
        const result = draftToRule(draft)
        if ('error' in result) {
          toast({ title: t(result.error), variant: 'destructive' })
          return
        }
        rule = result.rule
      }

      await saveGlobal(rule)
      toast({ title: t('proxyNet.saved') })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('proxyNet.saveFailed'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t('proxyNet.globalTitle')}
        </CardTitle>
        <CardDescription>{t('proxyNet.globalDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={enabled ? 'on' : 'off'} onValueChange={(mode) => setEnabled(mode === 'on')}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">{t('proxyNet.globalOff')}</SelectItem>
            <SelectItem value="on">{t('proxyNet.globalOn')}</SelectItem>
          </SelectContent>
        </Select>

        {enabled && <RuleForm value={draft} onChange={setDraft} idPrefix="global" />}

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  )
}

export function NetworkPage() {
  const { t } = useTranslation()
  const { providers, loading, error, load } = useNetworkStore()

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('proxyNet.title')}</h2>
        <p className="text-muted-foreground">{t('proxyNet.description')}</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <GlobalProxyCard />

      <Card>
        <CardHeader>
          <CardTitle>{t('proxyNet.perProviderTitle')}</CardTitle>
          <CardDescription>{t('proxyNet.perProviderDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {!loading && providers.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('proxyNet.noProviders')}</p>
          )}
          {providers.map((provider) => (
            <ProviderProxyRow
              key={provider.id}
              providerId={provider.id}
              providerName={provider.name}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export default NetworkPage
