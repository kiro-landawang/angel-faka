"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Trash2, Key } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface License {
  id: string
  code: string
  status: string
  createdAt: string
}

interface StockManagerProps {
  productId: string
  productName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onStockUpdated: () => void
}

export function StockManager({ productId, productName, open, onOpenChange, onStockUpdated }: StockManagerProps) {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(false)
  const [importText, setImportText] = useState("")
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    if (open) {
      fetchLicenses()
    }
  }, [open, productId])

  const fetchLicenses = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/licenses?productId=${productId}`)
      const data = await res.json()
      setLicenses(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!importText.trim()) return
    setIsImporting(true)

    const codes = importText.split("\n").map(c => c.trim()).filter(c => c !== "")
    
    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        body: JSON.stringify({ productId, codes }),
        headers: { "Content-Type": "application/json" }
      })
      
      if (res.ok) {
        setImportText("")
        fetchLicenses()
        onStockUpdated()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/licenses/${id}`, { method: "DELETE" })
      if (res.ok) {
        setLicenses(licenses.filter(l => l.id !== id))
        onStockUpdated()
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        <div className="grid grid-cols-1 md:grid-cols-6 h-full">
          {/* Left: Import Section */}
          <div className="md:col-span-3 bg-muted/40 border-r p-8 flex flex-col gap-5">
            <div className="flex items-center gap-4 mb-3">
              <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                <Key className="h-6 w-6 text-foreground/70" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">库存导入</DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground mt-0.5">
                  正在为 <span className="font-semibold text-foreground">{productName}</span> 批量补充激活码
                </DialogDescription>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-2.5">
              <Label htmlFor="import" className="text-sm font-semibold flex justify-between">
                <span>粘贴卡密内容</span>
                <span className="text-xs font-normal text-muted-foreground">每行视为独立条目</span>
              </Label>
              <Textarea
                id="import"
                placeholder={"在此粘贴卡密内容...\nKEY-AAA-BBB-CCC\nKEY-DDD-EEE-FFF"}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="flex-1 font-mono text-sm bg-card resize-none border-dashed p-5 leading-relaxed"
              />
            </div>

            <Button
              size="lg"
              className="w-full h-12 font-semibold rounded-lg"
              onClick={handleImport}
              disabled={isImporting || !importText.trim()}
            >
              {isImporting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Plus className="mr-2 h-5 w-5" />}
              执行批量导入
            </Button>
          </div>

          {/* Right: List Section */}
          <div className="md:col-span-3 p-6 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <h3 className="font-semibold tracking-tight">可用库存</h3>
                <p className="text-xs text-muted-foreground">当前商品未售出的激活码</p>
              </div>
              <Badge variant="secondary" className="px-3 py-1 font-mono text-sm">
                {licenses.length} 个
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/60 sticky top-0 z-10">
                  <TableRow className="border-b hover:bg-transparent">
                    <TableHead className="w-[80px] font-medium text-muted-foreground">序号</TableHead>
                    <TableHead className="font-medium text-muted-foreground">卡密内容</TableHead>
                    <TableHead className="w-[80px] text-right font-medium text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="hover:bg-transparent border-0">
                      <TableCell colSpan={3} className="h-64 text-center">
                        <Loader2 className="mx-auto h-7 w-7 animate-spin text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : licenses.length === 0 ? (
                    <TableRow className="hover:bg-transparent border-0">
                      <TableCell colSpan={3} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted/40">
                            <span className="text-3xl opacity-50">📦</span>
                          </div>
                          <div className="text-sm text-muted-foreground">暂无库存数据，请从左侧导入</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    licenses.map((license, index) => (
                      <TableRow key={license.id} className="group border-b last:border-0 h-12">
                        <TableCell className="text-xs text-muted-foreground font-mono pl-5">
                          {String(index + 1).padStart(2, '0')}
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all font-medium">
                          {license.code}
                        </TableCell>
                        <TableCell className="text-right pr-5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                            onClick={() => handleDelete(license.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground justify-end">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
              最多仅显示最早 100 条可用库存
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
