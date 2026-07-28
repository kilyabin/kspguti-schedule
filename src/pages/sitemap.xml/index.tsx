import { ISitemapField, getServerSideSitemapLegacy } from 'next-sitemap'
import { GetServerSideProps } from 'next'
import { loadGroups } from '@/shared/data/groups-loader'
import { loadTeachers } from '@/shared/data/teachers-loader'
import { SITEMAP_SITE_URL } from '@/shared/constants/urls'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Используем кеш (обновляется каждую минуту автоматически)
  const groups = await loadGroups()
  const teachers = loadTeachers()

  const fields: ISitemapField[] = [
    {
      loc: SITEMAP_SITE_URL,
      changefreq: 'daily',
      priority: 1.0
    },
    {
      loc: `${SITEMAP_SITE_URL}/teachers`,
      changefreq: 'weekly',
      priority: 0.7
    },
    ...Object.keys(groups).map<ISitemapField>(group => (
      {
        loc: `${SITEMAP_SITE_URL}/${group}`,
        changefreq: 'weekly',
        priority: 0.8
      }
    )),
    ...Object.values(teachers).map<ISitemapField>(teacher => (
      {
        loc: `${SITEMAP_SITE_URL}/teacher/${teacher.parseId}`,
        changefreq: 'weekly',
        priority: 0.6
      }
    ))
  ]

  return getServerSideSitemapLegacy(ctx, fields)
}

export default function Sitemap() { }