#!/usr/bin/env bash
# next-build.sh — build Next sous Bun, robuste au crash-à-l'exit de Bun 1.3.14.
#
# Sur certains CPU (dont ce VPS : sse42/avx2), `bun … next build` peut SIGILL
# (Illegal instruction / Segmentation fault) en QUITTANT, APRÈS avoir produit
# tous les artefacts (.next/BUILD_ID). Le combo `--smol --bun --turbopack` (le
# même qu'azalee) permet en plus de passer la phase "Collecting page data" qui
# crashait mid-build avec l'invocation nue.
#
# On valide donc le succès sur la PRÉSENCE D'UN BUILD_ID FRAIS plutôt que sur le
# code retour — sinon `turbo run build` marque l'app en échec alors que le build
# a réussi. Sur Vercel (CPU sans le bug), Bun sort proprement (exit 0) et la
# garde passe trivialement ; un vrai échec ne produit pas de BUILD_ID frais →
# exit non nul, l'erreur remonte correctement.
#
# Usage (depuis le répertoire de l'app) : bash ../../scripts/next-build.sh [args next…]
set -uo pipefail

build_start=$(date +%s)
bun --smol --bun node_modules/next/dist/bin/next build --turbopack "$@"
rc=$?

if [ -f .next/BUILD_ID ] && [ "$(stat -c %Y .next/BUILD_ID)" -ge "$build_start" ]; then
	if [ "$rc" -ne 0 ]; then
		echo "⚠ build OK (BUILD_ID $(cat .next/BUILD_ID)) — crash Bun à l'exit (code $rc) ignoré" >&2
	fi
	exit 0
fi

echo "✗ build réellement échoué — pas de BUILD_ID frais (exit $rc)" >&2
exit "$([ "$rc" -ne 0 ] && echo "$rc" || echo 1)"
