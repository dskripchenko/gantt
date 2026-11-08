import type { GanttModel } from '../../src/index'

/** A product plan around 2026-11-05: three releases with their work items. */
export const TODAY = '2026-11-05'

export const plan: GanttModel = {
  rows: [
    { id: 'r1', kind: 'group', label: 'Release 1.4', milestones: [{ id: 'm1', date: '2026-11-20', label: '1.4', tone: 'warning' }] },
    { id: 'a', label: 'Webhooks v2', cells: { key: 'WEB-12', status: 'In progress', progress: '9 / 14' }, bars: [{ id: 'A', start: '2026-09-15', end: '2026-11-20', progress: 0.64 }] },
    { id: 'b', label: 'Failover', cells: { key: 'WEB-7', status: 'Overdue', progress: '6 / 15' }, bars: [{ id: 'B', start: '2026-09-01', end: '2026-10-31', progress: 0.4, tone: 'danger' }] },
    { id: 'c', label: 'Double charges', cells: { key: 'WEB-19', status: 'In progress', progress: '3 / 4' }, bars: [{ id: 'C', start: '2026-10-10', end: '2026-11-14', progress: 0.75 }] },
    { id: 'r2', kind: 'group', label: 'Release 1.5', milestones: [{ id: 'm2', date: '2026-12-18', label: '1.5', tone: 'neutral' }] },
    { id: 'd', label: 'Refunds', cells: { key: 'WEB-31', status: 'In progress', progress: '11 / 22' }, bars: [{ id: 'D', start: '2026-10-15', end: '2026-12-18', progress: 0.5 }] },
    { id: 'e', label: 'Merchant reports', cells: { key: 'WEB-40', status: 'Planned', progress: '1 / 8' }, bars: [{ id: 'E', start: '2026-11-03', end: '2026-12-10', progress: 0.13 }] },
    { id: 'r3', kind: 'group', label: 'Release 1.6', milestones: [{ id: 'm3', date: '2027-01-29', label: '1.6', tone: 'muted' }] },
    { id: 'f', label: 'QR payments', cells: { key: 'WEB-52', status: 'Planned', progress: '0 / 9' }, bars: [{ id: 'F', start: '2026-12-21', end: '2027-01-29', estimate: true }] },
    { id: 'g', label: 'Multi-currency payouts', cells: { key: 'WEB-55', status: 'Idea' }, bars: [{ id: 'G', start: '2027-01-11', end: '2027-02-26', estimate: true }] },
    { id: 'h', label: 'Tracing', cells: { key: 'WEB-58', status: 'Idea' } },
  ],
  links: [
    { id: 'l1', from: 'C', to: 'E' },
    { id: 'l2', from: 'A', to: 'F' },
  ],
}
