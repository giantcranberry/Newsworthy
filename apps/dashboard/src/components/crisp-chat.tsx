"use client"

import { useEffect } from "react"
import { Crisp } from "crisp-sdk-web"

export default function CrispChat() {
  useEffect(() => {
    Crisp.configure("754c91b9-6ef6-4949-9173-d84b4e10d6dc")
  }, [])

  return null
}
