import { ISitemapField, getServerSideSitemapLegacy } from 'next-sitemap'
import { GetServerSideProps } from 'next'
import { loadGroups } from '@/shared/data/groups-loader'
import { SITEMAP_SITE_URL } from '@/shared/constants/urls'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const groups = loadGroups()
  const fields = Object.keys(groups).map<ISitemapField>(group => (
    {
      loc: `${SITEMAP_SITE_URL}/${group}`,
      changefreq: 'weekly',
      priority: 0.8
    }
  ))

  return getServerSideSitemapLegacy(ctx, fields)
}

export default function Sitemap() { }