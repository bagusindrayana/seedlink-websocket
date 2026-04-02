import { WebSocketServer } from "ws";
import http from "http";
import net from "net";
import { URL } from "url";

const PORT = process.env.PORT || 8080;

const server = http.createServer();

const wss = new WebSocketServer({ server });

const SEEDLINK_HOST = "geofon.gfz-potsdam.de";
const SEEDLINK_PORT = 18000;

wss.on("connection", (ws, req) => {
  console.log("Browser client connected");

  // Parse URL untuk mendapatkan parameter query
  const url = new URL(req.url, `http://${req.headers.host}`);
  const startTime = url.searchParams.get("start_time");
  const endTime = url.searchParams.get("end_time");

  // Simpan referensi socket SeedLink untuk client ini
  let seedlinkSocket = null;

  ws.on("message", (message) => {
    try {
      const config = JSON.parse(message);
      const { net: network, sta: station, cha: channel } = config;

      if (network && station && channel) {
        console.log(
          `Client requested stream: ${network}_${station} (${channel})` +
            (startTime ? ` from ${startTime}` : "") +
            (endTime ? ` to ${endTime}` : ""),
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
          startTime,
          endTime,
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

function createSeedLinkConnection(
  ws,
  network,
  station,
  channel,
  startTime,
  endTime,
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
      // Kirim konfigurasi dinamis berdasarkan input client
      seedlink.write(`STATION ${station} ${network}\r\n`);
      seedlink.write(`SELECT ${channel}\r\n`);

      const formatSeedLinkTime = (isoTime) => {
        const date = new Date(isoTime);
        return [
          date.getUTCFullYear(),
          (date.getUTCMonth() + 1).toString().padStart(2, "0"),
          date.getUTCDate().toString().padStart(2, "0"),
          date.getUTCHours().toString().padStart(2, "0"),
          date.getUTCMinutes().toString().padStart(2, "0"),
          date.getUTCSeconds().toString().padStart(2, "0"),
        ].join(",");
      };

      if (startTime && endTime) {
        try {
          const formattedStartTime = formatSeedLinkTime(startTime);
          const formattedEndTime = formatSeedLinkTime(endTime);
          seedlink.write(`TIME ${formattedStartTime} ${formattedEndTime}\r\n`);
          console.log(
            `Requesting historical data for ${network}_${station} ${channel} from ${formattedStartTime} to ${formattedEndTime}`,
          );
        } catch (e) {
          console.error(
            `Error formatting time parameters: ${e.message}. Falling back to real-time data.`,
          );
          seedlink.write("DATA\r\n");
        }
      } else {
        seedlink.write("DATA\r\n");
      }

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

// console.log("WebSocket Server running on ws://localhost:8080");

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});
