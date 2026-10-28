"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface CaptchaValue {
  token: string
  answer: string
}

interface CaptchaFieldProps {
  /** 每次 token / 输入变化都会回调，父组件存下来提交给接口 */
  onChange: (value: CaptchaValue) => void
  /** 这个值每变化一次就重新取一张图（提交失败、切换登录/注册时用） */
  resetSignal?: number
  disabled?: boolean
}

export function CaptchaField({ onChange, resetSignal = 0, disabled = false }: CaptchaFieldProps) {
  const [image, setImage] = useState("")
  const [token, setToken] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      // 加时间戳绕过任何中间层缓存
      const res = await fetch(`/api/captcha?t=${Date.now()}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.token && data.image) {
        setImage(data.image)
        setToken(data.token)
      } else {
        setFailed(true)
        setToken("")
      }
    } catch {
      setFailed(true)
      setToken("")
    } finally {
      setAnswer("")
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, resetSignal])

  useEffect(() => {
    onChangeRef.current({ token, answer })
  }, [token, answer])

  return (
    <div className="space-y-2">
      <Label htmlFor="captcha" className="text-xs text-muted-foreground">验证码</Label>
      <div className="flex items-center gap-2">
        <Input
          id="captcha"
          name="captcha"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="4 位数字"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="numeric"
          maxLength={4}
          disabled={disabled}
          className="h-11 min-w-0 flex-1 rounded-xl border-border bg-muted/50 text-center tracking-[0.4em] text-base"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={disabled || loading}
          aria-label="点击刷新验证码"
          title="看不清？点击换一张"
          className="relative h-11 w-[124px] shrink-0 overflow-hidden rounded-xl border border-border bg-muted/50 transition-colors hover:border-primary/40 disabled:opacity-70"
        >
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </span>
          )}
          {!loading && image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt="图形验证码，看不清可点击刷新"
              width={120}
              height={40}
              className="h-full w-full object-contain"
              draggable={false}
            />
          )}
          {!loading && failed && (
            <span className="flex h-full w-full items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <RefreshCw className="h-3 w-3" /> 点此重试
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
