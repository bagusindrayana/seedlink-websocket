import net from "net";

/**
 * This script connects to a SeedLink server and requests the station catalog (CAT command).
 * It uses the server address found in seedlink-server.js.
 */

const SEEDLINK_HOST = "geofon.gfz-potsdam.de";
const SEEDLINK_PORT = 18000;

const client = new net.Socket();

console.log(`Connecting to SeedLink server at ${SEEDLINK_HOST}:${SEEDLINK_PORT}...`);

client.connect(SEEDLINK_PORT, SEEDLINK_HOST, () => {
  console.log("Connected! Requesting station list (CAT)...");
  // The 'CAT' command requests the server's station catalog.
  client.write("CAT\r\n");
});

client.on("data", (chunk) => {
  // Convert buffer to string and print to console
  process.stdout.write(chunk.toString());
});

client.on("end", () => {
  console.log("\nFinished receiving data. Server closed connection.");
  process.exit(0);
});

client.on("error", (err) => {
  console.error("\nSocket error:", err.message);
  process.exit(1);
});

// Set a timeout to automatically close the connection after 10 seconds
// in case the server keeps the connection open.
setTimeout(() => {
  console.log("\n--- Closing connection (Timeout) ---");
  client.destroy();
  process.exit(0);
}, 10000);
