// Simulates a slow `aphrody x` CLI: waits 20 s, then answers.
await Bun.sleep(20_000);
const args = Bun.argv.slice(2);
if (args[1] === "user-tweets") console.log(JSON.stringify({ tweets: [{ id: "1850000000000000001", text: "post lent", author: { username: args[2], name: args[2] }, created_at: "Sat Oct 12 10:00:00 +0000 2026" }] }));
else console.log("{}");
