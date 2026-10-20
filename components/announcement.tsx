"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

// 不要把 react-markdown 静态 import 进来：它会把 markdown 解析器 + lowlight
// 代码高亮（约 115KB JS）塞进首页的首屏包，而绝大多数访客根本不会打开公告弹窗。
// 改成 dynamic 之后，这个 chunk 只会在用户真正点开公告时才去下载。
const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
  loading: () => <span className="text-sm text-muted-foreground">加载中…</span>,
})

interface AnnouncementProps {
  content?: string
}

export function Announcement({ content }: AnnouncementProps) {
  const [open, setOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (content) {
      // 内容 hash 记录在 localStorage，未读过的公告自动弹一次
      const contentHash = btoa(encodeURIComponent(content)).substring(0, 32)
      const seenHash = localStorage.getItem("announcement_seen_hash")
      if (seenHash !== contentHash) {
        setOpen(true)
        localStorage.setItem("announcement_seen_hash", contentHash)
      }
    }
    setIsVisible(true)
  }, [content])

  if (!isVisible) return null

  return (
    <>
      {/* 公告行：轻量细字（替代旧的粉色渐变胶囊），后台没配公告也常驻 */}
      <div className="flex items-center gap-2.5 pt-4 text-[13.5px] text-muted-foreground">
        <span aria-hidden>📢</span>
        <span className="truncate">
          支付完成立即自动发卡 · 有问题联系{" "}
          <b className="font-semibold text-primary">TG @PdanKing</b>
        </span>
        {content && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto shrink-0 font-medium text-primary transition-opacity hover:opacity-80"
          >
            公告详情
          </button>
        )}
      </div>

      {content && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="dialog-dark max-h-[85vh] overflow-hidden border border-border bg-card p-0 text-card-foreground sm:max-w-xl sm:rounded-[18px]">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle className="text-lg font-semibold tracking-tight">网站服务公告</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="prose prose-sm prose-invert max-w-none text-muted-foreground">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </div>
            <div className="px-6 pb-6">
              <Button
                className="h-11 w-full rounded-xl bg-gradient-to-br from-[#E2725B] to-[#C2553C] text-white transition-opacity hover:opacity-90"
                onClick={() => setOpen(false)}
              >
                我已阅读
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
