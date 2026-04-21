import { Poppins } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import DecorativeTrails from "@/components/decorative-trails"
import "@/styles/globals.css"
import type { AppProps } from "next/app"

const poppins = Poppins({
  subsets: ["latin"], 
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"]
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={poppins.className}>
      <DecorativeTrails />
      <Component {...pageProps} />
      <Analytics />
    </div>
  )
}