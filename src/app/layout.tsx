import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: 'Svitlo Tracker - Графік відключень світла',
  description: 'Відстежуйте графіки відключень електроенергії в Україні. Дізнайтеся вашу чергу та отримуйте сповіщення.',
  keywords: ['відключення світла', 'графік', 'черга', 'Україна', 'ДТЕК', 'YASNO'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="uk">
      <body className={`${manrope.variable} font-sans antialiased`}>
        <div className="min-h-screen bg-pattern">
          {children}
        </div>
      </body>
    </html>
  )
}
