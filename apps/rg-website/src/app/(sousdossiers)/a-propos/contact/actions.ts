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
		auth: {
			pass: smtpPassword,
			user: smtpUser,
		},
		host: "smtp.gmail.com",
		port: 587,
		secure: false,
		service: "gmail",
	});
}

export async function sendContactEmail(formData: ContactFormValues) {
	try {
		const transporter = createTransporter();
		const smtpUser = getEnv("SMTP_USER");

		logger.info("Envoi d'un email de contact", {
			hasFile: !!formData.file,
			subject: formData.subject,
		});

		// Construire le contenu de l'email
		const emailContent = `
      <h2>Titre : ${formData.title}</h2>
      <p><strong>Sujet :</strong> ${formData.subject}</p>
      <p><strong>Description :</strong></p>
      <p>${formData.description.replaceAll(/\n/g, "<br>")}</p>
    `;

		// Préparer les options de l'email
		const mailOptions: NodemailerMailOptions = {
			from: smtpUser,
			html: emailContent,
			subject: `[RG WEB] ${formData.subject} - ${formData.title}`,
			to: smtpUser,
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
						content: Buffer.from(fileBuffer),
						contentType: formData.file.type,
						filename: formData.file.name,
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
			return { error: "Erreur de configuration SMTP", success: false };
		}

		// Envoyer l'email
		const info = await transporter.sendMail(mailOptions);
		logger.info("Email envoyé avec succès", { messageId: info.messageId });

		return { messageId: info.messageId, success: true };
	} catch (error) {
		logger.error("Erreur lors de l'envoi de l'email", error);
		return {
			error: error instanceof Error ? error.message : "Erreur inconnue",
			success: false,
		};
	}
}
