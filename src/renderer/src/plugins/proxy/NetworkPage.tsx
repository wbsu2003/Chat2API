import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, Loader2, Plug, ShieldCheck, ShieldX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { ProxyProtocol, ProxyRule } from '@/types/electron'

import {
  EMPTY_DRAFT,
  draftToRule,
  getProviderMode,
  ruleToDraft,
  useNetworkStore,
  type ProviderProxyMode,
  type ProxyDraft,
} from './networkStore'

const PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks5']

interface RuleFormProps {
  value: ProxyDraft
  onChange: (draft: ProxyDraft) => void
  idPrefix: string
}

function RuleForm({ value, onChange, idPrefix }: RuleFormProps) {
  const { t } = useTranslation()

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-protocol`}>{t('proxyNet.protocol')}</Label>
        <Select
          value={value.protocol}
          onValueChange={(protocol) => onChange({ ...value, protocol: protocol as ProxyProtocol })}
        >
          <SelectTrigger id={`${idPrefix}-protocol`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROTOCOLS.map((protocol) => (
              <SelectItem key={protocol} value={protocol}>
                {protocol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-host`}>{t('proxyNet.host')}</Label>
        <Input
          id={`${idPrefix}-host`}
          value={value.host}
          placeholder="127.0.0.1"
          onChange={(e) => onChange({ ...value, host: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-port`}>{t('proxyNet.port')}</Label>
        <Input
          id={`${idPrefix}-port`}
          value={value.port}
          placeholder="7890"
          inputMode="numeric"
          onChange={(e) => onChange({ ...value, port: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-username`}>{t('proxyNet.username')}</Label>
        <Input
          id={`${idPrefix}-username`}
          value={value.username}
          placeholder={t('proxyNet.optional')}
          onChange={(e) => onChange({ ...value, username: e.target.value })}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-password`}>{t('proxyNet.password')}</Label>
        <Input
          id={`${idPrefix}-password`}
          type="password"
          value={value.password}
          placeholder={t('proxyNet.optional')}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
        />
      </div>
    </div>
  )
}

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
        <Select
          value={enabled ? 'on' : 'off'}
          onValueChange={(mode) => setEnabled(mode === 'on')}
        >
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

function ProviderRow({ providerId, providerName }: { providerId: string; providerName: string }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const config = useNetworkStore((s) => s.config)
  const saveProvider = useNetworkStore((s) => s.saveProvider)
  const testProvider = useNetworkStore((s) => s.testProvider)
  const result = useNetworkStore((s) => s.testResults[providerId])
  const testing = useNetworkStore((s) => s.testing[providerId])

  const mode = getProviderMode(config, providerId)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const override = config?.perProvider[providerId]
    setDraft(ruleToDraft(override ?? null))
  }, [config, providerId])

  const applyMode = async (next: ProviderProxyMode) => {
    if (next === 'custom') {
      setExpanded(true)
      return
    }

    setExpanded(false)
    try {
      await saveProvider(providerId, next === 'inherit' ? undefined : null)
      toast({ title: t('proxyNet.saved') })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('proxyNet.saveFailed'),
        variant: 'destructive',
      })
    }
  }

  const saveCustom = async () => {
    const parsed = draftToRule(draft)
    if ('error' in parsed) {
      toast({ title: t(parsed.error), variant: 'destructive' })
      return
    }

    try {
      await saveProvider(providerId, parsed.rule)
      setExpanded(false)
      toast({ title: t('proxyNet.saved') })
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : t('proxyNet.saveFailed'),
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium truncate">{providerName}</p>
          <p className="text-xs text-muted-foreground truncate">{providerId}</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={(next) => applyMode(next as ProviderProxyMode)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">{t('proxyNet.modeInherit')}</SelectItem>
              <SelectItem value="direct">{t('proxyNet.modeDirect')}</SelectItem>
              <SelectItem value="custom">{t('proxyNet.modeCustom')}</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => testProvider(providerId)} disabled={testing}>
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plug className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">{t('proxyNet.test')}</span>
          </Button>
        </div>
      </div>

      {(expanded || mode === 'custom') && (
        <div className="space-y-3 pt-2 border-t">
          <RuleForm value={draft} onChange={setDraft} idPrefix={`p-${providerId}`} />
          <Button size="sm" onClick={saveCustom}>
            {t('common.save')}
          </Button>
        </div>
      )}

      {result && (
        <div
          className={`flex flex-wrap items-center gap-2 text-xs ${
            result.success ? 'text-emerald-600' : 'text-destructive'
          }`}
        >
          {result.success ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldX className="h-4 w-4" />
          )}
          <span>{result.via}</span>
          {result.outboundIp && <span>· {t('proxyNet.outboundIp')}: {result.outboundIp}</span>}
          {typeof result.latency === 'number' && <span>· {result.latency}ms</span>}
          {result.error && <span>· {result.error}</span>}
        </div>
      )}
    </div>
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
            <ProviderRow
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
