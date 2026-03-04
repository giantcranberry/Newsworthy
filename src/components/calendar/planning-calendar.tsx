'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CalendarEvent {
  id: number
  title: string
  description: string | null
  eventType: string
  eventDate: string
  eventTime: string | null
  status: string
  color: string
  companyId: number | null
  companyName: string | null
  releaseId: number | null
}

interface Company {
  id: number
  companyName: string
}

const EVENT_TYPES = [
  { value: 'press_release', label: 'Press Release', color: '#3b82f6' },
  { value: 'social_media', label: 'Social Media', color: '#22c55e' },
  { value: 'blog', label: 'Blog Post', color: '#f97316' },
  { value: 'event', label: 'Event', color: '#a855f7' },
  { value: 'other', label: 'Other', color: '#6b7280' },
]

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

function getEventTypeColor(eventType: string): string {
  return EVENT_TYPES.find((t) => t.value === eventType)?.color || '#6b7280'
}

function getEventTypeLabel(eventType: string): string {
  return EVENT_TYPES.find((t) => t.value === eventType)?.label || 'Other'
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function PlanningCalendar() {
  const today = new Date()
  const searchParams = useSearchParams()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [brandFilter, setBrandFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [gcalConnected, setGcalConnected] = useState(false)
  const [gcalLoading, setGcalLoading] = useState(true)

  // Day dialog
  const [dayDialogOpen, setDayDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Event form dialog
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'press_release',
    eventDate: '',
    eventTime: '',
    status: 'planned',
    color: '#3b82f6',
    companyId: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchEvents = useCallback(async () => {
    const startDate = new Date(currentYear, currentMonth, 1)
    const endDate = new Date(currentYear, currentMonth + 1, 0)
    // Pad to include days from prev/next month visible on the grid
    startDate.setDate(startDate.getDate() - startDate.getDay())
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

    const start = startDate.toISOString().split('T')[0]
    const end = endDate.toISOString().split('T')[0]

    let url = `/api/calendar?start=${start}&end=${end}`
    if (brandFilter) url += `&companyId=${brandFilter}`

    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events)
      }
    } catch (err) {
      console.error('Error fetching calendar events:', err)
    } finally {
      setLoading(false)
    }
  }, [currentYear, currentMonth, brandFilter])

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/calendar/companies')
      if (res.ok) {
        setCompanies(await res.json())
      }
    } catch (err) {
      console.error('Error fetching companies:', err)
    }
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  useEffect(() => {
    setLoading(true)
    fetchEvents()
  }, [fetchEvents])

  // Check Google Calendar connection status
  useEffect(() => {
    fetch('/api/google-calendar/status')
      .then((res) => res.json())
      .then((data) => setGcalConnected(data.connected))
      .catch(() => {})
      .finally(() => setGcalLoading(false))
  }, [])

  // Handle URL params from Google Calendar OAuth callback
  useEffect(() => {
    if (searchParams.get('gcal_connected') === 'true') {
      toast.success('Google Calendar connected successfully')
      setGcalConnected(true)
      window.history.replaceState({}, '', '/calendar')
    }
    const gcalError = searchParams.get('gcal_error')
    if (gcalError) {
      toast.error(`Google Calendar connection failed: ${gcalError}`)
      window.history.replaceState({}, '', '/calendar')
    }
  }, [searchParams])

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const goToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
  }

  const handleDisconnectGcal = async () => {
    try {
      const res = await fetch('/api/google-calendar/disconnect', { method: 'POST' })
      if (res.ok) {
        setGcalConnected(false)
        toast.success('Google Calendar disconnected')
      }
    } catch {
      toast.error('Failed to disconnect Google Calendar')
    }
  }

  const openDayDialog = (dateStr: string) => {
    setSelectedDate(dateStr)
    setDayDialogOpen(true)
  }

  const openAddForm = (dateStr: string) => {
    setEditingEvent(null)
    setFormData({
      title: '',
      description: '',
      eventType: 'press_release',
      eventDate: dateStr,
      eventTime: '',
      status: 'planned',
      color: '#3b82f6',
      companyId: '',
    })
    setDayDialogOpen(false)
    setFormDialogOpen(true)
  }

  const openEditForm = (event: CalendarEvent) => {
    setEditingEvent(event)
    setFormData({
      title: event.title,
      description: event.description || '',
      eventType: event.eventType,
      eventDate: event.eventDate,
      eventTime: event.eventTime || '',
      status: event.status,
      color: event.color,
      companyId: event.companyId?.toString() || '',
    })
    setDayDialogOpen(false)
    setFormDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.eventDate) return
    setSaving(true)

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        eventType: formData.eventType,
        eventDate: formData.eventDate,
        eventTime: formData.eventTime || null,
        status: formData.status,
        color: formData.color,
        companyId: formData.companyId || null,
      }

      if (editingEvent) {
        const res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
      }

      setFormDialogOpen(false)
      fetchEvents()
    } catch (err) {
      console.error('Error saving event:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingEvent) return
    setSaving(true)

    try {
      const res = await fetch(`/api/calendar/${editingEvent.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setFormDialogOpen(false)
      fetchEvents()
    } catch (err) {
      console.error('Error deleting event:', err)
    } finally {
      setSaving(false)
    }
  }

  // Build calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const prevMonthDays = getDaysInMonth(
    currentMonth === 0 ? currentYear - 1 : currentYear,
    currentMonth === 0 ? 11 : currentMonth - 1
  )

  const calendarDays: { day: number; month: number; year: number; isCurrentMonth: boolean; dateStr: string }[] = []

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const m = currentMonth === 0 ? 11 : currentMonth - 1
    const y = currentMonth === 0 ? currentYear - 1 : currentYear
    calendarDays.push({
      day: d, month: m, year: y, isCurrentMonth: false,
      dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({
      day: d, month: currentMonth, year: currentYear, isCurrentMonth: true,
      dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    })
  }

  // Next month leading days
  const remaining = 7 - (calendarDays.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1
      const y = currentMonth === 11 ? currentYear + 1 : currentYear
      calendarDays.push({
        day: d, month: m, year: y, isCurrentMonth: false,
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      })
    }
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const getEventsForDate = (dateStr: string) => events.filter((e) => e.eventDate === dateStr)

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : []

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToPrevMonth}>
            <i className="fa-light fa-chevron-left" />
          </Button>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 min-w-[200px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <i className="fa-light fa-chevron-right" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Brand:</label>
          <Select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="w-48"
          >
            <option value="">All Brands</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </Select>

          {!gcalLoading && (
            gcalConnected ? (
              <div className="flex items-center gap-2 ml-2">
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200">
                  <i className="fa-light fa-check mr-1" />
                  Calendar Connected
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleDisconnectGcal} className="text-xs text-gray-500 dark:text-gray-400">
                  Disconnect
                </Button>
              </div>
            ) : (
              <a href="/api/google-calendar/connect" className="ml-2">
                <Button variant="outline" size="sm">
                  <i className="fa-brands fa-google mr-2" />
                  Connect Google Calendar
                </Button>
              </a>
            )
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          {DAY_NAMES.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, idx) => {
            const dayEvents = getEventsForDate(cell.dateStr)
            const isToday = cell.dateStr === todayStr

            return (
              <div
                key={idx}
                onClick={() => openDayDialog(cell.dateStr)}
                className={cn(
                  'min-h-[100px] sm:min-h-[120px] border-b border-r border-gray-100 dark:border-gray-800 p-1.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950',
                  !cell.isCurrentMonth && 'bg-gray-50 dark:bg-gray-950/50',
                  idx % 7 === 0 && 'border-l-0',
                )}
              >
                <div className={cn(
                  'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                  isToday && 'bg-cyan-700 text-white',
                  !isToday && cell.isCurrentMonth && 'text-gray-900 dark:text-gray-100',
                  !isToday && !cell.isCurrentMonth && 'text-gray-400',
                )}>
                  {cell.day}
                </div>

                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditForm(event)
                      }}
                      className="w-full text-left"
                    >
                      <div
                        className="text-[11px] leading-tight px-1.5 py-0.5 rounded truncate text-white font-medium"
                        style={{ backgroundColor: getEventTypeColor(event.eventType) }}
                      >
                        {event.title}
                      </div>
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 px-1.5">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {loading && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">Loading events...</div>
      )}

      {/* Day Detail Dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </DialogTitle>
            <DialogDescription>
              {selectedDateEvents.length === 0 ? 'No events scheduled' : `${selectedDateEvents.length} event${selectedDateEvents.length > 1 ? 's' : ''}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {selectedDateEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => openEditForm(event)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getEventTypeColor(event.eventType) }}
                  />
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{event.title}</span>
                </div>
                <div className="flex items-center gap-2 ml-[18px]">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {getEventTypeLabel(event.eventType)}
                  </Badge>
                  {event.eventTime && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{event.eventTime}</span>
                  )}
                  {event.companyName && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">{event.companyName}</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => selectedDate && openAddForm(selectedDate)}>
              <i className="fa-light fa-plus mr-2" />
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Form Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'New Event'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Update the event details below.' : 'Fill in the details to create a new calendar event.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cal-title">Title *</Label>
              <Input
                id="cal-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Event title"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cal-type">Event Type</Label>
                <Select
                  id="cal-type"
                  value={formData.eventType}
                  onChange={(e) => {
                    const type = e.target.value
                    const color = getEventTypeColor(type)
                    setFormData({ ...formData, eventType: type, color })
                  }}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="cal-brand">Brand</Label>
                <Select
                  id="cal-brand"
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                >
                  <option value="">None</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cal-date">Date *</Label>
                <Input
                  id="cal-date"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="cal-time">Time</Label>
                <Input
                  id="cal-time"
                  type="time"
                  value={formData.eventTime}
                  onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cal-desc">Description</Label>
              <Textarea
                id="cal-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="cal-status">Status</Label>
              <Select
                id="cal-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
                className="sm:mr-auto"
              >
                <i className="fa-light fa-trash mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setFormDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.title.trim()}>
              {saving ? 'Saving...' : editingEvent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
