import ReactMarkdown from "react-markdown"

export function StoreFooter({ contact }: { contact?: string | null }) {
  return (
    <footer className="mt-auto border-t border-border px-4 pb-14 pt-10 text-center text-sm text-muted-foreground">
      <p>&copy; {new Date().getFullYear()} Angel · 自动发卡平台</p>
      {contact ? (
        <div className="prose prose-sm mx-auto mt-4 max-w-xl text-muted-foreground">
          <ReactMarkdown>{contact}</ReactMarkdown>
        </div>
      ) : (
        <p className="mt-2">支付完成立即发卡</p>
      )}
    </footer>
  )
}
