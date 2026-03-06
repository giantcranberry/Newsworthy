"use client";

import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Rss } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createRef, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subscribeFormSchema, subscribeFormSchemaType } from "@/types/Forms";
import { sendSubscribeMessage } from "@/lib/forms/actions/subscribe";
import { Checkbox } from "../ui/checkbox";
import ReCAPTCHA from "react-google-recaptcha";
import { verifyCaptcha } from "@/lib/forms/recaptcha";
import Confetti from "react-confetti";
import { identifyContactType, sanitizePhoneNumber } from "@/lib/utils";
import { subscribeToSms } from "@/lib/sms_send";

type SubscribeProps = {
  company: subscribeFormSchemaType;
};

export default function SubscribeForm({ company }: SubscribeProps) {
  const { toast } = useToast();

  const formRef = useRef<HTMLFormElement>(null);
  const checkboxref = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const [success, setSuccess] = useState<string | null>(null);

  const ReCAPTCHA_SITE_KEY =
    process.env.RECAPTCHA_PUBLIC_KEY ||
    "6LdgxsEeAAAAAHalnLOyNmAJSQpDTTIWKkOYquMS";

  async function handleCaptchaSubmission(token: string | null) {
    // Server function to verify captcha
    await verifyCaptcha(token)
      .then(() => setIsVerified(true))
      .catch(() => setIsVerified(false));
  }

  async function onSubmit(values: z.infer<typeof subscribeFormSchema>) {
    setLoading(true);

    let message: string = "";

    const { contact } = values;
    if (!contact) {
      return false; // TODO handle error
    }
    company.contact = contact;

    if (identifyContactType(contact) === "email") {
      company.message = `You have subscribed to news from ${company.company}. You can unsubscribe at any time by clicking the unsubscribe link in the notifications that we send on their behalf.`;
      const result = await sendSubscribeMessage(company);
    }

    if (identifyContactType(contact) === "phone") {
      company.contact = sanitizePhoneNumber(contact);
      message = `You have subscribed to news from ${company.company}. You can unsubscribe at any time by responding to this message with the word LEAVE.`;

      const result = await subscribeToSms(company, message);
    }

    setLoading(false);

    toast({
      title: "Subscription Received",
    });

    form.reset();
    if (checkboxref.current && checkboxref.current.checked) {
      checkboxref.current.checked = false;
    }
    recaptchaRef.current?.reset();
    setSuccess(
      "You have successfully subscribed to news from " + company.company
    );
    setShowConfetti(true);
  }

  const form = useForm<z.infer<typeof subscribeFormSchema>>({
    resolver: zodResolver(subscribeFormSchema),
    defaultValues: {
      id: company.id,
      contact: "",
    },
  });

  return (
    <Card className="bg-yellow-800/5 border border-gray-200 mt-5">
      <CardHeader>
        <CardTitle className="font-serif font-medium flex items-center gap-10">
          Subscribe to News
          <Rss size={24} className="text-cyan-700" />
        </CardTitle>
        <CardDescription className="text-black">
          Be the first to know. Receive press releases alerts from{" "}
          <strong>{company.company}</strong> to your email inbox or via text
          message.
          {success && <div className="text-green-500">{success}</div>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            ref={formRef}
            className="space-y-2"
          >
            <input name="id" type="hidden" value={`${company.id}`} />
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Enter Cell Phone or Email Address Below</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-gray-100"
                      placeholder="Email of Cell Number"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex space-x-2 items-start py-2">
              <input type="checkbox" id="terms" ref={checkboxref} />
              <label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 pl-2"
              >
                I agree to receive news alerts from Newsworthy.ai via email or
                text message. I understand that I can unsubscribe at any time. I
                understand that I will only receive alerts for the company I
                have subscribed to (<u>{company.company}</u>). I can unsubscribe
                at any time from email by clicking unsubscribe from within my
                email or responding to text messages with the word{" "}
                <strong>LEAVE</strong>.
              </label>
            </div>
            <ReCAPTCHA
              sitekey={ReCAPTCHA_SITE_KEY}
              ref={recaptchaRef}
              onChange={handleCaptchaSubmission}
            />
            <Button
              type="submit"
              disabled={loading}
              className="bg-green-700 hover:bg-green-800 rounded w-full"
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
      </CardContent>
      <CardFooter></CardFooter>
    </Card>
  );
}
