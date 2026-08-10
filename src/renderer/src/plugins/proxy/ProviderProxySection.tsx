import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import { ProviderProxyRow } from './ProviderProxyRow'

interface ProviderProxySectionProps {
  providerId: string
  providerName: string
}

/**
 * Proxy control embedded on the account management screen.
 *
 * A provider that is unreachable directly needs its proxy configured *before*
 * authentication: the in-app login window loads the provider's site, so without
 * a working proxy the login page never appears and no credentials can be
 * captured. Requiring a trip to the Network page first is backwards.
 */
export function ProviderProxySection({ providerId, providerName }: ProviderProxySectionProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          {t('proxyNet.inlineTitle')}
        </CardTitle>
        <CardDescription>{t('proxyNet.inlineDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProviderProxyRow providerId={providerId} providerName={providerName} bare />
      </CardContent>
    </Card>
  )
}

export default ProviderProxySection
