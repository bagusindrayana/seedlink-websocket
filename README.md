# SeedLink WebSocket Server

A WebSocket bridge that forwards real-time seismic data from the GEOFON SeedLink server to browser clients.

## Overview

This server:
- Connects to GEOFON SeedLink server (`geofon.gfz-potsdam.de:18000`)
- Accepts WebSocket connections from browsers
- Forwards seismic stream data based on client requests (network, station, channel)

## Requirements

- Node.js (ES modules supported)
- pnpm (or npm)

## Setup

```bash
# Install dependencies
pnpm install
```

## Usage

### Start the server

```bash
pnpm start
# Or: node server.js
```

Server runs on port `8080` (configurable via `PORT` env var).

### Client Example

Connect via WebSocket and send a JSON config:

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  ws.send(JSON.stringify({
    net: 'GE',
    sta: 'MSE',
    cha: 'BHZ'
  }));
};

ws.onmessage = (event) => {
  // Receive binary seismic data
  console.log(event.data);
};
```

### List Available Stations

```bash
node list-stations.js
```

## Files

| File | Description |
|------|-------------|
| `server.js` | Main WebSocket server (recommended) |
| `seedlink-server.js` | Alternative server implementation |
| `list-stations.js` | Utility to fetch station catalog from SeedLink |
