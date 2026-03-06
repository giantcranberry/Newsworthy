"use server";
import { subscribeFormSchema } from "@/types/Forms";
import twilio from "twilio";
import * as z from "zod";
import { db, eq, and, company, smsSubscriptions } from '@/lib/db';

export async function subscribeToSms(
    contactData: z.infer<typeof subscribeFormSchema>,
    message: string
): Promise<boolean> {
    if (!contactData.contact || !message) {
        return false;
    }

    const co = await db.query.company.findFirst({
        where: eq(company.uuid, contactData.id),
    });

    if (!co) {
        throw new Error("Company not found");
    }

    const subscription = await db.query.smsSubscriptions.findFirst({
        where: and(
            eq(smsSubscriptions.companyId, co.id),
            eq(smsSubscriptions.cell, contactData.contact)
        ),
    });

    if (!subscription) {
        await db.insert(smsSubscriptions).values({
            companyId: co.id,
            cell: contactData.contact,
            createdAt: new Date(),
        });
    }

    try {
        const twilio_accountSid = process.env.TWILIO_SID;
        const twilio_authToken = process.env.TWILIO_TOKEN;
        const twilio_number = process.env.TWILIO_NUMBER;

        const twilio_client = twilio(twilio_accountSid, twilio_authToken);
        twilio_client.messages.create({
            body: message,
            from: twilio_number,
            to: `+${contactData.contact}`,
        });

        return true;
    } catch (error) {
        return false;
    }
}
