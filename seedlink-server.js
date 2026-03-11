import { WebSocketServer } from "ws";
import net from "net";

const wss = new WebSocketServer({ port: 8080 });
const clients = new Set();

wss.on("connection", (ws) => {
  console.log("Browser client connected");
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

const SEEDLINK_HOST = "geofon.gfz-potsdam.de";
const SEEDLINK_PORT = 18000;

function connectSeedLink() {
  const seedlink = new net.Socket();
  let state = "HANDSHAKE";

  console.log(`Connecting to SeedLink at ${SEEDLINK_HOST}...`);

  seedlink.connect(SEEDLINK_PORT, SEEDLINK_HOST, () => {
    console.log("Socket connected, sending HELLO...");
    seedlink.write("HELLO\r\n");
  });

  seedlink.on("data", (chunk) => {
    const response = chunk.toString();

    if (state === "HANDSHAKE") {
      // Tunggu jawaban HELLO (biasanya berisi info server)
      console.log("Server Info:", response.split("\n")[0]);

      state = "CONFIGURING";
      console.log("Sending station configuration...");

      // // Kirim konfigurasi satu per satu dalam satu batch
      // const config =
      //   [
      //     "STATION JAGI GE",
      //     "SELECT BHZ",
      //     "STATION BNDI GE",
      //     "SELECT BHZ",
      //     "STATION BKB GE",
      //     "SELECT BHZ",
      //     "STATION GSI GE",
      //     "SELECT BHZ",
      //     "END", // Gunakan END untuk memulai streaming multi-station
      //   ].join("\r\n") + "\r\n";

      // seedlink.write(config);
      console.log("Requesting station: BKB (Balikpapan)");

      // Pilih Stasiun & Network
      seedlink.write("STATION GSI GE\r\n");

      // Pilih Channel (Z = Vertical, BH/HH = High Broadband)
      seedlink.write("SELECT BHZ\r\n");

      // Minta data (untuk single station langsung pakai DATA)
      seedlink.write("DATA\r\n");
      seedlink.write("END\r\n");
      state = "STREAMING";
    } else if (state === "STREAMING") {
      // Kirim ke semua client WebSocket
      clients.forEach((ws) => {
        if (ws.readyState === 1) ws.send(chunk);
      });
    }
  });

  seedlink.on("error", (err) => {
    console.error("SeedLink Error:", err.message);
  });

  seedlink.on("close", () => {
    console.log("Connection closed. Reconnecting in 10s...");
    setTimeout(connectSeedLink, 10000); // Jeda lebih lama agar tidak dianggap spam
  });
}

connectSeedLink();
