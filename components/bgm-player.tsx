"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Music2, VolumeX } from "lucide-react"

const STORAGE_KEY = "angel_bgm_off"

interface BgmPlayerProps {
  /**
   * 候选音乐地址列表：每次进站由**访客端**随机抽一首。
   *
   * 为什么随机必须放在客户端：首页 HTML 会被 Vercel CDN 缓存
   * （实测响应头 `X-Vercel-Cache: STALE` / `Age: 32`），服务端 `Math.random()`
   * 的结果一旦被缓存固化，所有访客在缓存有效期内听到的都是同一首。
   * 放在 `useEffect` 里跑，每次真实进站都会重新抽。
   */
  srcs?: string[]
  /** 音量 0-100（移动端 Safari 会忽略，跟随系统音量） */
  volume?: number
}

/** 只放行站内路径与 http(s) 直链，挡掉 javascript: 之类的脏协议 */
function isSafeAudioUrl(url: string) {
  return /^\/[^\s]*$/.test(url) || /^https?:\/\//i.test(url)
}

function pickRandom(list: string[]): string | undefined {
  if (list.length === 0) return undefined
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * 背景音乐播放器
 *
 * 浏览器策略：现代浏览器（Chrome/Safari/Firefox）禁止「无交互自动播放带声音的媒体」，
 * audio.play() 会抛 NotAllowedError。所以这里的策略是：
 *   1. 进入页面先尝试自动播放（老访客 / 已授权站点可能直接成功）
 *   2. 被拦截时挂一次性交互监听，用户第一次点页面任意位置（或按键/触摸）就开始播
 *   3. 左下角常驻开关，手动关掉后写入 localStorage，下次进来不再自动播（尊重访客意愿）
 */
export function BgmPlayer({ srcs, volume = 20 }: BgmPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const wantPlayRef = useRef(true)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [failed, setFailed] = useState(false)
  const [enabled, setEnabled] = useState(false)

  // 依赖用字符串而不是数组：父组件每次渲染都会给新数组引用，
  // 直接依赖数组会让 effect 无限重建 audio 元素（音乐不断从头开始）。
  const srcKey = (srcs ?? []).join("\n")

  useEffect(() => {
    const candidates = srcKey ? srcKey.split("\n").filter(isSafeAudioUrl) : []
    const chosen = pickRandom(candidates)
    if (!chosen) {
      setEnabled(false)
      return
    }
    setEnabled(true)

    const audio = new Audio(chosen)
    audio.loop = true
    // 只预加载元数据：避免每个访客（哪怕从不开音乐）都被动下载整首歌
    audio.preload = "metadata"
    audio.volume = Math.min(1, Math.max(0, (Number(volume) || 20) / 100))
    audioRef.current = audio

    let disposed = false
    try {
      wantPlayRef.current = localStorage.getItem(STORAGE_KEY) !== "1"
    } catch {
      wantPlayRef.current = true
    }

    const start = async () => {
      if (disposed || !wantPlayRef.current) return
      try {
        await audio.play()
        if (disposed) return
        setPlaying(true)
        setBlocked(false)
        setShowHint(false)
      } catch {
        // 浏览器拦截了自动播放，等用户第一次交互
        if (disposed) return
        setPlaying(false)
        setBlocked(true)
        setShowHint(true)
      }
    }

    const onGesture = () => {
      if (disposed || !wantPlayRef.current) return
      if (audio.paused) void start()
    }

    const syncState = () => {
      if (!disposed) setPlaying(!audio.paused)
    }

    // 音频地址失效 / 格式不支持时，别留一个点了没反应的按钮
    const onError = () => {
      if (!disposed) setFailed(true)
    }

    audio.addEventListener("play", syncState)
    audio.addEventListener("pause", syncState)
    audio.addEventListener("error", onError)

    void start()

    window.addEventListener("pointerdown", onGesture)
    window.addEventListener("keydown", onGesture)
    window.addEventListener("touchstart", onGesture, { passive: true })

    return () => {
      disposed = true
      window.removeEventListener("pointerdown", onGesture)
      window.removeEventListener("keydown", onGesture)
      window.removeEventListener("touchstart", onGesture)
      audio.removeEventListener("play", syncState)
      audio.removeEventListener("pause", syncState)
      audio.removeEventListener("error", onError)
      audio.pause()
      audio.src = ""
      audioRef.current = null
    }
  }, [srcKey, volume])

  // 提示条 8 秒后自动消失，避免一直挂着碍眼
  useEffect(() => {
    if (!showHint) return
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [showHint])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      wantPlayRef.current = true
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
      void audio
        .play()
        .then(() => {
          setShowHint(false)
          setBlocked(false)
        })
        .catch(() => {
          setShowHint(true)
          setBlocked(true)
        })
    } else {
      wantPlayRef.current = false
      try {
        localStorage.setItem(STORAGE_KEY, "1")
      } catch {}
      audio.pause()
      setShowHint(false)
    }
  }, [])

  if (!enabled || failed) return null

  return (
    <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
      {showHint && !playing && (
        <span className="hidden max-w-[220px] rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-[11px] text-gray-600 shadow-sm backdrop-blur sm:inline-block">
          点一下页面任意处，开启背景音乐 🎵
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "关闭背景音乐" : "开启背景音乐"}
        title={playing ? "关闭背景音乐" : "开启背景音乐"}
        className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-sm backdrop-blur transition-colors ${
          playing
            ? "border-primary/30 bg-primary/10 text-primary"
            : "border-gray-200 bg-white/90 text-gray-500 hover:border-primary/30 hover:text-primary"
        }`}
      >
        {playing ? (
          <>
            <Music2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">音乐</span>
            <span className="flex items-end gap-[2px]" aria-hidden>
              <i className="h-2 w-[2px] animate-pulse rounded-full bg-current" />
              <i className="h-3 w-[2px] animate-pulse rounded-full bg-current [animation-delay:150ms]" />
              <i className="h-1.5 w-[2px] animate-pulse rounded-full bg-current [animation-delay:300ms]" />
            </span>
          </>
        ) : (
          <>
            <VolumeX className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{blocked ? "开启音乐" : "音乐"}</span>
          </>
        )}
      </button>
    </div>
  )
}
