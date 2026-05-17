// Test rapide des Server Actions pour Staff
// Exécuter avec: node --loader ts-node/esm test-staff.mjs
/* eslint-disable no-console */

import { getAllTeamMembers } from "./actions";

async function testStaff() {
  console.log("🧪 Test des Server Actions Staff...\n");

  try {
    const { data, error } = await getAllTeamMembers();

    if (error) {
      console.error("❌ Erreur:", error);
      return;
    }

    console.log("✅ Récupération réussie!");
    console.log(`📊 Total membres: ${data?.length || 0}`);

    if (data && data.length > 0) {
      console.log("\n👥 Équipes trouvées:");
      const teams = [...new Set(data.map((m) => m.team_id))];
      teams.forEach((team) => {
        const count = data.filter((m) => m.team_id === team).length;
        console.log(`  - ${team}: ${count} membre(s)`);
      });
    } else {
      console.log("ℹ️  Aucun membre dans la base de données");
    }
  } catch (err) {
    console.error("❌ Erreur inattendue:", err);
  }
}

// Décommenter pour exécuter
// testStaff();

export { testStaff };
