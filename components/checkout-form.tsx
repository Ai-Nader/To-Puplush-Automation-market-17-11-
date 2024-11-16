"use client"

import { useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { useCart } from '@/hooks/use-cart'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'

export function CheckoutForm() {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const { clearCart } = useCart()
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/success`,
        },
        redirect: 'if_required',
      })

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message || "An error occurred during payment",
          variant: "destructive",
        })
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        clearCart()
        toast({
          title: "Payment successful",
          description: "Thank you for your purchase!",
        })
        router.push('/success')
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full"
      >
        {isLoading ? "Processing..." : "Complete Payment"}
      </Button>
    </form>
  )
}