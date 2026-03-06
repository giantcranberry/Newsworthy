"use server"

import { z } from 'zod';
import { contactFormSchema } from "@/types/Forms";
import { sendContactEmail } from '@/lib/mailer';

export async function sendContactMessage(contactData: z.infer<typeof contactFormSchema>): Promise<boolean> {
    // Your implementation to send the contact message goes here
    // For demonstration purposes, we will just log the contactData and return a dummy value.
    let res = sendContactEmail(contactData)

    if (!res) {
        return false;
    }
    
    return true;
}