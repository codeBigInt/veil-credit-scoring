import { Analytics } from "@vercel/analytics/next"
import DecorativeTrails from "@/components/decorative-trails"
import "@/styles/globals.css"
import type { AppProps } from "next/app"
import { WalletProvider } from "@/context/WalletContext"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProvider>
      <div className="font-sans">
        <DecorativeTrails />
        <Component {...pageProps} />
        <Analytics />
      </div>
    </WalletProvider>
  )
}
