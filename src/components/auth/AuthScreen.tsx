import { useState } from 'react'
import {
  Columns2,
  Crosshair,
  FileText,
  User,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  KeyRound,
  LogIn,
  UserPlus,
  ShieldCheck,
  Loader2,
  BadgeCheck,
} from 'lucide-react'
import { authApi, qaApi, setToken, type AuthUser } from '../../lib/auth'
import { useT } from '../../lib/i18n'

type Mode = 'start' | 'choose' | 'login' | 'register' | 'forgot'

const GRAD = 'linear-gradient(150deg,#0a1a3f,#0d2a66 55%,#123b8c)'

/* The form card is light in BOTH themes, so its colours are fixed hex values rather than
   text-slate-* / bg-white — the app's dark theme remaps those classes globally. */
const INPUT_BOX =
  'mt-1 flex items-center gap-2 rounded-xl border border-[#d5ddea] bg-[#ffffff] px-3 focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#bfdbfe] transition'
const INPUT = 'flex-1 min-w-0 bg-transparent outline-none py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8]'
const LABEL = 'text-[13px] font-semibold text-[#334155]'
const H2 = 'text-2xl font-extrabold text-[#0b1530]'
const SUB = 'text-[#52607a]'
const LINK = 'font-semibold text-[#1d5bf0] hover:text-[#0b3fc4]'
const MUTED_LINK = 'font-semibold text-[#64748b] hover:text-[#0b1530]'

/** App mark: an "M" drawn as a chart line inside an axis corner. */
function AppMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 3v17.5H21" />
      <path d="M7.5 16.5V7l4.5 6 4.5-6v9.5" />
    </svg>
  )
}

function newCaptcha() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join('')
}

function Field({
  icon,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'email' | 'tel'
}) {
  const t = useT()
  return (
    <label className="block">
      <span className={LABEL}>{t(label)}</span>
      <div className={INPUT_BOX}>
        <span className="text-[#7b8aa3] shrink-0">{icon}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className={INPUT}
        />
      </div>
    </label>
  )
}

function PwField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  const t = useT()
  return (
    <label className="block">
      <span className={LABEL}>{t(label)}</span>
      <div className={INPUT_BOX}>
        <Lock size={16} className="text-[#7b8aa3] shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={INPUT}
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="text-[#7b8aa3] hover:text-[#0b1530] shrink-0" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  )
}

function Primary({
  children,
  onClick,
  loading,
  disabled,
  big,
}: {
  children: React.ReactNode
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  /** The landing call-to-action: taller, larger label. */
  big?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full inline-flex items-center justify-center gap-2.5 rounded-xl text-white font-bold px-4 transition hover:brightness-110 active:brightness-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#bfdbfe] ${
        big ? 'py-4 text-[17px] xl:text-[20px] xl:py-[17px]' : 'py-3.5 text-[15px]'
      }`}
      style={{ background: 'linear-gradient(180deg,#1f6dff,#0756f2)', boxShadow: '0 14px 30px rgba(7,86,242,0.38), inset 0 1px 0 rgba(255,255,255,0.28)' }}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : children}
    </button>
  )
}

function Alert({ msg }: { msg: string }) {
  return <div role="alert" className="text-sm text-[#b91c1c] bg-[#fef2f2] ring-1 ring-[#fecaca] rounded-lg px-3 py-2">{msg}</div>
}
function Info({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-[#92400e] bg-[#fffbeb] ring-1 ring-[#fde68a] rounded-lg px-3 py-2">{children}</div>
  )
}

export function AuthScreen({
  onAuthed,
  variant = 'user',
}: {
  onAuthed: (u: AuthUser) => void
  /** 'qa' swaps the login/register endpoints to the QA door (same UI, different accounts). */
  variant?: 'user' | 'qa'
}) {
  const isQa = variant === 'qa'
  const t = useT()
  const [mode, setMode] = useState<Mode>(isQa ? 'login' : 'start')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // Plant photo behind the branding panel; falls back to the plain gradient if absent.
  const [photoOk, setPhotoOk] = useState(true)

  // register
  const [rFull, setRFull] = useState('')
  const [rUser, setRUser] = useState('')
  const [rPw, setRPw] = useState('')
  const [rPw2, setRPw2] = useState('')
  const [rEmail, setREmail] = useState('')
  const [rPhone, setRPhone] = useState('')
  const [rEmp, setREmp] = useState('')
  const [rOtp, setROtp] = useState('')
  const [rStep, setRStep] = useState<'form' | 'otp'>('form')
  const [rDev, setRDev] = useState('')

  // login
  const [lUser, setLUser] = useState('')
  const [lPw, setLPw] = useState('')
  const [captcha, setCaptcha] = useState(newCaptcha)
  const [lCap, setLCap] = useState('')

  // forgot
  const [fUser, setFUser] = useState('')
  const [fEmail, setFEmail] = useState('')
  const [fOtp, setFOtp] = useState('')
  const [fPw, setFPw] = useState('')
  const [fStep, setFStep] = useState<'verify' | 'reset'>('verify')
  const [fMethod, setFMethod] = useState<'email' | 'totp'>('email')
  const [fDev, setFDev] = useState('')

  const go = (m: Mode) => {
    setErr('')
    setMode(m)
  }

  /**
   * Enter submits the step you're on (desktop convenience). Attached to each step's
   * wrapper so a keypress inside any of its inputs runs that step's primary action.
   */
  const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    const el = e.target as HTMLElement
    if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.tagName === 'A') return
    e.preventDefault()
    if (!busy) fn()
  }
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

  // ---- actions ----
  const sendRegOtp = () =>
    wrap(async () => {
      if (!rFull.trim()) throw new Error('Please enter your full name.')
      if (rPw !== rPw2) throw new Error('Passwords do not match.')
      if (rPw.length < 6) throw new Error('Password must be at least 6 characters.')
      if (!rEmail.trim()) throw new Error('Please enter your email.')
      const res = await authApi.registerOtp({ username: rUser, email: rEmail })
      setRDev(res.devOtp || '')
      setRStep('otp')
    })
  const doRegister = () =>
    wrap(async () => {
      const payload = {
        fullName: rFull,
        username: rUser,
        password: rPw,
        email: rEmail,
        phone: rPhone,
        otp: rOtp,
        employeeId: rEmp,
      }
      const res = isQa ? await qaApi.register(payload) : await authApi.register(payload)
      setToken(res.token)
      onAuthed(res.user)
    })
  const doLogin = () =>
    wrap(async () => {
      if (lCap.trim().toUpperCase() !== captcha) {
        setCaptcha(newCaptcha())
        setLCap('')
        throw new Error('Captcha does not match.')
      }
      const res = isQa
        ? await qaApi.login({ username: lUser, password: lPw })
        : await authApi.login({ username: lUser, password: lPw })
      setToken(res.token)
      onAuthed(res.user)
    })
  const sendForgotOtp = () =>
    wrap(async () => {
      const res = await authApi.forgotVerify({ username: fUser, email: fEmail })
      setFMethod(res.method)
      setFDev(res.devOtp || '')
      setFStep('reset')
    })
  const doReset = () =>
    wrap(async () => {
      await authApi.reset({ username: fUser, otp: fOtp, password: fPw })
      setFStep('verify')
      setFOtp('')
      setFPw('')
      go('login')
      setErr('')
      setLUser(fUser)
    })

  const headline = t('Run a sharper morning meeting.')
  // English splits so "morning meeting." can carry the accent gradient; translations
  // render whole, since the phrase does not split at the same place in Hindi/Gujarati.
  const english = headline === 'Run a sharper morning meeting.'
  const features = [
    { icon: Columns2, label: 'Shift 1 & Shift 2 side by side' },
    { icon: Crosshair, label: 'Priority machines & repeating issues' },
    { icon: FileText, label: 'Notes, remarks & meeting history' },
  ]
  const accent = {
    backgroundImage: 'linear-gradient(90deg,#3b82f6,#22c3ff)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  } as const

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden" style={{ background: GRAD }}>
      {/* Full-screen plant photo under a navy scrim: heavy across the top sky and down the
          left for the white copy, light on the right so the plant shows behind the card.
          No photo -> the navy gradient shows. */}
      {photoOk && (
        <>
          <img
            src="/company.jpg"
            alt=""
            aria-hidden="true"
            className="fixed inset-0 w-full h-full object-cover"
            style={{ objectPosition: '50% 42%', filter: 'saturate(1.08) brightness(1.04)' }}
            onError={() => setPhotoOk(false)}
          />
          {/* Navy only where copy sits: a band down the left and across the sky. The plant
              on the right stays bright, as in the design. */}
          <div
            className="fixed inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(7,22,58,0.90) 0%, rgba(9,28,70,0.66) 28%, rgba(10,32,80,0.18) 50%, rgba(10,32,80,0) 66%),' +
                'linear-gradient(180deg, rgba(8,22,60,0.78) 0%, rgba(8,22,60,0.30) 17%, rgba(8,22,60,0) 34%, rgba(5,16,44,0) 82%, rgba(5,16,44,0.28) 100%)',
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
            <AppMark size={30} />
          </div>
          <div>
            <div className="text-lg xl:text-[28px] font-bold leading-tight tracking-tight">{t('Morning Meeting')}</div>
            <div className="text-[13px] xl:text-[20px] text-white/85 leading-snug">{t('Production Dashboard')}</div>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)] items-start gap-8 lg:gap-12 px-5 sm:px-8 lg:px-12 xl:pl-[60px] xl:pr-[95px] pt-10 lg:pt-16 xl:pt-[92px] pb-10">
          {/* hero copy */}
          <section className="text-white min-w-0 max-w-[720px]">
            <h1
              className="text-[38px] sm:text-[52px] lg:text-[50px] xl:text-[62px] 2xl:text-[76px] font-extrabold leading-[1.02] tracking-[-0.02em]"
              style={{ textShadow: english ? undefined : '0 2px 18px rgba(0,0,0,0.35)' }}
            >
              {english ? (
                <>
                  <span style={{ textShadow: '0 2px 18px rgba(0,0,0,0.30)' }}>Run a sharper</span>
                  <br />
                  <span style={accent}>morning meeting</span>
                  <span>.</span>
                </>
              ) : (
                headline
              )}
            </h1>
            <p
              className="mt-5 xl:mt-7 text-white/95 text-base sm:text-lg lg:text-xl xl:text-[21px] 2xl:text-[24px] leading-[1.38] max-w-[640px]"
              style={{ textShadow: '0 1px 10px rgba(0,0,0,0.35)' }}
            >
              {t('Upload the shift report, see every machine below target first, and act on the biggest losses — on any device.')}
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
                  <Icon size={30} strokeWidth={1.9} className="shrink-0 text-[#2fd4f5]" />
                  <span className="text-[16px] xl:text-[19.5px] font-semibold tracking-[-0.005em]">{t(label)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Form card - light frosted glass; the plant shows faintly through it. */}
          <div className="w-full min-w-0 flex justify-center lg:justify-end lg:mt-12 xl:mt-[52px]">
            <div
              className="relative w-full max-w-[540px] rounded-[26px] ring-1 ring-white/80"
              style={{
                background: 'linear-gradient(165deg, rgba(246,249,255,0.95), rgba(233,240,252,0.90))',
                backdropFilter: 'blur(22px) saturate(150%)',
                WebkitBackdropFilter: 'blur(22px) saturate(150%)',
                boxShadow: '0 30px 80px rgba(2,10,40,0.40), inset 0 1px 0 rgba(255,255,255,0.95)',
              }}
            >
              <div className="relative p-6 sm:p-9 xl:px-[46px] xl:py-[40px]">
          {/* ---- START ---- */}
          {mode === 'start' && (
            <div className="rise" onKeyDown={onEnter(() => go('choose'))}>
              <h2 className="text-[32px] xl:text-[40px] font-extrabold text-[#0b1226] tracking-[-0.02em] leading-tight">{t('Welcome 👋')}</h2>
              <p className="mt-4 xl:mt-5 text-[16px] xl:text-[19.5px] leading-[1.5] text-[#3d4a63]">{t("Your factory's morning meeting, organized. Let's get you signed in.")}</p>
              <div className="mt-6 xl:mt-[22px]">
                <Primary big onClick={() => go('choose')}>
                  {t('Get Started')} <ArrowRight size={22} strokeWidth={2.4} />
                </Primary>
              </div>
            </div>
          )}

          {/* ---- CHOOSE ---- */}
          {mode === 'choose' && (
            <div className="rise" onKeyDown={onEnter(() => go('login'))}>
              <h2 className={H2}>{t('Continue')}</h2>
              <p className={`mt-2 ${SUB}`}>{t('Log in to your account, or create a new one.')}</p>
              <div className="mt-8 flex flex-col gap-3">
                <Primary onClick={() => go('login')}>
                  <LogIn size={18} /> {t('Login')}
                </Primary>
                <button
                  onClick={() => go('register')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffffff] ring-1 ring-[#d5ddea] hover:ring-[#2563eb] hover:text-[#0a56f0] text-[#0b1530] font-bold px-4 py-3.5 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#bfdbfe]"
                >
                  <UserPlus size={18} /> {t('Register')}
                </button>
              </div>
              <button onClick={() => go('start')} className={`mt-6 inline-flex items-center gap-1.5 text-sm ${MUTED_LINK}`}>
                <ArrowLeft size={16} /> {t('Back')}
              </button>
            </div>
          )}

          {/* ---- LOGIN ---- */}
          {mode === 'login' && (
            <div className="rise flex flex-col gap-4" onKeyDown={onEnter(doLogin)}>
              <div>
                <h2 className={H2}>{isQa ? t('QA Login') : t('Login')}</h2>
                <p className={`mt-1 text-sm ${SUB}`}>
                  {isQa ? t('Quality portal — sign in to upload reports.') : t('Welcome back — enter your details.')}
                </p>
              </div>
              {err && <Alert msg={err} />}
              <Field icon={<User size={16} />} label="User Name" value={lUser} onChange={setLUser} autoComplete="username" placeholder="nikhil123" />
              <PwField label="Password" value={lPw} onChange={setLPw} autoComplete="current-password" />
              {/* captcha */}
              <div>
                <span className={LABEL}>{t('Captcha')}</span>
                <div className="mt-1 flex items-center gap-2">
                  {/* Kept high-contrast on purpose — a captcha has to stay easy to read. */}
                  <div
                    className="select-none px-4 py-2.5 rounded-xl font-extrabold text-lg tracking-[0.35em] text-slate-800 ring-1 ring-[#c7d2fe]"
                    style={{
                      background: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.92),rgba(255,255,255,0.92) 6px,rgba(224,231,255,0.92) 6px,rgba(224,231,255,0.92) 12px)',
                      fontStyle: 'italic',
                      textDecoration: 'line-through',
                    }}
                  >
                    {captcha}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCaptcha(newCaptcha())}
                    className="w-10 h-10 grid place-items-center rounded-xl border border-[#d5ddea] bg-[#ffffff] text-[#64748b] hover:text-[#0a56f0] hover:border-[#2563eb] shrink-0"
                    title="New captcha"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <input
                    value={lCap}
                    onChange={(e) => setLCap(e.target.value.toUpperCase())}
                    placeholder={t('Type it')}
                    className="flex-1 min-w-0 rounded-xl border border-[#d5ddea] bg-[#ffffff] px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] uppercase tracking-wider"
                  />
                </div>
              </div>
              <Primary onClick={doLogin} loading={busy}>
                <LogIn size={18} /> {t('Login')}
              </Primary>
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => go('forgot')} className={LINK}>
                  {t('Forgot password?')}
                </button>
                <button onClick={() => go('register')} className={MUTED_LINK}>
                  {t('Create account')}
                </button>
              </div>
              <div className="pt-1 border-t border-[#e2e8f0]">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => (isQa ? (window.location.hash = '') : go('choose'))}
                    className={`inline-flex items-center gap-1.5 text-sm mt-3 ${MUTED_LINK}`}
                  >
                    <ArrowLeft size={16} /> {t('Back')}
                  </button>
                  {!isQa && (
                    <a
                      href="#admin-login"
                      className={`inline-flex items-center gap-1.5 text-sm mt-3 ${LINK}`}
                      title="Admins sign in on a separate page"
                    >
                      <ShieldCheck size={15} /> {t('Admin login')}
                    </a>
                  )}
                </div>
                {/* QA login — left side, below the Back button (user door only).
                    Kept plain & muted so it doesn't stand out. */}
                {!isQa && (
                  <div className="mt-2">
                    <a
                      href="#qa-login"
                      className={`text-sm ${MUTED_LINK}`}
                      title="Quality (QA) team signs in on a separate page"
                    >
                      QA
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- REGISTER ---- */}
          {mode === 'register' && rStep === 'form' && (
            <div className="rise flex flex-col gap-3.5" onKeyDown={onEnter(sendRegOtp)}>
              <div>
                <h2 className={H2}>{t('Create account')}</h2>
                <p className={`mt-1 text-sm ${SUB}`}>{t("We'll send an OTP to your phone to verify.")}</p>
              </div>
              {err && <Alert msg={err} />}
              <Field icon={<User size={16} />} label="Full Name" value={rFull} onChange={setRFull} placeholder="Nikhil Rana" autoComplete="name" />
              <Field icon={<User size={16} />} label="Unique User Name" value={rUser} onChange={setRUser} placeholder="nikhil123" autoComplete="username" />
              <PwField label="Create Password" value={rPw} onChange={setRPw} autoComplete="new-password" />
              <PwField label="Re-enter Password" value={rPw2} onChange={setRPw2} autoComplete="new-password" />
              <Field icon={<Mail size={16} />} label="Email" value={rEmail} onChange={setREmail} type="email" placeholder="abcd@gmail.com" inputMode="email" autoComplete="email" />
              <Field icon={<Phone size={16} />} label="Phone Number" value={rPhone} onChange={setRPhone} inputMode="tel" placeholder="9876543210" autoComplete="tel" />
              <Field icon={<BadgeCheck size={16} />} label="Employee ID (optional)" value={rEmp} onChange={setREmp} placeholder="EMP-001" />
              <Primary onClick={sendRegOtp} loading={busy}>
                {t('Send OTP')} <ArrowRight size={18} />
              </Primary>
              <button onClick={() => go(isQa ? 'login' : 'choose')} className={`inline-flex items-center gap-1.5 text-sm ${MUTED_LINK}`}>
                <ArrowLeft size={16} /> {t('Back')}
              </button>
            </div>
          )}
          {mode === 'register' && rStep === 'otp' && (
            <div className="rise flex flex-col gap-4" onKeyDown={onEnter(doRegister)}>
              <div>
                <h2 className={H2}>{t('Verify your email')}</h2>
                <p className={`mt-1 text-sm ${SUB}`}>
                  {t('Enter the 6-digit OTP sent to')} <b>{rEmail}</b>.
                </p>
              </div>
              {err && <Alert msg={err} />}
              {rDev && (
                <Info>
                  Demo OTP: <b className="tracking-widest">{rDev}</b> — email service not configured yet, so it's shown
                  here.
                </Info>
              )}
              <Field icon={<KeyRound size={16} />} label="Enter OTP" value={rOtp} onChange={setROtp} inputMode="numeric" placeholder="123456" />
              <Primary onClick={doRegister} loading={busy}>
                <ShieldCheck size={18} /> {t('Register')}
              </Primary>
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => setRStep('form')} className={`inline-flex items-center gap-1.5 ${MUTED_LINK}`}>
                  <ArrowLeft size={16} /> {t('Edit details')}
                </button>
                <button onClick={sendRegOtp} className={LINK} disabled={busy}>
                  {t('Resend OTP')}
                </button>
              </div>
            </div>
          )}

          {/* ---- FORGOT ---- */}
          {mode === 'forgot' && fStep === 'verify' && (
            <div className="rise flex flex-col gap-4" onKeyDown={onEnter(sendForgotOtp)}>
              <div>
                <h2 className={H2}>{t('Forgot password')}</h2>
                <p className={`mt-1 text-sm ${SUB}`}>{t('Verify your account to reset the password.')}</p>
              </div>
              {err && <Alert msg={err} />}
              <Field icon={<User size={16} />} label="User Name" value={fUser} onChange={setFUser} placeholder="nikhil123" />
              <Field icon={<Mail size={16} />} label="Email ID" value={fEmail} onChange={setFEmail} type="email" inputMode="email" placeholder="abcd@gmail.com" />
              <Primary onClick={sendForgotOtp} loading={busy}>
                {t('Verify')} <ArrowRight size={18} />
              </Primary>
              <button onClick={() => go('login')} className={`inline-flex items-center gap-1.5 text-sm ${MUTED_LINK}`}>
                <ArrowLeft size={16} /> {t('Back to login')}
              </button>
            </div>
          )}
          {mode === 'forgot' && fStep === 'reset' && (
            <div className="rise flex flex-col gap-4" onKeyDown={onEnter(doReset)}>
              <div>
                <h2 className={H2}>{t('Reset password')}</h2>
                <p className={`mt-1 text-sm ${SUB}`}>
                  {fMethod === 'totp' ? (
                    <>Open your <b>Authenticator app</b>, enter the current 6-digit code and a new password.</>
                  ) : (
                    <>Enter the 6-digit OTP sent to <b>{fEmail}</b> and a new password.</>
                  )}
                </p>
              </div>
              {err && <Alert msg={err} />}
              {fDev && (
                <Info>
                  Demo OTP: <b className="tracking-widest">{fDev}</b> — email service not configured yet.
                </Info>
              )}
              <Field icon={<KeyRound size={16} />} label="Enter OTP" value={fOtp} onChange={setFOtp} inputMode="numeric" placeholder="123456" />
              <PwField label="Create New Password" value={fPw} onChange={setFPw} autoComplete="new-password" />
              <Primary onClick={doReset} loading={busy}>
                <CheckCircle2 size={18} /> {t('Reset & Login')}
              </Primary>
              <button onClick={() => setFStep('verify')} className={`inline-flex items-center gap-1.5 text-sm ${MUTED_LINK}`}>
                <ArrowLeft size={16} /> {t('Back')}
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
