"use server"

import { z } from 'zod';
import { subscribeFormSchema } from "@/types/Forms";
import { addListMember, createEmailList, sendSubscriberEmail } from '@/lib/mailer';
import { db, eq, and, company, listSubscriptions } from '@/lib/db';

export async function sendSubscribeMessage(emailData: z.infer<typeof subscribeFormSchema>): Promise<boolean> {
    if (!emailData.contact ) {
        return false;
    }
    const message = emailData.message || 'Thank you for subscribing to Newsworthy.ai!'
    subscribeUser(emailData.id, emailData.contact)
    .catch(e => {
        throw e
    });

    let res = sendSubscriberEmail(emailData, message )

    if (!res) {
        return false;
    }

    return true;
}

async function subscribeUser(uuid: string, email: string) {
  const co = await db.query.company.findFirst({
    where: eq(company.uuid, uuid)
  });

  if (!co) {
    throw new Error("Company not found");
  }

  if (email.includes("@")) {
    email = email.toLowerCase();

    const subscription = await db.query.listSubscriptions.findFirst({
      where: and(
        eq(listSubscriptions.companyId, co.id),
        eq(listSubscriptions.email, email)
      )
    });

    const coListname = `news.alerts${co.id}`;

    const coList = await db.query.listSubscriptions.findFirst({
      where: eq(listSubscriptions.listName, coListname)
    });

    if (!coList) {
      const createList = await createEmailList(coListname, co.companyName);
    }

    const addMember = await addListMember(coListname, email);

    if (!subscription) {
      await db.insert(listSubscriptions).values({
        companyId: co.id,
        listName: coListname,
        email: email,
        createdAt: new Date(),
      });
    }
  }
}
