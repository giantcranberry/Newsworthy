// import { takeCoverage } from "v8";
import formData from 'form-data';
import { contactFormSchema, subscribeFormSchemaType } from "@/types/Forms";
import { z } from "zod";
import Mailgun from "mailgun.js";
import twilio from "twilio";
import axios from 'axios';
import qs from 'qs';
import { list } from 'postcss';

type messageData = {
  from: string
  to: string
  subject: string
  text: string
}

export async function sendContactEmail(contactData: z.infer<typeof contactFormSchema>): Promise<boolean> { 

  try {
    const apiKey: string = process.env.MAILGUN_API_KEY || ''
    const domain: string = process.env.MAILGUN_DOMAIN || 'mail.newsworthy.ai'
    
    const { name, email, phone, message } = contactData;
    
    const msg: string = `\n\n${name} has sent you a message from the Newsworthy.ai Contact Us form.\n
    ------------------------------------------\n
    Name: ${name}\n
    Phone: ${phone}\n          
    Email: ${email}\n
    Message: ${message}`

    const mailgunAPI = `https://api.mailgun.net/v3/${domain}/messages`;

    const mailgun = new Mailgun(formData)
    const client = mailgun.client({ username: 'api', key: apiKey })

    const messageData = {
      from: `Newsworthy.ai <support@mail.newsworthy.ai>`,
      to: 'support@newsworthy.ai',//, mark@newsworthy.ai',
      subject: 'Contact Us Form Submission from Newsworthy.ai',
      text: msg,
    }

    const res = await client.messages.create(domain, messageData)


    if (res.status != 200) {
      return false;
    }

    const twilio_accountSid = process.env.TWILIO_SID;
    const twilio_authToken = process.env.TWILIO_TOKEN;
    const twilio_number = process.env.TWILIO_NUMBER;

    const twilio_client = twilio(twilio_accountSid, twilio_authToken);

    twilio_client.messages
      .create({
         body: 'New Contact Us Form Submission from Newsworthy. Please check your email for details.',
         from: twilio_number,
         to: '+13604838441'
       });    

      twilio_client.messages
      .create({
         body: 'New Contact Us Form Submission from Newsworthy. Please check your email for details.',
         from: twilio_number,
         to: '+18312349290'
       });    

      
    return true;

  } catch (error) {
      return false;
  }  
}

export async function sendSubscriberEmail(emailData: subscribeFormSchemaType, message: string): Promise<boolean> { 

  try {
    const apiKey: string = process.env.MAILGUN_API_KEY || ''
    const domain: string = process.env.MAILGUN_DOMAIN || 'mail.newsworthy.ai'
    
    const { contact } = emailData;
    
    const mailgun = new Mailgun(formData)
    const client = mailgun.client({ username: 'api', key: apiKey })

    if (!message) {
      return false;
    }

    if (!contact) {
      return false;
    }    
    const messageData: messageData = {
      from: `Newsworthy.ai <support@mail.newsworthy.ai>`,
      to: contact,
      subject: 'Successfully Subscribed to Newsworthy.ai',
      text: message ,
    }

    const res = await client.messages.create(domain, messageData)

    if (res.status != 200) {
      return false;
    }

    return true;

  } catch (error) {
      return false;
  }  
}

export async function createEmailList(list_name: string, company_name: string): Promise<boolean> { 

  const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY; 

  if (typeof MAILGUN_API_KEY === 'undefined') {
    throw new Error('MAILGUN_API_KEY is not defined');
  }

  try {
    const data = qs.stringify({
      'address': `${list_name}@mail.newsworthy.ai`,
      'access_level': 'readonly',
      'name': list_name,
      'reply_preference': 'sender',
      'description': `${company_name} - Subscriptions`,
    });
    
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: 'api',
        password: MAILGUN_API_KEY as string,
      }
    };
    
    axios.post('https://api.mailgun.net/v3/lists', data, config)

    return true; 
  } catch (error) {
    console.error("Error creating mailing list:", error);
    return false;
  }
}

export const addListMember = async (list_name: string, email: string) => {
  const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY; 

  if (typeof MAILGUN_API_KEY === 'undefined') {
    throw new Error('MAILGUN_API_KEY is not defined');
  }

  try {
    const url = `https://api.mailgun.net/v3/lists/${list_name}@mail.newsworthy.ai/members`;

    const data = qs.stringify({
      subscribed: true,
      address: email,
      upsert: true
    });
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: 'api',
        password: MAILGUN_API_KEY,
      }
    };

    const result = await axios.post(url, data, config);  // Using url and data variables

    return true;  // Do something with the result if you want
  } catch (error: any) {
    if (error && error.response) {
      console.error("Response Error:", error.response.data);
    } else if (error && error.request) {
      console.error("Request Error:", error.request);
    } else if (error && error.message) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown Error:", error);
    }
      return false;
  }
};
