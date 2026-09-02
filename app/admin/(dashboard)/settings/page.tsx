"use client"

import { useState, useEffect } from "react"
import { Save, Loader2, ShieldCheck, CreditCard, Settings, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

// Define available sub-channels for EPay
const EPAY_SUB_CHANNELS = [
  { id: "alipay", label: "支付宝" },
  { id: "wxpay", label: "微信支付" },
  { id: "qqpay", label: "QQ钱包" },
  { id: "usdt", label: "USDT" },
]

// Define available sub-channels for CodePay
const CODEPAY_SUB_CHANNELS = [
  { id: "alipay", label: "支付宝" },
  { id: "wxpay", label: "微信支付" },
  { id: "qqpay", label: "QQ钱包" },
]

// Define available sub-channels for 站内免签（个人码）
const MIANQIAN_SUB_CHANNELS = [
  { id: "alipay", label: "支付宝（个人码）" },
  { id: "wxpay", label: "微信（个人码）" },
  { id: "qqpay", label: "QQ钱包（个人码）" },
]

// Define available providers metadata
const PROVIDERS = [
  {
    id: "mianqian",
    name: "站内免签（个人码 / 码支付）",
    description: "零成本、不经第三方：上传你的微信/支付宝个人收款码，顾客扫码付款后由手机监听自动发货",
    icon: CreditCard,
    statusKey: "mianqian_token",
    enabledKey: "mianqian_enabled"
  },
  {
    id: "codepay",
    name: "码支付 (CodePay)",
    description: "个人免签支付，绑定支付宝/微信收款码即可收款，支持扫码付款",
    icon: CreditCard,
    statusKey: "codepay_id",
    enabledKey: "codepay_enabled"
  },
  {
    id: "epay",
    name: "易支付 (EPay)",
    description: "支持支付宝、微信、QQ钱包的聚合支付接口",
    icon: CreditCard,
    statusKey: "epay_api_url", // Keep for completeness
    enabledKey: "epay_enabled" // New key for explicit toggle
  },
  // Future providers...
]

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [draftConfig, setDraftConfig] = useState<Record<string, string>>({})
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  useEffect(() => {
    // When dialog opens, reset draft to current config
    if (selectedProvider) {
      setDraftConfig({ ...config })
    }
  }, [selectedProvider, config])

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/admin/settings")
      const data = await res.json()
      setConfig(data)
      setDraftConfig(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setDraftConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Prepare payload: remove empty password
      const payload = { ...draftConfig }
      if (!payload.admin_password) {
        delete payload.admin_password
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" }
      })
      
      if (res.ok) {
        alert("设置已保存")
        // Clear password field from draft after save for security
        const newDraft = { ...draftConfig }
        delete newDraft.admin_password
        setDraftConfig(newDraft)
        
        setConfig(newDraft) 
        setSelectedProvider(null) 
      } else {
        alert("保存失败")
      }
    } catch (error) {
      console.error(error)
      alert("保存出错")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">系统设置</h1>
        <p className="text-muted-foreground">管理支付渠道与站点参数</p>
      </div>

      <Tabs defaultValue="payment" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="payment">支付渠道</TabsTrigger>
          <TabsTrigger value="site">站点设置</TabsTrigger>
          <TabsTrigger value="email">邮件通知</TabsTrigger>
        </TabsList>
        
        <TabsContent value="payment" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((provider) => {
              const isEnabled = config[provider.enabledKey] === "true"
              const isConfigured = !!config[provider.statusKey]
              const Icon = provider.icon

              return (
                <Card key={provider.id} className="hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => setSelectedProvider(provider.id)}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{provider.name}</CardTitle>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground h-10 line-clamp-2">
                      {provider.description}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      {isEnabled ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> 已启用
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          已停用
                        </Badge>
                      )}
                      {!isConfigured && (
                         <span className="text-xs text-destructive ml-auto">未配置参数</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>


        <TabsContent value="site" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>站点基础信息</CardTitle>
              <CardDescription>配置网站的全局参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>网站标题</Label>
                <Input 
                  value={draftConfig.site_title || ""}
                  onChange={e => handleChange("site_title", e.target.value)}
                  placeholder="GeekFaka - 自动发货平台"
                />
              </div>
              <div className="grid gap-2">
                <Label>网站 URL (用于支付回调)</Label>
                <Input 
                  value={draftConfig.site_url || ""}
                  onChange={e => handleChange("site_url", e.target.value)}
                  placeholder="https://your-domain.com"
                />
                <p className="text-xs text-muted-foreground">
                  必须配置正确的域名（包含 https://），否则支付后无法自动发货。
                </p>
              </div>

              <div className="pt-4 border-t space-y-4">
                <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                   <Settings className="h-4 w-4" /> 客服与联系
                </h3>
                <div className="grid gap-2">
                   <Label>网站公告 (首页弹出/顶部显示)</Label>
                   <Textarea 
                     value={draftConfig.site_announcement || ""}
                     onChange={e => handleChange("site_announcement", e.target.value)}
                     placeholder="支持 Markdown。例如：🎉 欢迎光临！今日全场 9 折优惠。"
                     className="min-h-[100px] font-mono text-sm"
                   />
                   <p className="text-xs text-muted-foreground">
                     该内容将显示在网站首页的显著位置。
                   </p>
                </div>
                <div className="grid gap-2 pt-2">
                   <Label>Crisp Website ID (在线客服)</Label>
                   <Input 
                     value={draftConfig.crisp_id || ""}
                     onChange={e => handleChange("crisp_id", e.target.value)}
                     placeholder="e.g. 8d40a5a2-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                     className="font-mono"
                   />
                   <p className="text-xs text-muted-foreground">
                     在 <a href="https://crisp.chat/" target="_blank" className="underline hover:text-primary">Crisp</a> 注册并获取 Website ID，即可开启右下角在线客服。留空则关闭。
                   </p>
                </div>
                <div className="grid gap-2">
                   <Label>底部联系方式</Label>
                   <Textarea 
                     value={draftConfig.site_contact_info || ""}
                     onChange={e => handleChange("site_contact_info", e.target.value)}
                     placeholder="支持 Markdown，例如：联系邮箱：`support@example.com`"
                     className="min-h-[100px] font-mono text-sm"
                   />
                   <p className="text-xs text-muted-foreground">
                     将显示在网站底部的版权信息下方。
                   </p>
                </div>
              </div>
              
              <div className="grid gap-2 pt-4 border-t">
                <Label>管理员账号</Label>
                <Input
                  value={draftConfig.admin_username || ""}
                  onChange={e => handleChange("admin_username", e.target.value)}
                  placeholder="例如：ANGEL旗舰"
                  autoComplete="username"
                />
                <p className="text-xs text-muted-foreground">
                  修改后下次登录生效。
                </p>
              </div>

              <div className="grid gap-2 pt-4 border-t">
                <Label>修改管理员密码</Label>
                <Input 
                  type="password"
                  value={draftConfig.admin_password || ""}
                  onChange={e => handleChange("admin_password", e.target.value)}
                  placeholder="留空则不修改"
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">
                  设置新密码后，下次登录生效。若留空则保持当前密码不变。
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存配置
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Resend 邮件服务</CardTitle>
              <CardDescription>配置订单支付成功后的邮件通知</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">开启邮件通知</Label>
                  <p className="text-xs text-muted-foreground">订单支付成功后自动发送卡密到客户邮箱</p>
                </div>
                <Switch 
                  checked={draftConfig.resend_enabled === "true"}
                  onCheckedChange={(checked) => handleChange("resend_enabled", String(checked))}
                />
              </div>

              <div className="grid gap-2">
                <Label>Resend API Key</Label>
                <Input 
                  type="password"
                  value={draftConfig.resend_api_key || ""}
                  onChange={e => handleChange("resend_api_key", e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxx"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  从 <a href="https://resend.com/api-keys" target="_blank" className="underline hover:text-primary">Resend 控制台</a> 获取。
                </p>
              </div>

              <div className="grid gap-2">
                <Label>发件人邮箱 (From Email)</Label>
                <Input 
                  value={draftConfig.resend_from_email || ""}
                  onChange={e => handleChange("resend_from_email", e.target.value)}
                  placeholder="notifications@yourdomain.com"
                />
                <p className="text-xs text-muted-foreground">
                  必须是在 Resend 中验证过的域名邮箱。如果是测试环境可填 onboarding@resend.dev。
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存配置
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CodePay Configuration Dialog */}
      <Dialog open={selectedProvider === "codepay"} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置码支付 (CodePay)</DialogTitle>
            <DialogDescription>
              个人免签支付。请先在 <a href="https://codepay.fateqq.com" target="_blank" className="underline hover:text-primary">codepay.fateqq.com</a> 注册并绑定收款方式，再填入下方参数。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">启用此支付渠道</Label>
                  <p className="text-xs text-muted-foreground">关闭后前台将不可见</p>
                </div>
                <Switch
                  checked={draftConfig.codepay_enabled === "true"}
                  onCheckedChange={(checked) => handleChange("codepay_enabled", String(checked))}
                />
              </div>

              <div className="grid gap-3 border rounded-lg p-4">
                <Label>支持的支付方式</Label>
                <div className="grid grid-cols-3 gap-4">
                  {CODEPAY_SUB_CHANNELS.map((sub) => {
                    const currentChannels = (draftConfig.codepay_channels || "alipay,wxpay").split(",").filter(Boolean);
                    const isChecked = currentChannels.includes(sub.id);

                    return (
                      <div key={sub.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cp-chan-${sub.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            let newChannels;
                            if (checked) {
                              newChannels = [...currentChannels, sub.id];
                            } else {
                              newChannels = currentChannels.filter(c => c !== sub.id);
                            }
                            handleChange("codepay_channels", newChannels.join(","));
                          }}
                        />
                        <Label htmlFor={`cp-chan-${sub.id}`} className="font-normal cursor-pointer">
                          {sub.label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">勾选您在码支付平台实际开通的收款方式。</p>
              </div>

              <div className="grid gap-2">
                <Label>交易手续费率 (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="pr-8"
                    value={draftConfig.codepay_fee || ""}
                    onChange={e => handleChange("codepay_fee", e.target.value)}
                  />
                  <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">用户支付时需额外承担的费率，0 为不收取。例如填 3 代表 3%。</p>
              </div>

              <div className="grid gap-2">
                <Label>码支付 ID</Label>
                <Input
                  placeholder="例如：10041"
                  value={draftConfig.codepay_id || ""}
                  onChange={e => handleChange("codepay_id", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">注册码支付后在「用户中心」可以查到的商户 ID（纯数字）。</p>
              </div>

              <div className="grid gap-2">
                <Label>通信密钥 (Key)</Label>
                <Input
                  type="password"
                  placeholder="6-100 位字符"
                  value={draftConfig.codepay_key || ""}
                  onChange={e => handleChange("codepay_key", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">码支付「用户中心」里的通信密钥，只用于签名，不会明文传输。</p>
              </div>

              <div className="grid gap-2">
                <Label>网关地址 (一般不用改)</Label>
                <Input
                  placeholder="https://codepay.fateqq.com:51888"
                  value={draftConfig.codepay_api_url || ""}
                  onChange={e => handleChange("codepay_api_url", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">默认官方地址 https://codepay.fateqq.com:51888 ，留空即可。</p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">使用提示：</p>
                <p>1. 码支付需要保持其官方监控方式在线（如支付宝官方接口授权或手机端监控），否则无法自动到账通知。</p>
                <p>2. 支付成功后码支付会自动回调本站发货，无需人工干预。</p>
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProvider(null)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EPay Configuration Dialog */}
      <Dialog open={selectedProvider === "epay"} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置易支付 (EPay)</DialogTitle>
            <DialogDescription>
              请输入易支付网关的对接参数。支持彩虹易支付等兼容系统。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">启用此支付渠道</Label>
                  <p className="text-xs text-muted-foreground">关闭后前台将不可见</p>
                </div>
                <Switch 
                  checked={draftConfig.epay_enabled === "true"}
                  onCheckedChange={(checked) => handleChange("epay_enabled", String(checked))}
                />
              </div>

              {/* Sub-channel Selection */}
              <div className="grid gap-3 border rounded-lg p-4">
                <Label>支持的支付方式</Label>
                <div className="grid grid-cols-2 gap-4">
                  {EPAY_SUB_CHANNELS.map((sub) => {
                    const currentChannels = (draftConfig.epay_channels || "").split(",").filter(Boolean);
                    const isChecked = currentChannels.includes(sub.id);
                    
                    return (
                      <div key={sub.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`chan-${sub.id}`} 
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            let newChannels;
                            if (checked) {
                              newChannels = [...currentChannels, sub.id];
                            } else {
                              newChannels = currentChannels.filter(c => c !== sub.id);
                            }
                            handleChange("epay_channels", newChannels.join(","));
                          }}
                        />
                        <Label htmlFor={`chan-${sub.id}`} className="font-normal cursor-pointer">
                          {sub.label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">勾选您的易支付网关实际支持的支付方式。</p>
              </div>

              <div className="grid gap-2">
                <Label>交易手续费率 (%)</Label>
                <div className="relative">
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="0"
                    className="pr-8"
                    value={draftConfig.epay_fee || ""}
                    onChange={e => handleChange("epay_fee", e.target.value)}
                  />
                  <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">用户支付时需额外承担的费率，0 为不收取。例如填 3 代表 3%。</p>
              </div>

              <div className="grid gap-2">
                <Label>API 接口地址</Label>
                <Input 
                  placeholder="https://pay.example.com/" 
                  value={draftConfig.epay_api_url || ""}
                  onChange={e => handleChange("epay_api_url", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>商户 ID (PID)</Label>
                  <Input 
                    value={draftConfig.epay_pid || ""}
                    onChange={e => handleChange("epay_pid", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>签名方式</Label>
                  <Select 
                    value={draftConfig.epay_sign_type || "MD5"} 
                    onValueChange={val => handleChange("epay_sign_type", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MD5">MD5 (默认)</SelectItem>
                      <SelectItem value="RSA">RSA (推荐)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {draftConfig.epay_sign_type === "RSA" ? (
                <>
                  <div className="grid gap-2">
                    <Label>商户私钥 (Private Key)</Label>
                    <Textarea 
                      placeholder="-----BEGIN RSA PRIVATE KEY-----" 
                      className="font-mono text-xs h-32"
                      value={draftConfig.epay_private_key || ""}
                      onChange={e => handleChange("epay_private_key", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">请填入你的 RSA 私钥 (PKCS#1 或 PKCS#8)</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>平台公钥 (Public Key)</Label>
                    <Textarea 
                      placeholder="-----BEGIN PUBLIC KEY-----" 
                      className="font-mono text-xs h-32"
                      value={draftConfig.epay_public_key || ""}
                      onChange={e => handleChange("epay_public_key", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">请填入易支付平台的公钥用于验签</p>
                  </div>
                </>
              ) : (
                <div className="grid gap-2">
                  <Label>商户密钥 (Key)</Label>
                  <Input 
                    type="password"
                    value={draftConfig.epay_key || ""}
                    onChange={e => handleChange("epay_key", e.target.value)}
                  />
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProvider(null)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 站内免签（个人码）Configuration Dialog */}
      <Dialog open={selectedProvider === "mianqian"} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置站内免签（个人收款码 / 码支付）</DialogTitle>
            <DialogDescription>
              零成本个人免签：上传你的微信/支付宝个人收款码，顾客扫码付款后由手机端监听 App 通知本站自动发货。资金直接进你个人账户，不经任何第三方。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-base">启用此支付渠道</Label>
                  <p className="text-xs text-muted-foreground">关闭后前台将不可见</p>
                </div>
                <Switch
                  checked={draftConfig.mianqian_enabled === "true"}
                  onCheckedChange={(checked) => handleChange("mianqian_enabled", String(checked))}
                />
              </div>

              <div className="grid gap-3 border rounded-lg p-4">
                <Label>启用的收款方式</Label>
                <div className="grid grid-cols-3 gap-4">
                  {MIANQIAN_SUB_CHANNELS.map((sub) => {
                    const currentChannels = (draftConfig.mianqian_channels || "alipay,wxpay").split(",").filter(Boolean);
                    const isChecked = currentChannels.includes(sub.id);

                    return (
                      <div key={sub.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`mq-chan-${sub.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            let newChannels;
                            if (checked) {
                              newChannels = [...currentChannels, sub.id];
                            } else {
                              newChannels = currentChannels.filter(c => c !== sub.id);
                            }
                            handleChange("mianqian_channels", newChannels.join(","));
                          }}
                        />
                        <Label htmlFor={`mq-chan-${sub.id}`} className="font-normal cursor-pointer">
                          {sub.label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">勾选你已上传收款码的渠道。</p>
              </div>

              <div className="grid gap-2">
                <Label>通信密钥 (Token)</Label>
                <Input
                  type="password"
                  placeholder="自定义一段字符串，例如：abc123xyz"
                  value={draftConfig.mianqian_token || ""}
                  onChange={e => handleChange("mianqian_token", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">手机端监听 App 回调本站时需要用它签名（MD5(amount+token)），随便设一段只有你知道的字符串即可，不会明文传输。</p>
              </div>

              <div className="grid gap-2">
                <Label>支付宝收款码图片地址</Label>
                <Input
                  placeholder="https://你的图床/ali.png"
                  value={draftConfig.mianqian_qr_alipay || ""}
                  onChange={e => handleChange("mianqian_qr_alipay", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">你的支付宝「个人收款码」截图后上传到任意图床（或本站后台「站点设置」可放外链），填图片直链。</p>
              </div>

              <div className="grid gap-2">
                <Label>微信收款码图片地址</Label>
                <Input
                  placeholder="https://你的图床/wx.png"
                  value={draftConfig.mianqian_qr_wechat || ""}
                  onChange={e => handleChange("mianqian_qr_wechat", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">你的微信「二维码收款」截图直链。</p>
              </div>

              <div className="grid gap-2">
                <Label>QQ钱包收款码图片地址（可选）</Label>
                <Input
                  placeholder="https://你的图床/qq.png"
                  value={draftConfig.mianqian_qr_qqpay || ""}
                  onChange={e => handleChange("mianqian_qr_qqpay", e.target.value)}
                />
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">手机端监听设置（关键一步）：</p>
                <p>1. 在安卓手机安装一个「通知转发器 / 短信转发器」类 App（如「通知滤盒」「短信转发器」）。</p>
                <p>2. 配置规则：当收到微信/支付宝的收款通知时，自动 POST 到<br/>
                  <code className="text-foreground">https://kiro.pdan.top/api/payments/mianqian/notify</code></p>
                <p>3. 提交参数：<code className="text-foreground">amount=实际到账金额</code> 、 <code className="text-foreground">type=alipay或wxpay</code> 、 <code className="text-foreground">sign=MD5(amount+通信密钥)</code></p>
                <p>4. 付款后系统按金额自动匹配订单并发货。</p>
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProvider(null)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
