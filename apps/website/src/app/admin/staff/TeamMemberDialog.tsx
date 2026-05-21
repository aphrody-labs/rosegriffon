"use client";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger, Label, ResponsiveDialog, Switch } from "@rosegriffon/ui";
import { Upload, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";



import { createTeamMember, updateTeamMember, uploadTeamMemberImage } from './actions';
import type { TeamMember } from './actions';

interface TeamMemberDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	member?: TeamMember;
	onSuccess: () => void;
}

const TEAM_OPTIONS = [
	{ label: "Bureau de l'Association", value: "bureauteam" },
	{ label: "Membres de l'Association", value: "assoteam" },
	{ label: "Équipe Lore", value: "loreteam" },
	{ label: "Équipe Dessinateur", value: "dessinateurteam" },
	{ label: "Équipe Production", value: "productionteam" },
	{ label: "Équipe Réseaux", value: "socialteam" },
	{ label: "Équipe Achilléa", value: "achilleateam" },
	{ label: "Équipe Azalée", value: "azaleeteam" },
	{ label: "Cellule de Médiation", value: "mediationteam" },
	{ label: "Partenaires & Collaborateurs", value: "collabteam" },
];

export function TeamMemberDialog({
	open,
	onOpenChange,
	member,
	onSuccess,
}: TeamMemberDialogProps) {
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		discord_user_id: member?.discord_user_id || "",
		display_index: member?.display_index?.toString() || "",
		image_url: member?.image_url || "",
		is_active: member?.is_active ?? true,
		member_link: member?.member_link || "",
		name: member?.name || "",
		role: member?.role || "",
		team_id: member?.team_id || "",
	});
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string>(member?.image_url || "");

	// Reset form when dialog opens/closes or member changes
	useEffect(() => {
		if (open) {
			setFormData({
				discord_user_id: member?.discord_user_id || "",
				display_index: member?.display_index?.toString() || "",
				image_url: member?.image_url || "",
				is_active: member?.is_active ?? true,
				member_link: member?.member_link || "",
				name: member?.name || "",
				role: member?.role || "",
				team_id: member?.team_id || "",
			});
			setPreviewUrl(member?.image_url || "");
			setImageFile(null);
		}
	}, [open, member]);

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setImageFile(file);
			const reader = new FileReader();
			reader.onloadend = () => {
				setPreviewUrl(reader.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleRemoveImage = () => {
		setImageFile(null);
		setPreviewUrl("");
		setFormData({ ...formData, image_url: "" });
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			let finalImageUrl = formData.image_url;

			// Upload de l'image si un fichier est sélectionné
			if (imageFile) {
				const { url, error } = await uploadTeamMemberImage(imageFile);
				if (error) {
					toast.error("Erreur lors de l'upload de l'image", {
						description: error,
					});
					setLoading(false);
					return;
				}
				finalImageUrl = url || "";
			}

			const teamName =
				TEAM_OPTIONS.find((t) => t.value === formData.team_id)?.label ||
				formData.team_id;

			const memberData = {
				discord_user_id: formData.discord_user_id || undefined,
				display_index: formData.display_index
					? parseInt(formData.display_index, 10)
					: undefined,
				image_url: finalImageUrl,
				is_active: formData.is_active,
				member_link: formData.member_link || undefined,
				name: formData.name,
				role: formData.role,
				team_id: formData.team_id,
				team_name: teamName,
			};

			if (member) {
				// Mise à jour
				const { error } = await updateTeamMember(member.id, memberData);
				if (error) {
					toast.error("Erreur lors de la mise à jour", {
						description: error,
					});
					setLoading(false);
					return;
				}
				toast.success("Membre mis à jour avec succès");
			} else {
				// Création
				const { error } = await createTeamMember(memberData);
				if (error) {
					toast.error("Erreur lors de la création", {
						description: error,
					});
					setLoading(false);
					return;
				}
				toast.success("Membre créé avec succès");
			}

			onSuccess();
			onOpenChange(false);
		} catch (error) {
			console.error("Error submitting form:", error);
			toast.error("Une erreur est survenue");
		} finally {
			setLoading(false);
		}
	};

	return (
		<ResponsiveDialog
			open={open}
			onOpenChange={onOpenChange}
			title={`${member ? "Modifier" : "Ajouter"} un membre d'équipe`}
			description="Remplissez les informations du membre d'équipe. Les champs marqués d'un * sont obligatoires."
		>
			<form onSubmit={handleSubmit} className="p-1">
				<Tabs defaultValue="general" className="w-full">
					<TabsList className="grid w-full grid-cols-2 mb-4">
						<TabsTrigger value="general">Infos Générales</TabsTrigger>
						<TabsTrigger value="details">Détails & Image</TabsTrigger>
					</TabsList>

					<TabsContent value="general" className="space-y-4">
						{/* Équipe */}
						<div className="space-y-2">
							<Label htmlFor="team_id">
								Équipe <span className="text-red-500">*</span>
							</Label>
							<Select
								value={formData.team_id}
								onValueChange={(value) =>
									setFormData({ ...formData, team_id: value })
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Sélectionnez une équipe" />
								</SelectTrigger>
								<SelectContent>
									{TEAM_OPTIONS.map((team) => (
										<SelectItem key={team.value} value={team.value}>
											{team.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Nom */}
						<div className="space-y-2">
							<Label htmlFor="name">
								Nom <span className="text-red-500">*</span>
							</Label>
							<Input
								id="name"
								value={formData.name}
								onChange={(e) =>
									setFormData({ ...formData, name: e.target.value })
								}
								placeholder="Ex: Jean Dupont"
								required
							/>
						</div>

						{/* Rôle */}
						<div className="space-y-2">
							<Label htmlFor="role">
								Rôle <span className="text-red-500">*</span>
							</Label>
							<Input
								id="role"
								value={formData.role}
								onChange={(e) =>
									setFormData({ ...formData, role: e.target.value })
								}
								placeholder="Ex: Développeur, Dessinateur..."
								required
							/>
						</div>

						{/* Actif */}
						<div className="flex items-center space-x-2 pt-2">
							<Switch
								id="is_active"
								checked={formData.is_active}
								onCheckedChange={(checked) =>
									setFormData({ ...formData, is_active: checked })
								}
							/>
							<Label htmlFor="is_active">
								Membre actif (visible sur le site)
							</Label>
						</div>
					</TabsContent>

					<TabsContent value="details" className="space-y-4">
						{/* Image */}
						<div className="space-y-2">
							<Label>Image de profil</Label>
							<div className="flex items-start gap-4">
								{previewUrl ? (
									<div className="relative size-24 rounded-full overflow-hidden border-2 border-border shrink-0">
										<Image
											src={previewUrl}
											alt="Preview"
											fill
											sizes="96px"
											className="object-cover"
										/>
										<Button
											type="button"
											variant="destructive"
											size="icon"
											className="absolute top-1 right-1 size-5"
											onClick={handleRemoveImage}
										>
											<X className="size-3" />
										</Button>
									</div>
								) : (
									<div className="size-24 rounded-full border-2 border-dashed border-border flex items-center justify-center shrink-0">
										<Upload className="size-6 text-muted-foreground" />
									</div>
								)}
								<div className="flex-1 space-y-2">
									<Input
										type="file"
										accept="image/*"
										onChange={handleImageChange}
										className="text-sm"
									/>
									<p className="text-xs text-muted-foreground">
										Format recommandé : PNG ou JPG, 400x400px
									</p>
								</div>
							</div>
						</div>

						{/* Index d'affichage */}
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="display_index">Ordre</Label>
								<Input
									id="display_index"
									type="number"
									value={formData.display_index}
									onChange={(e) =>
										setFormData({ ...formData, display_index: e.target.value })
									}
									placeholder="1"
								/>
							</div>
							{/* Discord User ID */}
							<div className="space-y-2">
								<Label htmlFor="discord_user_id">ID Discord</Label>
								<Input
									id="discord_user_id"
									value={formData.discord_user_id}
									onChange={(e) =>
										setFormData({
											...formData,
											discord_user_id: e.target.value,
										})
									}
									placeholder="1234..."
								/>
							</div>
						</div>

						{/* Lien membre */}
						<div className="space-y-2">
							<Label htmlFor="member_link">Lien Profil (optionnel)</Label>
							<Input
								id="member_link"
								type="url"
								value={formData.member_link}
								onChange={(e) =>
									setFormData({ ...formData, member_link: e.target.value })
								}
								placeholder="https://..."
							/>
						</div>
					</TabsContent>
				</Tabs>

				<div className="mt-6 flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						Annuler
					</Button>
					<Button type="submit" disabled={loading}>
						{loading ? "Enregistrement..." : (member ? "Mettre à jour" : "Créer")}
					</Button>
				</div>
			</form>
		</ResponsiveDialog>
	);
}