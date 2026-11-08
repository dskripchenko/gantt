/**
 * Interface strings. English and Russian ship with the package; a host
 * passes `labels` to override any of them, or a whole dictionary for another
 * language. Dates are formatted with `Intl` in the chart's language.
 */
import type { LinkRefusal, Zoom } from '../index'

export interface GanttLabels {
  chart: string
  today: string
  zoom: string
  zooms: Record<Zoom, string>
  /** The quarter band and column: `Q3`. */
  quarter: (n: number) => string
  /** A week column: its first day of the month. */
  week: (date: number) => string
  empty: string
  noDates: string
  progress: (percent: number) => string
  estimate: string
  /** What a bar is announced with: its row, its dates and what else is known. */
  barAria: (row: string, from: string, to: string, extra: string) => string
  milestoneAria: (label: string, date: string) => string
  linkAria: (from: string, to: string) => string
  days: (n: number) => string
  /** The keyboard help of an editable bar. */
  barKeys: string
  milestoneKeys: string
  linkKeys: string
  linkHandle: string
  undo: string
  redo: string
  moved: (name: string, from: string, to: string) => string
  linked: (from: string, to: string) => string
  unlinked: (from: string, to: string) => string
  failed: string
  linkRefused: Record<LinkRefusal, string>
}

export const en: GanttLabels = {
  chart: 'Timeline',
  today: 'today',
  zoom: 'Scale',
  zooms: { day: 'Days', week: 'Weeks', month: 'Months', quarter: 'Quarters' },
  quarter: (n) => `Q${n}`,
  week: (date) => String(date),
  empty: 'Nothing to show',
  noDates: 'no dates',
  progress: (p) => `${p}% done`,
  estimate: 'estimated dates',
  barAria: (row, from, to, extra) => `${row}: ${from} – ${to}${extra ? `, ${extra}` : ''}`,
  milestoneAria: (label, date) => `${label}: ${date}`,
  linkAria: (from, to) => `${to} follows ${from}`,
  days: (n) => (n === 1 ? '1 day' : `${n} days`),
  barKeys: 'Arrows move by a day (Shift: a week); Alt with arrows changes the end, Alt+Shift the start; Enter opens',
  milestoneKeys: 'Arrows move by a day (Shift: a week)',
  linkKeys: 'Delete removes the link',
  linkHandle: 'Drag to another bar to link them',
  undo: 'Undo',
  redo: 'Redo',
  moved: (name, from, to) => `${name}: ${from} – ${to}`,
  linked: (from, to) => `${to} now follows ${from}`,
  unlinked: (from, to) => `${to} no longer follows ${from}`,
  failed: 'The change was not saved',
  linkRefused: { self: 'A bar cannot follow itself', unknown: 'Drop on a bar', duplicate: 'These bars are linked already', cycle: 'That link would close a loop' },
}

export const ru: GanttLabels = {
  chart: 'Шкала времени',
  today: 'сегодня',
  zoom: 'Масштаб',
  zooms: { day: 'Дни', week: 'Недели', month: 'Месяцы', quarter: 'Кварталы' },
  quarter: (n) => `Q${n}`,
  week: (date) => String(date),
  empty: 'Здесь пока пусто',
  noDates: 'без дат',
  progress: (p) => `готово ${p}%`,
  estimate: 'оценочные сроки',
  barAria: (row, from, to, extra) => `${row}: ${from} – ${to}${extra ? `, ${extra}` : ''}`,
  milestoneAria: (label, date) => `${label}: ${date}`,
  linkAria: (from, to) => `${to} после ${from}`,
  days: (n) => {
    const m10 = n % 10
    const m100 = n % 100
    const word = m10 === 1 && m100 !== 11 ? 'день' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'дня' : 'дней'
    return `${n} ${word}`
  },
  barKeys: 'Стрелки сдвигают на день (Shift — на неделю); Alt со стрелками меняет конец, Alt+Shift — начало; Enter открывает',
  milestoneKeys: 'Стрелки сдвигают на день (Shift — на неделю)',
  linkKeys: 'Delete удаляет связь',
  linkHandle: 'Перетащите на другую полосу, чтобы связать',
  undo: 'Отменить',
  redo: 'Повторить',
  moved: (name, from, to) => `${name}: ${from} – ${to}`,
  linked: (from, to) => `${to} теперь после ${from}`,
  unlinked: (from, to) => `${to} больше не ждёт ${from}`,
  failed: 'Изменение не сохранено',
  linkRefused: { self: 'Полоса не может ждать саму себя', unknown: 'Отпустите на полосе', duplicate: 'Эти полосы уже связаны', cycle: 'Такая связь замкнёт круг' },
}

export const LOCALES: Record<string, GanttLabels> = { en, ru }

/** The dictionary of a language (`ru-RU` → Russian, anything unknown → English) with overrides on top. */
export function resolveLabels(lang: string | undefined, overrides?: Partial<GanttLabels>): GanttLabels {
  const base = LOCALES[(lang ?? '').toLowerCase().split('-')[0] ?? ''] ?? en
  return overrides ? { ...base, ...overrides } : base
}
