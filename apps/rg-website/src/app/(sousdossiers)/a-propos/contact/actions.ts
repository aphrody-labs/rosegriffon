"use server";

import nodemailer from "nodemailer";

import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";

import type { ContactFormValues } from "./schema";

const logger = createLogger("contact-email");

// Interface pour les options d'email avec propriété attachments
interface NodemailerMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType: string;
  }[];
}

// Configurer le transporteur SMTP
function createTransporter() {
  const smtpUser = getEnv("SMTP_USER");
  const smtpPassword = getEnv("SMTP_PASSWORD");

  return nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

export async function sendContactEmail(formData: ContactFormValues) {
  try {
    const transporter = createTransporter();
    const smtpUser = getEnv("SMTP_USER");

    logger.info("Envoi d'un email de contact", {
      subject: formData.subject,
      hasFile: !!formData.file,
    });

    // Construire le contenu de l'email
    const emailContent = `
      <h2>Titre : ${formData.title}</h2>
      <p><strong>Sujet :</strong> ${formData.subject}</p>
      <p><strong>Description :</strong></p>
      <p>${formData.description.replace(/\n/g, "<br>")}</p>
    `;

    // Préparer les options de l'email
    const mailOptions: NodemailerMailOptions = {
      from: smtpUser,
      to: smtpUser,
      subject: `[RG WEB] ${formData.subject} - ${formData.title}`,
      html: emailContent,
    };

    // Ajouter la pièce jointe si elle existe
    if (
      formData.file &&
      formData.file instanceof File &&
      typeof formData.file === "object" &&
      "arrayBuffer" in formData.file &&
      "name" in formData.file &&
      "type" in formData.file
    ) {
      try {
        const fileBuffer = await formData.file.arrayBuffer();
        mailOptions.attachments = [
          {
            filename: formData.file.name,
            content: Buffer.from(fileBuffer),
            contentType: formData.file.type,
          },
        ];
        logger.debug("Pièce jointe ajoutée", {
          filename: formData.file.name,
          size: fileBuffer.byteLength,
        });
      } catch (error) {
        logger.error("Erreur lors du traitement de la pièce jointe", error);
        // Continuer sans pièce jointe si une erreur survient
      }
    }

    // Vérifier la connexion SMTP
    try {
      await transporter.verify();
      logger.debug("Connexion SMTP vérifiée");
    } catch (error) {
      logger.error("La vérification SMTP a échoué", error);
      return { success: false, error: "Erreur de configuration SMTP" };
    }

    // Envoyer l'email
    const info = await transporter.sendMail(mailOptions);
    logger.info("Email envoyé avec succès", { messageId: info.messageId });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("Erreur lors de l'envoi de l'email", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}
