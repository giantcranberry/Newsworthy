import { z } from "zod";

export const contactFormSchema = z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    phone: z.string().min(10).max(15).optional(),
    message: z.string().min(10).max(1000),
})

export const subscribeFormSchema = z.object({
    contact: z.string().optional(),
    id: z.string().max(64),
    company: z.string().min(1).max(128).optional(),
    message: z.string().optional(),
})

export type subscribeFormSchemaType = z.infer<typeof subscribeFormSchema>;
