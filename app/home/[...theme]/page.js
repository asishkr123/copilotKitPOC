import Notice from '../../components/Notice'

export const metadata = {
  title: 'Nextjs Starter Template | Home',
  description: 'Demo of dyanmic routing - home/light & home/dark'
}

const page = async () => {
  return <Notice />
}

export default page
