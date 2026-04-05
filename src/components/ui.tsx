'use client'
import { type ReactNode } from 'react'
import clsx from 'clsx'

/* ── Button ── */
interface BtnProps {
  children: ReactNode
  onClick?: () => void
  teal?: boolean
  danger?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  className?: string
}
export function Btn({ children, onClick, teal, danger, type = 'button', disabled, className }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={clsx(
        'rounded-2xl px-5 py-3 text-sm font-semibold transition-all cursor-pointer',
        teal && 'bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50',
        danger && 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100',
        !teal && !danger && 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
        className
      )}>
      {children}
    </button>
  )
}

/* ── Badge ── */
export function Badge({ label, className }: { label: string; className?: string }) {
  return <span className={clsx('rounded-full border px-3 py-1 text-xs font-semibold', className)}>{label}</span>
}

/* ── Form Field ── */
interface FieldProps {
  label: string
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  wide?: boolean
  readOnly?: boolean
}
export function Field({ label, value, onChange, placeholder, type = 'text', required, wide, readOnly }: FieldProps) {
  return (
    <label className={clsx('block', wide && 'col-span-2')}>
      <div className="mb-1.5 text-sm font-medium text-slate-600">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</div>
      <input type={type} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} required={required} readOnly={readOnly}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 transition-colors"
        style={{ cursor: readOnly ? 'default' : 'text' }} />
    </label>
  )
}

/* ── Select Field ── */
interface SelProps {
  label: string
  value?: string
  onChange?: (v: string) => void
  options: { value: string; label: string }[]
  wide?: boolean
}
export function SelField({ label, value, onChange, options, wide }: SelProps) {
  return (
    <label className={clsx('block', wide && 'col-span-2')}>
      <div className="mb-1.5 text-sm font-medium text-slate-600">{label}</div>
      <select value={value} onChange={e => onChange?.(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition-colors">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

/* ── Textarea ── */
export function TextArea({ label, value, onChange, placeholder, wide }: Omit<FieldProps, 'type'>) {
  return (
    <label className={clsx('block', wide && 'col-span-2')}>
      <div className="mb-1.5 text-sm font-medium text-slate-600">{label}</div>
      <textarea value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} rows={3}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none transition-colors" />
    </label>
  )
}

/* ── Checkbox ── */
export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-teal-700" />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}

/* ── Section Card ── */
export function SectionCard({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mt-5">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          {sub && <p className="text-base text-slate-500 mt-1">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/* ── Modal ── */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-7 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none cursor-pointer bg-transparent border-none">✕</button>
        </div>
        <div className="p-7 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
