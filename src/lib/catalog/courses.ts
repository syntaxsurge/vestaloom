export type CourseCatalogItem = {
  courseId: bigint
  title: string
  subtitle: string
  category: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  coverGradient: string
  tags: string[]
  summary: string
}

const catalog: CourseCatalogItem[] = [
  {
    courseId: 1n,
    title: 'Solidity Foundations',
    subtitle: 'Launch a smart contract in 7 days',
    category: 'Smart Contracts',
    difficulty: 'Beginner',
    coverGradient: 'from-sky-500 via-cyan-400 to-emerald-400',
    tags: ['Solidity', 'Somnia', 'Tooling'],
    summary:
      'Hands-on introduction to Solidity, Hardhat, and secure smart-contract patterns for Somnia builders.'
  },
  {
    courseId: 2n,
    title: 'Creator Economy Masterclass',
    subtitle: 'Design, launch & monetize onchain communities',
    category: 'Growth',
    difficulty: 'Intermediate',
    coverGradient: 'from-fuchsia-500 via-purple-500 to-indigo-500',
    tags: ['Community', 'Monetization', 'Strategy'],
    summary:
      'Blueprint and templates for crafting recurring-revenue membership products with Vestaloom automations on Somnia.'
  },
  {
    courseId: 3n,
    title: 'AI-first Course Studio',
    subtitle: 'Ship cinematic learning content with AI-native tools',
    category: 'Production',
    difficulty: 'Intermediate',
    coverGradient: 'from-amber-500 via-orange-400 to-rose-500',
    tags: ['AI', 'Storytelling', 'Automation'],
    summary:
      'From script to screen – automate storyboarding, video editing, and learner analytics with AI workflows.'
  }
]

export function getCourseCatalog(): CourseCatalogItem[] {
  return catalog
}

export function findCourse(courseId: bigint): CourseCatalogItem | undefined {
  return catalog.find(course => course.courseId === courseId)
}
