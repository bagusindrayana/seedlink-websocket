import { WebSocketServer } from "ws";
import net from "net";

const wss = new WebSocketServer({ port: 8080 });

const SEEDLINK_HOST = "geofon.gfz-potsdam.de";
const SEEDLINK_PORT = 18000;

wss.on("connection", (ws) => {
  console.log("Browser client connected");

  // Simpan referensi socket SeedLink untuk client ini
  let seedlinkSocket = null;

  ws.on("message", (message) => {
    try {
      const config = JSON.parse(message);
      const { net: network, sta: station, cha: channel } = config;

      if (network && station && channel) {
        console.log(
          `Client requested stream: ${network}_${station} (${channel})`,
        );

        // Jika client sudah punya koneksi aktif, tutup dulu sebelum ganti stasiun
        if (seedlinkSocket) {
          seedlinkSocket.destroy();
        }

        // Mulai koneksi SeedLink baru untuk stasiun yang diminta
        seedlinkSocket = createSeedLinkConnection(
          ws,
          network,
          station,
          channel,
        );
      }
    } catch (err) {
      console.error("Invalid message format from client. Expected JSON.");
    }
  });

  ws.on("close", () => {
    console.log("Browser client disconnected");
    if (seedlinkSocket) seedlinkSocket.destroy();
  });
});

function createSeedLinkConnection(ws, network, station, channel) {
  const seedlink = new net.Socket();
  let state = "HANDSHAKE";

  console.log(`Connecting to SeedLink for ${station}...`);

  seedlink.connect(SEEDLINK_PORT, SEEDLINK_HOST, () => {
    seedlink.write("HELLO\r\n");
  });

  seedlink.on("data", (chunk) => {
    if (state === "HANDSHAKE") {
      state = "CONFIGURING";
      // Kirim konfigurasi dinamis berdasarkan input client
      seedlink.write(`STATION ${station} ${network}\r\n`);
      seedlink.write(`SELECT ${channel}\r\n`);
      seedlink.write("DATA\r\n");
      seedlink.write("END\r\n");
      state = "STREAMING";
      console.log(`Streaming started for ${network}_${station} ${channel}`);
    } else if (state === "STREAMING") {
      // Kirim data biner langsung ke client yang meminta
      if (ws.readyState === 1) {
        ws.send(chunk);
      }
    }
  });

  seedlink.on("error", (err) => {
    console.error(`SeedLink Error (${station}):`, err.message);
  });

  seedlink.on("close", () => {
    console.log(`SeedLink connection closed for ${station}`);
  });

  return seedlink;
}

console.log("WebSocket Server running on ws://localhost:8080");
