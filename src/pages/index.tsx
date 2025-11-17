import { GetServerSidePropsResult } from 'next'
import { groups } from '@/shared/data/groups'

export default function HomePage() { }

export async function getServerSideProps(): Promise<GetServerSidePropsResult<Record<string, never>>> {
  // Получаем первую группу из списка
  const firstGroupId = Object.keys(groups)[0]
  
  return {
    redirect: {
      destination: `/${firstGroupId}`,
      permanent: true
    }
  }
}