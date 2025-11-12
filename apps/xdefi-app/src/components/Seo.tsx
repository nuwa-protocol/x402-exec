import { useEffect } from 'react'
import { absoluteUrl, seoConfig } from '@/config/seo'

type SeoProps = {
  title?: string
  description?: string
  path?: string // e.g. '/swap'
  noIndex?: boolean
  ogType?: 'website' | 'article'
  keywords?: string[]
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (content == null) {
    if (el) el.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', url)
}

function setJSONLD(json: Record<string, unknown>) {
  const id = 'ld-json-seo'
  let script = document.head.querySelector<HTMLScriptElement>(`#${id}`)
  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = id
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(json)
}

export default function Seo({
  title,
  description,
  path,
  noIndex,
  ogType,
  keywords,
}: SeoProps) {
  useEffect(() => {
    const pageTitle = title ?? seoConfig.defaultTitle
    const resolvedTitle = title
      ? seoConfig.titleTemplate.replace('%s', title)
      : seoConfig.defaultTitle

    const url = absoluteUrl(path ?? window.location.pathname)
    const desc = description ?? seoConfig.description
    const type = ogType ?? seoConfig.openGraph.type

    document.title = resolvedTitle

    // Basics
    upsertMeta('name', 'description', desc)
    upsertMeta('name', 'keywords', keywords && keywords.length ? keywords.join(', ') : null)
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')

    // Open Graph
    upsertMeta('property', 'og:title', pageTitle)
    upsertMeta('property', 'og:description', desc)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:site_name', seoConfig.siteName)
    if (seoConfig.openGraph.locale) {
      upsertMeta('property', 'og:locale', seoConfig.openGraph.locale)
    }

    // Twitter
    upsertMeta('name', 'twitter:card', seoConfig.twitter.card)
    if (seoConfig.twitter.site) upsertMeta('name', 'twitter:site', seoConfig.twitter.site)
    if (seoConfig.twitter.creator) upsertMeta('name', 'twitter:creator', seoConfig.twitter.creator)
    upsertMeta('name', 'twitter:title', pageTitle)
    upsertMeta('name', 'twitter:description', desc)
    // no twitter:image per project requirements

    // Canonical
    setCanonical(url)

    // JSON-LD
    setJSONLD({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: seoConfig.siteName,
      url,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${url}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    })
  }, [title, description, path, noIndex, ogType, keywords])

  return null
}
