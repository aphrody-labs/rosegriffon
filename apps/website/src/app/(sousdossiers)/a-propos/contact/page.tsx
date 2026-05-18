"use client";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@rose-griffon/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@rose-griffon/ui";

import { sendContactEmail } from "./actions";
import { type ContactFormValues, contactFormSchema } from "./schema";

// Taille maximale de fichier en octets (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ContactPage() {
  const toastIdRef = useRef<string | number | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      title: "",
      subject: undefined,
      description: "",
      file: null,
    },
  });

  // Utiliser TanStack Query pour la mutation
  const mutation = useMutation({
    mutationFn: sendContactEmail,
    onMutate: () => {
      // Afficher le toast de chargement
      toastIdRef.current = toast.loading("Envoi en cours...", {
        description: "Votre message est en cours d'envoi.",
      });
    },
    onSuccess: () => {
      // Mettre à jour le toast en succès
      if (toastIdRef.current) {
        toast.success("Formulaire envoyé", {
          id: toastIdRef.current,
          description: "Nous avons bien reçu votre message et reviendrons vers vous rapidement.",
        });
      }
      form.reset();
      setFileSize(0);
    },
    onError: (error) => {
      console.error("Erreur lors de l'envoi du formulaire:", error);
      // Mettre à jour le toast en erreur
      if (toastIdRef.current) {
        toast.error("Erreur lors de l'envoi", {
          id: toastIdRef.current,
          description:
            "Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer.",
        });
      }
    },
    onSettled: () => {
      // Réinitialiser la référence du toast
      toastIdRef.current = null;
    },
  });

  // Formatter la taille du fichier en format lisible
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  async function onSubmit(data: ContactFormValues) {
    try {
      // Vérifier que les données sont valides avant l'envoi
      const formData = { ...data };

      // S'assurer que le fichier est bien un objet File s'il existe
      if (
        formData.file !== null &&
        formData.file !== undefined &&
        !(formData.file instanceof File)
      ) {
        // Supprimer le fichier s'il n'est pas valide
        formData.file = null;
      }

      // Vérifier une dernière fois la taille du fichier
      if (formData.file && formData.file instanceof File && formData.file.size > MAX_FILE_SIZE) {
        toast.error("Fichier trop volumineux", {
          description: `La taille maximale autorisée est de ${formatFileSize(MAX_FILE_SIZE)}.`,
        });
        return;
      }

      mutation.mutate(formData);
    } catch (error) {
      console.error("Erreur lors de l'envoi du formulaire:", error);
      toast.error("Erreur lors de l'envoi", {
        description:
          "Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer.",
      });
    }
  }

  return (
    <div className="flex flex-col mb-8">
      <div className="flex flex-col gap-6 px-2 sm:px-4 py-4">
        <div className="space-y-2 sm:space-y-4">
          <h1 className="text-4xl lg:text-5xl font-bold">Nous contacter</h1>
          <p className="text-muted-foreground text-base lg:text-lg">
            Vous avez une question, une suggestion ou souhaitez collaborer avec nous ?
            N&apos;hésitez pas à nous contacter en remplissant le formulaire ci-dessous.
          </p>
        </div>

        <div className="border rounded-lg p-4 sm:p-8 bg-card">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titre du message*</FormLabel>
                        <FormControl>
                          <Input placeholder="Entrez le titre de votre message" {...field} />
                        </FormControl>
                        <FormDescription>Un titre concis qui résume votre demande.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sujet*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionnez un sujet" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Information sur l'association">
                              Information sur l&apos;association
                            </SelectItem>
                            <SelectItem value="Collaboration">Collaboration</SelectItem>
                            <SelectItem value="Don et soutien">Don et soutien</SelectItem>
                            <SelectItem value="Événements à venir">Événements à venir</SelectItem>
                            <SelectItem value="Adhésion">Adhésion</SelectItem>
                            <SelectItem value="Demande de presse">Demande de presse</SelectItem>
                            <SelectItem value="Support technique">Support technique</SelectItem>
                            <SelectItem value="Autres">Autres (préciser dans le titre)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choisissez le sujet qui correspond le mieux à votre demande.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description*</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Détaillez votre demande ici..."
                          className="min-h-[120px] sm:min-h-[150px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Décrivez votre demande en détail pour que nous puissions mieux vous aider.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="file"
                render={({ field: { onChange, ...fieldProps } }) => (
                  <FormItem className="mb-6 sm:mb-8">
                    <FormLabel>Pièce jointe (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFileSize(file.size);
                            if (file.size > MAX_FILE_SIZE) {
                              toast.warning("Attention: fichier volumineux", {
                                description: `Ce fichier dépasse la limite de ${formatFileSize(
                                  MAX_FILE_SIZE
                                )}.`,
                              });
                            }
                          } else {
                            setFileSize(0);
                          }
                          onChange(file || null);
                        }}
                        {...fieldProps}
                      />
                    </FormControl>
                    <FormDescription>
                      Formats acceptés: PDF, DOCX, images (JPG, PNG, GIF) et TXT.
                      {fileSize > 0 && (
                        <span
                          className={
                            fileSize > MAX_FILE_SIZE
                              ? "text-red-500 font-medium block mt-1"
                              : "block mt-1"
                          }
                        >
                          Taille actuelle: {formatFileSize(fileSize)}.
                        </span>
                      )}
                      <span className="block mt-1">Taille maximale: 5MB.</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-center">
                <Button
                  type="submit"
                  className="w-full md:w-auto md:px-8 bg-green-600 hover:bg-green-700 text-base py-2 h-auto"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Envoi en cours..." : "Envoyer le message"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}