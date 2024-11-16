"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "@/hooks/use-cart"
import { Suspense } from "react"
import { CheckoutContent } from "./checkout-content"
import CheckoutLoading from "./loading"

export default function CheckoutPage() {
  const { items } = useCart()
  const router = useRouter()

  useEffect(() => {
    if (!items.length) {
      router.push('/cart')
    }
  }, [items, router])

  if (!items.length) {
    return null
  }

  return (
    <div className="container max-w-6xl py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Checkout</h1>
      <Suspense fallback={<CheckoutLoading />}>
        <CheckoutContent />
      </Suspense>
    </div>
  )
}