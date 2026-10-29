import { useState } from 'react'
import {
  ShieldCheck,
  User,
  Lock,
  Mail,
  Phone,
  BadgeCheck,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  LogIn,
  UserPlus,
  Loader2,
  DoorOpen,
  Smartphone,
} from 'lucide-react'
import { adminApi, setToken, type AuthUser } from '../../lib/auth'
import { QrCode } from './QrCode'

const GRAD = 'linear-gradient(150deg,#0a1a3f,#0d2a66 55%,#123b8c)'

/* The form card is light in BOTH themes, so its colours are fixed hex values rather than
   text-slate-* / bg-white — the app's dark theme remaps those classes globally. Same
   palette as the user door (AuthScreen). */
const INPUT_BOX =
  'mt-1 flex items-center gap-2 rounded-xl border border-[#d5ddea] bg-[#ffffff] px-3 focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#bfdbfe] transition'
const INPUT = 'flex-1 min-w-0 bg-transparent outline-none py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8]'
const LABEL = 'text-[13px] font-semibold text-[#334155]'
const MUTED_LINK = 'font-semibold text-[#64748b] hover:text-[#0b1530]'

function Field({
  icon,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  inputMode,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'email' | 'tel'
}) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <div className={INPUT_BOX}>
        <span className="text-[#7b8aa3] shrink-0">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          inputMode={inputMode}
          className={INPUT}
        />
      </div>
    </label>
  )
}

function PwField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <div className={INPUT_BOX}>
        <Lock size={16} className="text-[#7b8aa3] shrink-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} type={show ? 'text' : 'password'} className={INPUT} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-[#7b8aa3] hover:text-[#0b1530] shrink-0"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  )
}

function Primary({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2 rounded-xl text-white text-[15px] font-bold px-4 py-3.5 transition hover:brightness-110 active:brightness-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#bfdbfe]"
      style={{ background: 'linear-gradient(180deg,#1f6dff,#0756f2)', boxShadow: '0 14px 30px rgba(7,86,242,0.38), inset 0 1px 0 rgba(255,255,255,0.28)' }}
    >
      {children}
    </button>
  )
}

/**
 * The separate Admin door (#admin-login). Kept apart from the user login so admin
 * credentials never share a screen with everyday sign-ins.
 */
export function AdminAuthScreen({ onAuthed }: { onAuthed: (u: AuthUser) => void }) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Same plant photo as the user door; falls back to the dark gradient if absent.
  const [photoOk, setPhotoOk] = useState(true)

  const [lu, setLu] = useState('')
  const [lp, setLp] = useState('')
  const [lEmail, setLEmail] = useState('')
  const [lOtp, setLOtp] = useState('')

  const [rFull, setRFull] = useState('')
  const [rUser, setRUser] = useState('')
  const [rPw, setRPw] = useState('')
  const [rPw2, setRPw2] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPhone, setRPhone] = useState('')
  const [rEmp, setREmp] = useState('')
  const [rOtp, setROtp] = useState('')
  const [rStep, setRStep] = useState<'form' | 'otp'>('form')
  const [rSecret, setRSecret] = useState('')
  const [rQr, setRQr] = useState('')

  const wrap = async (fn: () => Promise<void>) => {
    setErr('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  /** Enter submits the step you're on (same behaviour as the user/QA login). */
  const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    const el = e.target as HTMLElement
    if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.tagName === 'A') return
    e.preventDefault()
    if (!busy) fn()
  }

  const doLogin = () =>
    wrap(async () => {
      const res = await adminApi.login({ username: lu, password: lp, email: lEmail, otp: lOtp })
      setToken(res.token)
      onAuthed(res.user)
    })

  const startTotp = () =>
    wrap(async () => {
      if (!rFull.trim()) throw new Error('Please enter the full name.')
      if (rPw !== rPw2) throw new Error('Passwords do not match.')
      if (rPw.length < 10) throw new Error('Admin password must be at least 10 characters.')
      if (!rEmail.trim()) throw new Error('Please enter an email.')
      const res = await adminApi.registerTotp({ username: rUser, email: rEmail })
      setRSecret(res.secret)
      setRQr(res.otpauthUrl)
      setRStep('otp')
    })

  const doRegister = () =>
    wrap(async () => {
      const res = await adminApi.register({
        fullName: rFull,
        username: rUser,
        password: rPw,
        email: rEmail,
        phone: rPhone,
        otp: rOtp,
        employeeId: rEmp,
      })
      setToken(res.token)
      onAuthed(res.user)
    })

  const features = [
    { icon: DoorOpen, label: 'Separate door from the user login' },
    { icon: KeyRound, label: '10-character password minimum' },
    { icon: Smartphone, label: '2-factor: email + Authenticator code' },
  ]

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden" style={{ background: GRAD }}>
      {/* Same plant photo and navy scrim as the user door, a shade heavier so this still
          reads as the restricted entrance. No photo -> the navy gradient shows. */}
      {photoOk && (
        <>
          <img
            src="/company.jpg"
            alt=""
            aria-hidden="true"
            className="fixed inset-0 w-full h-full object-cover"
            style={{ objectPosition: '50% 42%', filter: 'saturate(1.05)' }}
            onError={() => setPhotoOk(false)}
          />
          <div
            className="fixed inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(6,18,50,0.93) 0%, rgba(8,24,62,0.74) 30%, rgba(10,30,76,0.30) 54%, rgba(10,30,76,0.10) 72%),' +
                'linear-gradient(180deg, rgba(6,18,50,0.80) 0%, rgba(6,18,50,0.32) 18%, rgba(6,18,50,0.05) 36%, rgba(5,14,40,0.10) 80%, rgba(5,14,40,0.40) 100%)',
            }}
          />
        </>
      )}

      <div className="relative min-h-screen w-full flex flex-col">
        {/* brand bar */}
        <header className="flex items-center gap-4 xl:gap-[26px] px-5 sm:px-8 lg:px-12 xl:px-[60px] pt-6 lg:pt-10 xl:pt-[52px] text-white">
          <div
            className="w-12 h-12 xl:w-[66px] xl:h-[66px] rounded-[14px] grid place-items-center shrink-0 ring-1 ring-white/10"
            style={{ background: 'linear-gradient(160deg,#2559d6,#1a43ad)', boxShadow: '0 10px 26px rgba(4,14,40,0.45)', color: '#e8efff' }}
          >
            <ShieldCheck size={30} strokeWidth={2} />
          </div>
          <div>
            <div className="text-lg xl:text-[28px] font-bold leading-tight tracking-tight">Admin Console</div>
            <div className="text-[13px] xl:text-[20px] text-white/85 leading-snug">Morning Meeting</div>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] items-start gap-8 lg:gap-12 px-5 sm:px-8 lg:px-12 xl:pl-[60px] xl:pr-[95px] pt-8 lg:pt-10 xl:pt-[44px] 2xl:pt-[80px] pb-10">
          {/* hero copy */}
          <section className="text-white min-w-0 max-w-[720px]">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] xl:text-[13px] font-bold uppercase tracking-[0.12em] border border-[rgba(251,191,36,0.45)] text-[#fcd34d]"
              style={{ background: 'rgba(120,80,0,0.28)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            >
              <Lock size={13} strokeWidth={2.6} /> Admins only
            </span>
            <h1 className="mt-4 xl:mt-5 text-[38px] sm:text-[52px] lg:text-[50px] xl:text-[62px] 2xl:text-[76px] font-extrabold leading-[1.02] tracking-[-0.02em]">
              <span style={{ textShadow: '0 2px 18px rgba(0,0,0,0.30)' }}>Restricted</span>
              <br />
              <span
                style={{
                  backgroundImage: 'linear-gradient(90deg,#3b82f6,#22c3ff)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                access
              </span>
              <span>.</span>
            </h1>
            <p
              className="mt-5 xl:mt-7 text-white/95 text-base sm:text-lg lg:text-xl xl:text-[21px] 2xl:text-[24px] leading-[1.38] max-w-[640px]"
              style={{ textShadow: '0 1px 10px rgba(0,0,0,0.35)' }}
            >
              Admins can edit the machine register, correct shift data and remove reports. Everyone else stays read-only.
            </p>
            <ul className="mt-7 xl:mt-8 hidden sm:flex flex-col gap-3 xl:gap-[13px]">
              {features.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-4 xl:gap-[18px] self-start rounded-2xl px-5 xl:px-6 py-3 xl:py-[13px] border border-[rgba(125,175,255,0.34)]"
                  style={{
                    background: 'linear-gradient(180deg, rgba(16,40,92,0.62), rgba(10,28,70,0.62))',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px rgba(2,10,30,0.25)',
                  }}
                >
                  <Icon size={28} strokeWidth={1.9} className="shrink-0 text-[#2fd4f5]" />
                  <span className="text-[16px] xl:text-[19px] font-semibold">{label}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Form card - light frosted glass, same as the user door. */}
          <div className="w-full min-w-0 flex justify-center lg:justify-end lg:mt-4">
            <div
              className="relative w-full max-w-[520px] rounded-[26px] ring-1 ring-white/80"
              style={{
                background: 'linear-gradient(165deg, rgba(246,249,255,0.96), rgba(233,240,252,0.92))',
                backdropFilter: 'blur(22px) saturate(150%)',
                WebkitBackdropFilter: 'blur(22px) saturate(150%)',
                boxShadow: '0 30px 80px rgba(2,10,40,0.42), inset 0 1px 0 rgba(255,255,255,0.95)',
              }}
            >
              <div className="relative p-6 sm:p-8 xl:px-[42px] xl:py-[36px]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl grid place-items-center shrink-0 bg-[#e6eeff] text-[#1d5bf0]">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h2 className="text-[22px] xl:text-[26px] font-extrabold text-[#0b1226] tracking-[-0.01em] leading-tight">
                      {tab === 'login' ? 'Admin sign in' : rStep === 'form' ? 'Register an admin' : 'Set up 2-factor'}
                    </h2>
                    <p className="text-[13px] text-[#52607a]">
                      {tab === 'login'
                        ? 'Password, email and your Authenticator code.'
                        : rStep === 'form'
                          ? 'Details first, then link an Authenticator app.'
                          : 'Scan the QR code, then enter the 6-digit code.'}
                    </p>
                  </div>
                </div>

                <div role="tablist" aria-label="Admin access" className="grid grid-cols-2 rounded-xl bg-[#e6ecf6] p-1 mb-4">
                  {(['login', 'register'] as const).map((t) => {
                    const on = tab === t
                    return (
                      <button
                        key={t}
                        role="tab"
                        aria-selected={on}
                        onClick={() => {
                          setTab(t)
                          setErr('')
                        }}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#93c5fd] ${
                          on ? 'bg-[#ffffff] text-[#0a56f0] shadow-sm' : 'text-[#52607a] hover:text-[#0b1530]'
                        }`}
                      >
                        {t === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
                        {t === 'login' ? 'Admin Login' : 'Register Admin'}
                      </button>
                    )
                  })}
                </div>

                {err && (
                  <div role="alert" className="text-sm text-[#b91c1c] bg-[#fef2f2] ring-1 ring-[#fecaca] rounded-lg px-3 py-2 mb-4">
                    {err}
                  </div>
                )}

                {tab === 'login' && (
                  <div className="rise flex flex-col gap-3.5" onKeyDown={onEnter(doLogin)}>
                    <Field icon={<User size={16} />} label="User Name" value={lu} onChange={setLu} placeholder="admin123" />
                    <PwField label="Password" value={lp} onChange={setLp} />
                    <Field icon={<Mail size={16} />} label="Email" value={lEmail} onChange={setLEmail} type="email" inputMode="email" placeholder="admin@gmail.com" />
                    <Field icon={<KeyRound size={16} />} label="OTP (from Authenticator)" value={lOtp} onChange={setLOtp} inputMode="numeric" placeholder="123456" />
                    <Primary onClick={doLogin} busy={busy}>
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Admin Login
                    </Primary>
                    <a href="#login" className={`inline-flex items-center gap-1.5 text-sm ${MUTED_LINK}`}>
                      <ArrowLeft size={16} /> Back to user login
                    </a>
                  </div>
                )}

                {tab === 'register' && rStep === 'form' && (
                  <div className="rise flex flex-col gap-3.5" onKeyDown={onEnter(startTotp)}>
                    <Field icon={<User size={16} />} label="Full Name" value={rFull} onChange={setRFull} placeholder="Nikhil Rana" />
                    <Field icon={<User size={16} />} label="Admin User Name" value={rUser} onChange={setRUser} placeholder="admin123" />
                    <PwField label="Create Password (min 10 chars)" value={rPw} onChange={setRPw} />
                    <PwField label="Re-enter Password" value={rPw2} onChange={setRPw2} />
                    <Field icon={<Mail size={16} />} label="Email" value={rEmail} onChange={setREmail} type="email" inputMode="email" placeholder="admin@gmail.com" />
                    <Field icon={<Phone size={16} />} label="Phone Number" value={rPhone} onChange={setRPhone} inputMode="tel" placeholder="9876543210" />
                    <Field icon={<BadgeCheck size={16} />} label="Employee ID (optional)" value={rEmp} onChange={setREmp} placeholder="ADM-001" />
                    <Primary onClick={startTotp} busy={busy}>
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Continue
                    </Primary>
                    <a href="#login" className={`inline-flex items-center gap-1.5 text-sm ${MUTED_LINK}`}>
                      <ArrowLeft size={16} /> Back to user login
                    </a>
                  </div>
                )}

                {tab === 'register' && rStep === 'otp' && (
                  <div className="rise flex flex-col gap-4" onKeyDown={onEnter(doRegister)}>
                    <div className="flex gap-4 items-start flex-wrap sm:flex-nowrap">
                      <QrCode value={rQr} />
                      <div className="min-w-0 text-sm flex flex-col gap-2">
                        <div className="text-xs text-[#52607a]">Can't scan? Add the key manually:</div>
                        <code className="text-[11px] font-bold text-[#0b1530] bg-[#eef2f8] ring-1 ring-[#d5ddea] rounded-lg px-2 py-1.5 break-all leading-relaxed">
                          {rSecret}
                        </code>
                        <div className="text-xs text-[#64748b]">Account: {rEmail}</div>
                      </div>
                    </div>
                    <Field icon={<KeyRound size={16} />} label="Enter OTP (from Authenticator)" value={rOtp} onChange={setROtp} inputMode="numeric" placeholder="123456" />
                    <Primary onClick={doRegister} busy={busy}>
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Register Admin
                    </Primary>
                    <button onClick={() => setRStep('form')} className={`inline-flex items-center gap-1.5 text-sm self-start ${MUTED_LINK}`}>
                      <ArrowLeft size={16} /> Edit details
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
