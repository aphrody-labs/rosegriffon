"use client";

import { useState } from "react";
import { Check, Copy, Code } from "lucide-react";
import { CROSS_CYAN } from "@/lib/cross/data-shared";

interface CSharpCodeViewerProps {
	code: string;
	className?: string;
	fullName: string;
}

export function CSharpCodeViewer({ code, className = "", fullName }: CSharpCodeViewerProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy text: ", err);
		}
	};

	// Simple regex-based syntax highlighter for C# to provide a premium look
	const highlightCSharp = (rawCode: string) => {
		// Escape HTML first
		let html = rawCode
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		// Comments (e.g. // Hérité de ...)
		html = html.replace(/(\/\/.*)/g, '<span class="text-on-surface-variant/40 italic">$1</span>');

		// Attributes (e.g. [Serializable])
		html = html.replace(/(\[[A-Za-z0-9_]+\])/g, '<span class="text-amber-500 font-semibold">$1</span>');

		// Keywords
		const keywords = ["using", "namespace", "public", "class", "get", "set"];
		const keywordsRegex = new RegExp(`\\b(${keywords.join("|")})\\b`, "g");
		html = html.replace(keywordsRegex, '<span class="text-[#00aeef] font-bold">$1</span>');

		// Types
		const types = [
			"void",
			"int",
			"long",
			"uint",
			"short",
			"byte",
			"float",
			"double",
			"decimal",
			"bool",
			"string",
			"object",
			"LocalizationKey",
			"List",
			"Dictionary",
		];
		const typesRegex = new RegExp(`\\b(${types.join("|")})\\b`, "g");
		html = html.replace(typesRegex, '<span class="text-[#f89c5a] font-medium">$1</span>');

		return html;
	};

	return (
		<div className={`rounded-2xl border border-outline-variant/60 bg-surface-container-lowest overflow-hidden flex flex-col ${className}`}>
			{/* Code header */}
			<div className="flex items-center justify-between px-4 py-3 bg-surface-container/30 border-b border-outline-variant/40">
				<div className="flex items-center gap-2">
					<Code size={16} className="text-on-surface-variant" style={{ color: CROSS_CYAN }} />
					<div className="flex flex-col">
						<span className="text-sm font-bold text-on-surface">Classe C# de mapping</span>
						<span className="text-xs text-on-surface-variant font-mono truncate max-w-[250px] sm:max-w-none">
							{fullName}
						</span>
					</div>
				</div>

				<button
					id="copy-csharp-code"
					type="button"
					onClick={handleCopy}
					className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
					title="Copier le code C#"
				>
					{copied ? (
						<>
							<Check size={14} className="text-green-500" />
							<span>Copié !</span>
						</>
					) : (
						<>
							<Copy size={14} />
							<span>Copier</span>
						</>
					)}
				</button>
			</div>

			{/* Code body */}
			<div className="relative flex-1">
				<pre className="p-4 overflow-auto max-h-[500px] text-xs font-mono leading-relaxed whitespace-pre bg-surface-container-lowest text-on-surface custom-scrollbar">
					<code
						dangerouslySetInnerHTML={{ __html: highlightCSharp(code) }}
						className="block"
					/>
				</pre>
			</div>
		</div>
	);
}
