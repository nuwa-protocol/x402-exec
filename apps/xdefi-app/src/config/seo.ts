import { baseUrl } from '@/config/app'

export type SeoConfig = {
  siteName: string
  titleTemplate: string // use %s as placeholder for page title
  defaultTitle: string
  description: string
  twitter: {
    site?: string // e.g. @xdefi
    creator?: string
    card: 'summary' | 'summary_large_image'
  }
  openGraph: {
    type: 'website' | 'article'
    locale?: string
  }
}

export const seoConfig: SeoConfig = {
  siteName: 'xdefi.app',
  titleTemplate: '%s | xdefi.app',
  defaultTitle: 'xdefi.app',
  description: 'Swap and bridge crypto assets with a clean, fast UI.',
  twitter: {
    site: '@NuwaDev',
    creator: '@NuwaDev',
    card: 'summary_large_image',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
  },
}

export function absoluteUrl(path?: string) {
  if (!path) return baseUrl
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`
}
