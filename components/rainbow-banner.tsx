interface RainbowBannerProps {
  text?: string
}

// Prominent, always-visible promo strip at the top of the storefront.
// Renders the text with a flowing rainbow gradient (see `.rainbow-text` in globals.css).
export function RainbowBanner({ text }: RainbowBannerProps) {
  const message =
    text ?? "批卡优惠力度大！！！无门槛入代dd  TG：@PdanKing"

  return (
    <div className="mx-auto mb-4 w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-r from-pink-50/80 via-white/70 to-purple-50/80 px-4 py-3 text-center shadow-[0_6px_22px_rgba(214,106,139,0.18)] backdrop-blur">
        <p className="rainbow-text text-base font-extrabold leading-snug tracking-wide sm:text-2xl">
          {message}
        </p>
      </div>
    </div>
  )
}
