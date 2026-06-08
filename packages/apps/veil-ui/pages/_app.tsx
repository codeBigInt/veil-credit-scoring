import { Analytics } from "@vercel/analytics/next"
import DecorativeTrails from "@/components/decorative-trails"
import "@/styles/globals.css"

import type { AppProps } from "next/app"
import { WalletProvider } from "@/context/WalletContext"
import { ccc } from "@ckb-ccc/connector-react"
import { Toaster } from "react-hot-toast"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ccc.Provider>
      <WalletProvider>
        <div className="font-sans">
          <DecorativeTrails />
          <Component {...pageProps} />
          <Analytics />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "oklch(0.14 0 0)",
                border: "1px solid oklch(0.25 0 0)",
                color: "oklch(0.98 0 0)",
                borderRadius: "2px",
                fontSize: "13px",
              },
              success: {
                iconTheme: {
                  primary: "var(--color-primary)",
                  secondary: "var(--color-primary-foreground)",
                },
              },
            }}
          />
        </div>
      </WalletProvider>
    </ccc.Provider>
  )
}
