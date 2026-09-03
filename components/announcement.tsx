"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"

interface AnnouncementProps {
  content?: string
}

export function Announcement({ content }: AnnouncementProps) {
  const [open, setOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!content) return

    const contentHash = btoa(encodeURIComponent(content)).substring(0, 32)
    const seenHash = localStorage.getItem("announcement_seen_hash")

    if (seenHash !== contentHash) {
      setOpen(true)
      localStorage.setItem("announcement_seen_hash", contentHash)
    }

    setIsVisible(true)
  }, [content])

  if (!content || !isVisible) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto mb-6 flex w-full max-w-3xl items-center justify-between rounded-full bg-gradient-to-r from-[#ffc8e3] to-[#ff8fc2] px-4 py-2 text-left text-xs text-[#8a2350] shadow-sm"
      >
        <span className="flex items-center gap-1.5 truncate">
          <span aria-hidden>📢</span>
          <span className="truncate">公告：支付完成立即发卡</span>
        </span>
        <span className="shrink-0 font-medium text-[#ec3c86]">查看</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden border-none bg-white p-0 sm:max-w-xl sm:rounded-3xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl font-medium tracking-tight">网站服务公告</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="prose prose-sm max-w-none text-muted-foreground prose-headings:font-medium prose-headings:text-foreground">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </div>
          <div className="px-6 pb-6">
            <Button className="h-11 w-full rounded-full" onClick={() => setOpen(false)}>
              我已阅读
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
