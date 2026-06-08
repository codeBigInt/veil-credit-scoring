"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  variant?: "rise" | "left" | "right"
}

export default function ScrollReveal({ children, className = "", variant = "rise" }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.unobserve(node)
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -12% 0px" },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`scroll-reveal scroll-reveal-${variant}${visible ? " is-visible" : ""} ${className}`}
    >
      {children}
    </div>
  )
}
