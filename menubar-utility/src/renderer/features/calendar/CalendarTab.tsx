import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, Bell, Clock } from 'lucide-react';
import { useI18n } from '../../hooks/useI18n';
import { useCalendarStore } from './useCalendarStore';
import type { CreateEventDto, CalendarEvent } from '../../../shared/types/calendar.types';

export default function CalendarTab() {
  const { t, locale } = useI18n();
  const {
    events, todayAlerts, selectedDate, currentYear, currentMonth,
    showEventForm, editingEvent,
    fetchEvents, fetchTodayAlerts, setSelectedDate, navigateMonth,
    setShowEventForm, setEditingEvent, createEvent, updateEvent, deleteEvent,
    snoozeEvent,
  } = useCalendarStore();

  const [alertsExpanded, setAlertsExpanded] = useState(false);

  useEffect(() => { fetchEvents(); fetchTodayAlerts(); }, []);

  const dayNames = locale === 'ko'
    ? ['일', '월', '화', '수', '목', '금', '토']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
  const today = new Date().toISOString().split('T')[0];

  const selectedEvents = events.filter(e => e.eventDate === selectedDate);

  const getEventCountForDay = (day: number) => {
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.eventDate === date).length;
  };

  const monthLabel = locale === 'ko'
    ? `${currentYear}년 ${currentMonth}월`
    : `${currentYear}. ${String(currentMonth).padStart(2, '0')}`;

  const handleSnooze = async (eventId: string, minutes: number) => {
    await snoozeEvent(eventId, minutes);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Today alerts banner */}
      {todayAlerts.length > 0 && (
        <div className="bg-[var(--warning)]/10 border-b border-[var(--warning)]/20">
          <button
            onClick={() => setAlertsExpanded(!alertsExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--warning)] text-[11px] font-medium"
          >
            <Bell size={12} />
            <span className="flex-1 text-left">{t('calendar.todayAlerts', { count: todayAlerts.length })}</span>
            <ChevronDown size={12} className={`transition-transform ${alertsExpanded ? 'rotate-180' : ''}`} />
          </button>
          {alertsExpanded && (
            <div className="px-3 pb-2 space-y-1.5">
              {todayAlerts.map(alert => (
                <div key={alert.id} className="flex items-center gap-2 bg-[var(--bg)] rounded-md px-2 py-1.5">
                  <Clock size={11} className="text-[var(--warning)] shrink-0" />
                  <span className="text-[11px] font-mono text-[var(--warning)]">{alert.eventTime}</span>
                  <span className="text-[11px] flex-1 truncate">{alert.title}</span>
                  <div className="flex gap-1 shrink-0">
                    {[5, 15, 30].map(min => (
                      <button
                        key={min}
                        onClick={() => handleSnooze(alert.id, min)}
                        className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--warning)]/15 text-[var(--warning)] rounded hover:bg-[var(--warning)]/25 transition-colors"
                      >
                        {t(`calendar.snooze${min}` as any)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-[var(--surface)] rounded">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{monthLabel}</span>
          {(selectedDate !== today || currentYear !== new Date().getFullYear() || currentMonth !== new Date().getMonth() + 1) && (
            <button
              onClick={() => {
                const n = new Date();
                useCalendarStore.setState({
                  currentYear: n.getFullYear(),
                  currentMonth: n.getMonth() + 1,
                  selectedDate: n.toISOString().split('T')[0],
                });
                fetchEvents();
                fetchTodayAlerts();
              }}
              className="px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)] bg-[var(--primary)]/10 rounded hover:bg-[var(--primary)]/20 transition-colors"
            >
              {t('calendar.today')}
            </button>
          )}
        </div>
        <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-[var(--surface)] rounded">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="px-2 py-1">
        <div className="grid grid-cols-7 gap-0">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[10px] text-[var(--text-secondary)] py-1">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const eventCount = getEventCountForDay(day);

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(date)}
                className={`relative w-full aspect-square flex flex-col items-center justify-center text-[12px] rounded-lg transition-colors
                  ${isSelected ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--surface)]'}
                  ${isToday && !isSelected ? 'font-bold text-[var(--primary)]' : ''}
                `}
              >
                {day}
                {eventCount > 0 && (
                  <div className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[var(--primary)]'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      <div className="flex-1 border-t border-[var(--border)] overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            {selectedDate} ({selectedEvents.length})
          </span>
          <button onClick={() => setShowEventForm(true)} className="text-[var(--primary)]">
            <Plus size={14} />
          </button>
        </div>
        {selectedEvents.map(event => (
          <div
            key={event.id}
            onClick={() => setEditingEvent(event)}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--surface)] cursor-pointer"
          >
            <span className="text-[11px] font-mono text-[var(--primary)]">{event.eventTime}</span>
            <span className="text-[12px] flex-1 truncate">{event.title}</span>
            {event.repeatType !== 'none' && (
              <span className="text-[9px] px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full">
                {t(`calendar.${event.repeatType}` as any)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Event form */}
      {showEventForm && (
        <EventForm
          selectedDate={selectedDate}
          existingEvent={editingEvent}
          onSave={async (data) => {
            if (editingEvent) await updateEvent(editingEvent.id, data);
            else await createEvent(data as CreateEventDto);
            setShowEventForm(false);
            setEditingEvent(null);
          }}
          onDelete={editingEvent ? async () => {
            await deleteEvent(editingEvent.id);
            setShowEventForm(false);
            setEditingEvent(null);
          } : undefined}
          onClose={() => { setShowEventForm(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}

function EventForm({ selectedDate, existingEvent, onSave, onDelete, onClose }: {
  selectedDate: string;
  existingEvent: CalendarEvent | null;
  onSave: (data: CreateEventDto) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState(existingEvent?.title ?? '');
  const [memo, setMemo] = useState(existingEvent?.memo ?? '');
  const [date, setDate] = useState(existingEvent?.eventDate ?? selectedDate);
  const [time, setTime] = useState(existingEvent?.eventTime ?? '09:00');
  const [repeatType, setRepeatType] = useState(existingEvent?.repeatType ?? 'none');
  const [alertBefore, setAlertBefore] = useState(existingEvent?.alertBefore ?? 0);

  return (
    <div className="absolute inset-x-0 bottom-0 bg-[var(--bg)] border-t border-[var(--border)] p-3 shadow-lg z-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{existingEvent ? t('calendar.editEvent') : t('calendar.newEvent')}</h3>
        <button onClick={onClose}><X size={16} /></button>
      </div>
      <div className="space-y-2">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('calendar.eventTitle')} autoFocus className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
        <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder={t('calendar.eventMemo')} rows={2} className="w-full px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md resize-none" />
        <div className="flex gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md" />
        </div>
        <div className="flex gap-2">
          <select value={repeatType} onChange={e => setRepeatType(e.target.value as CalendarEvent['repeatType'])} className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md">
            <option value="none">{t('calendar.noRepeat')}</option>
            <option value="daily">{t('calendar.daily')}</option>
            <option value="weekly">{t('calendar.weekly')}</option>
            <option value="monthly">{t('calendar.monthly')}</option>
          </select>
          <select value={alertBefore} onChange={e => setAlertBefore(Number(e.target.value))} className="flex-1 px-2.5 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded-md">
            <option value={0}>{t('calendar.atTime')}</option>
            <option value={5}>{t('calendar.minBefore', { min: 5 })}</option>
            <option value={15}>{t('calendar.minBefore', { min: 15 })}</option>
            <option value={30}>{t('calendar.minBefore', { min: 30 })}</option>
          </select>
        </div>
        <div className="flex gap-2">
          {onDelete && (
            <button onClick={onDelete} className="flex-1 py-1.5 text-sm text-[var(--danger)] border border-[var(--danger)] rounded-md">{t('common.delete')}</button>
          )}
          <button onClick={() => onSave({ title, memo, eventDate: date, eventTime: time, repeatType, alertBefore })} disabled={!title.trim()} className="flex-1 py-1.5 text-sm font-medium text-white bg-[var(--primary)] rounded-md disabled:opacity-40">
            {existingEvent ? t('calendar.update') : t('calendar.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
