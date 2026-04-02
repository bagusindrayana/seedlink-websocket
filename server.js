import { WebSocketServer } from "ws";
import http from "http";
import net from "net";

const PORT = process.env.PORT || 8080;

const server = http.createServer();

const wss = new WebSocketServer({ server });

const SEEDLINK_HOST = "geofon.gfz-potsdam.de";
const SEEDLINK_PORT = 18000;

wss.on("connection", (ws) => {
  console.log("Browser client connected");

  // Simpan referensi socket SeedLink untuk client ini
  let seedlinkSocket = null;

  ws.on("message", (message) => {
    try {
      const config = JSON.parse(message);
      // Tambahkan ekstraksi start_time dan end_time
      const {
        net: network,
        sta: station,
        cha: channel,
        start_time,
        end_time,
      } = config;

      if (network && station && channel) {
        console.log(
          `Client requested stream: ${network}_${station} (${channel})`,
        );
        if (start_time) {
          console.log(`Time window: ${start_time} to ${end_time || "Present"}`);
        }

        // Jika client sudah punya koneksi aktif, tutup dulu sebelum ganti stasiun
        if (seedlinkSocket) {
          seedlinkSocket.destroy();
        }

        // Mulai koneksi SeedLink baru untuk stasiun yang diminta dengan parameter waktu
        seedlinkSocket = createSeedLinkConnection(
          ws,
          network,
          station,
          channel,
          start_time,
          end_time,
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

// Tambahkan parameter start_time dan end_time ke fungsi
function createSeedLinkConnection(
  ws,
  network,
  station,
  channel,
  start_time,
  end_time,
) {
  const seedlink = new net.Socket();
  let state = "HANDSHAKE";

  console.log(`Connecting to SeedLink for ${station}...`);

  seedlink.connect(SEEDLINK_PORT, SEEDLINK_HOST, () => {
    seedlink.write("HELLO\r\n");
  });

  seedlink.on("data", (chunk) => {
    if (state === "HANDSHAKE") {
      state = "CONFIGURING";

      // Susun perintah DATA berdasarkan apakah klien mengirimkan waktu atau tidak
      let dataCommand = "DATA\r\n";

      // Jika ada waktu mulai, formatnya menjadi: DATA ALL start_time [end_time]
      if (start_time && end_time) {
        dataCommand = `DATA ALL ${start_time} ${end_time}\r\n`;
      } else if (start_time) {
        dataCommand = `DATA ALL ${start_time}\r\n`;
      }

      // Kirim konfigurasi dinamis berdasarkan input client
      seedlink.write(`STATION ${station} ${network}\r\n`);
      seedlink.write(`SELECT ${channel}\r\n`);
      seedlink.write(dataCommand);

      // Gunakan END untuk real-time (bisa diganti ENDFETCH jika hanya ingin mengunduh data lampau lalu tutup)
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

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
