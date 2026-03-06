'use client'

import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { contactFormSchema } from '@/types/Forms'
import { sendContactMessage } from '@/lib/forms/actions/contact'
import Confetti from 'react-confetti'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { useRef, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'

export default function ContactForm() {
  const { toast } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  const [loading, setLoading] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  async function onSubmit(values: z.infer<typeof contactFormSchema>) {
    setLoading(true)
    const result = await sendContactMessage(values)
    setLoading(false)
    toast({
      title: 'Email Sent',
    })

    form.reset()
    setShowConfetti(true)
  }

  const form = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      message: '',
    },
  })

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          ref={formRef}
          className="space-y-8"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg lg:text-base">Name</FormLabel>
                <FormControl>
                  <Input
                    className="bg-gray-100"
                    placeholder="(required) your name..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg lg:text-base">Phone</FormLabel>
                <FormControl>
                  <Input
                    className="bg-gray-100"
                    placeholder="(required) your email..."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  The email address we will use to contact you.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg lg:text-base">Phone</FormLabel>
                <FormControl>
                  <Input
                    className="bg-gray-100"
                    placeholder="your phone..."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  If you would like a return phone call...
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg lg:text-base">
                  How can we help you?
                </FormLabel>
                <FormControl>
                  <Textarea
                    className="bg-gray-100"
                    rows={6}
                    placeholder="(required) your message..."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  If you would like a return phone call...
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={loading}
            className="bg-cyan-900 hover:bg-cyan-800 text-white font-bold"
          >
            Submit
          </Button>
        </form>
      </Form>
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
        />
      )}
    </>
  )
}
