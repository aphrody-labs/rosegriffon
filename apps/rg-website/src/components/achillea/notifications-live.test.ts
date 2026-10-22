import { describe, expect, test } from "bun:test";

import { EVENEMENT_NOTIFICATION, lireSignal, topicNotifications } from "./notifications-live";

describe("notifications Achilléa en direct", () => {
  test("topic et événement identiques au trigger SQL", async () => {
    expect(topicNotifications("123456789012345678")).toBe("achillea:notifications:123456789012345678");
    const migration = await Bun.file(
      new URL("../../../../../supabase/migrations/20261022_achillea_clans_temps_reel.sql", import.meta.url),
    ).text();
    expect(migration).toContain(`'${EVENEMENT_NOTIFICATION}'`);
    expect(migration).toContain("'achillea:notifications:' || new.user_id");
    expect(migration).toContain("'notificationId', new.notification_id");
  });

  test("ne lit qu'un identifiant de notification valide", () => {
    expect(lireSignal({ notificationId: 42, userNotificationId: 7 })).toEqual({ notificationId: 42 });
    expect(lireSignal({ notificationId: "x" })).toBeNull();
    expect(lireSignal(null)).toBeNull();
  });
});
