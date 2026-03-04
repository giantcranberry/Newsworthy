import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlanningCalendar } from '@/components/calendar/planning-calendar'

export default async function CalendarPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planning Calendar</h1>
        <p className="text-sm text-gray-600 mt-1">Plan and track your upcoming content — press releases, social media, and events.</p>
      </div>
      <PlanningCalendar />
    </div>
  )
}
