// Seeds the brand-agnostic Specification Library: functional domains → groups →
// flat attributes. Idempotent — groups matched by name, attributes by key, so
// re-running only fills gaps and never clobbers manual edits.
//
// Run: npx dotenv-cli -e .env.local -- node db/seed-specification-library.mjs
import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
if (!DB_HOST || !DB_PORT || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  throw new Error("Missing DB credentials in environment");
}

// Attribute shorthands.
const num = (label, unit, range = false) => ({ label, type: "number", unit, range });
const sel = (label, options) => ({ label, type: "select", options });
const multi = (label, options) => ({ label, type: "multi", options });
const yn = (label) => ({ label, type: "yesno" });

const LIBRARY = [
  { domain: "core", name: "Power", attrs: [
    multi("Power Supply Mode (input)", ["AC", "Built-in AC", "DC", "PoE", "Battery", "Bus-powered"]),
    num("AC Input Voltage Range", "V", true),
    num("DC Input Voltage Range", "V", true),
    sel("PoE Input Type", ["802.3af (PoE)", "802.3at (PoE+)", "802.3bt (PoE++)"]),
    yn("PoE Output (provides PoE)"),
    multi("PoE Output Type", ["802.3af", "802.3at", "802.3bt"]),
    num("PoE Budget", "W"),
    num("Power Consumption (idle)", "W"),
    num("Power Consumption (full)", "W"),
    num("Operating Power (device draw)", "W"),
    num("Max Power Consumption", "W"),
    num("Battery Life", "years"),
    sel("Battery Type", ["Replaceable (AA / CR123A)", "Sealed / built-in", "Lithium-ion", "VRLA"]),
    yn("Redundant Power"),
  ] },
  { domain: "core", name: "Physical & General", attrs: [
    sel("Form Factor", ["Desktop", "Tower", "1U Rack", "2U Rack", "DIN Rail", "Wall-mount", "Ceiling", "Outdoor"]),
    sel("Housing Material", ["Plastic / polycarbonate", "ABS", "Aluminium", "Sheet steel", "Stainless steel (304 / 316L)"]),
    yn("Fanless"),
    yn("Cloud Management"),
    num("Operating Temperature", "°C", true),
    sel("IP Rating (ingress)", ["None", "IP20", "IP40", "IP54", "IP65", "IP66", "IP67", "IP68"]),
    sel("IK Rating (impact)", ["None", "IK07", "IK08", "IK09", "IK10"]),
    multi("Certification", ["Safety", "EMC", "Manufacturing", "EN-standard"]),
    num("Dimensions (W×H×D)", "mm"),
    num("Weight", "kg"),
    yn("Mounting Kit Included"),
  ] },
  { domain: "core", name: "Commercial & Compliance", attrs: [
    num("Warranty Period", "months"),
    sel("Country of Origin", ["China", "Taiwan", "South Korea", "Japan", "USA", "Germany", "Saudi Arabia", "Other"]),
    multi("Regional Certification", ["CE", "FCC", "SASO / SABER (Saudi)", "RoHS", "UL"]),
    sel("Lifecycle Status", ["Active", "Pre-order", "End-of-Sale (EOS)", "End-of-Life (EOL)"]),
    num("Packaged Weight", "kg"),
  ] },

  { domain: "networking", name: "Ports & Switching", attrs: [
    sel("RJ45 Downlink Ports", ["5", "8", "16", "24", "32", "48", "64", "96", "128"]),
    multi("RJ45 Downlink Speed", ["10/100/1000BASE-T", "2.5GBASE-T (mGig)", "5GBASE-T", "10GBASE-T"]),
    sel("RJ45 Uplink Ports", ["1", "2", "4", "8"]),
    sel("SFP Downlink Ports", ["2", "4", "8", "16", "24", "48"]),
    sel("SFP Uplink Ports", ["1", "2", "4", "8"]),
    multi("SFP Type", ["SFP (GE)", "SFP+ (10GE)", "SFP28 (25GE)", "QSFP+ (40GE)", "QSFP28 (100GE)"]),
    yn("Combo / Dual-purpose Ports"),
    sel("Stack Ports", ["0", "2"]),
    num("Switching Capacity", "Gbps"),
    num("Packet Forwarding Rate", "Mpps"),
    yn("Stacking"),
    num("Max Stack Members", "devices"),
    sel("Management Level", ["Unmanaged", "Smart / Lite", "Managed L2", "Managed L3"]),
  ] },
  { domain: "networking", name: "Wireless", attrs: [
    multi("Wi-Fi Standard", ["2.4GHz: 802.11b/g/n/ax", "5GHz: 802.11a/n/ac/ax", "6GHz: 802.11ax", "Wi-Fi 7 (be)"]),
    sel("Wi-Fi Generation", ["Wi-Fi 4", "Wi-Fi 5", "Wi-Fi 6", "Wi-Fi 6E", "Wi-Fi 7"]),
    multi("Frequency Bands", ["2.4 GHz", "5 GHz", "6 GHz"]),
    num("Max Access Users", "users"),
    num("Recommended Access Users", "users"),
    num("Aggregate Throughput", "Gbps"),
    sel("Antenna Type", ["Internal", "External"]),
    num("Outdoor Range", "m"),
  ] },

  { domain: "control_panel", name: "Control Panel / Hub", attrs: [
    sel("Panel Type", ["Wireless-only", "Hybrid (wireless + wired bus)"]),
    num("Max Devices Supported", "devices"),
    sel("Wireless Protocol", ["Proprietary sub-GHz radio", "Zigbee", "Z-Wave", "Matter / Thread"]),
    sel("Wired Bus", ["None", "Proprietary wired bus (2-wire line)"]),
    num("Wired Bus Lines", "count"),
    multi("Network Connection", ["Ethernet", "Wi-Fi", "SIM 1", "SIM 2"]),
    multi("Cellular", ["2G", "3G", "LTE"]),
    sel("SIM Slots", ["1", "2"]),
  ] },
  { domain: "control_panel", name: "Detectors & Peripherals", attrs: [
    sel("Device Role", ["Detector", "Keypad", "Siren", "Button / fob", "Range extender", "Integration module", "Relay"]),
    multi("Connection", ["Wireless (radio)", "Wired bus"]),
    multi("Detector Type", ["Motion (PIR)", "Glass break", "Opening (reed)", "Shock / tilt", "Seismic", "Combined"]),
    multi("Additional Sensors", ["Microwave", "Anti-masking", "Accelerometer", "Microphone", "Temperature"]),
    sel("Indoor / Outdoor", ["Indoor", "Outdoor", "Both"]),
    num("Detection Range", "m"),
    yn("Pet Immunity"),
    multi("Keypad Authentication", ["Code", "Card", "Tag", "Smartphone"]),
    sel("Siren Placement", ["Indoor", "Outdoor"]),
    num("Siren Volume", "dB"),
    num("Integration Inputs", "count"),
    num("Relay Channels", "count"),
    yn("Photo Verification"),
  ] },
  { domain: "control_panel", name: "Fire & Life Safety", attrs: [
    multi("Fire Sensor Types", ["Smoke (optical)", "Heat (thermal)", "CO (carbon monoxide)"]),
    sel("Certification Line", ["Commercial-certified (EN54)", "Residential"]),
    yn("Built-in Sounder"),
    yn("Interconnected Alarm"),
    multi("Detection Modes", ["Combined", "Heat+Smoke independent", "Heat only", "Smoke only"]),
    sel("Power Variant", ["Replaceable battery", "AC-powered", "Sealed battery"]),
    num("Service Life", "years"),
    yn("Visual Alarm Device (VAD)"),
  ] },

  { domain: "video", name: "Camera", attrs: [
    sel("Camera Form", ["Bullet", "Dome", "Turret / Eyeball", "PTZ / Speed Dome", "Box", "Cube", "Multisensor / Panoramic"]),
    sel("Resolution", ["2MP", "4MP", "5MP", "6MP", "8MP (4K)", "12MP"]),
    sel("Lens Type", ["Fixed", "Varifocal", "Motorized zoom"]),
    num("Lens Focal Length", "mm", true),
    sel("Signal Type", ["IP (network)", "HDCVI", "HD-TVI", "AHD", "Analog"]),
    sel("Night Vision", ["IR (infrared)", "Color / low-light", "Hybrid dual-light", "None"]),
    multi("Smart Analytics", ["Person / vehicle detection", "ANPR / LPR", "Face recognition", "Line crossing"]),
    multi("Power Method", ["PoE", "12V DC", "AC", "Wi-Fi", "4G / cellular", "Battery"]),
    yn("Audio"),
    sel("Weatherproofing", ["Indoor", "IP65", "IP66", "IP67"]),
    multi("Connectivity", ["Ethernet", "Wi-Fi", "4G", "2-wire"]),
  ] },
  { domain: "video", name: "Recorder (NVR / DVR)", attrs: [
    sel("Recorder Type", ["NVR (IP)", "DVR (analog / HD)", "Hybrid / XVR"]),
    sel("Recording Channels", ["4", "8", "16", "24", "32", "64", "128", "256"]),
    sel("Built-in PoE Ports", ["0", "4", "8", "16"]),
    sel("Max Resolution per Channel", ["2MP", "4MP", "8MP (4K)", "12MP", "16MP", "32MP"]),
    num("HDD Bays", "count"),
    num("Max Storage per Bay", "TB"),
    num("Incoming Bandwidth", "Mbps"),
    yn("AI / Smart Features"),
  ] },

  { domain: "access", name: "Access Control", attrs: [
    sel("Access Device Type", ["Card reader", "Keypad reader", "Face terminal", "Fingerprint terminal", "Access controller", "Exit button"]),
    multi("Credential Types", ["RFID card (EM / Mifare)", "PIN", "Fingerprint", "Face", "Palm", "Mobile / NFC", "QR code"]),
    sel("Doors Controlled", ["1", "2", "4", "8"]),
    multi("Reader Interface", ["Wiegand", "RS-485", "OSDP", "TCP/IP"]),
    sel("Standalone or Networked", ["Standalone", "Networked (controller-based)"]),
    multi("Access Power Method", ["PoE", "12V DC", "AC"]),
    sel("Access Weatherproofing", ["Indoor", "IP65", "IP66", "IP67"]),
  ] },
  { domain: "access", name: "Video Intercom / Doorphone", attrs: [
    sel("Intercom Device Type", ["Outdoor door station", "Indoor monitor", "Villa kit", "Modular door station", "Wireless doorbell"]),
    sel("System Type", ["IP (network)", "2-wire", "Analog", "Wi-Fi wireless"]),
    yn("Camera"),
    sel("Camera Resolution", ["2MP", "4MP", "None (audio-only)"]),
    num("Display Size", "inches"),
    yn("Touchscreen"),
    sel("Mounting", ["Flush / recessed", "Surface / on-wall"]),
    multi("Access Integration", ["Card reader", "Keypad", "Face", "App unlock"]),
    multi("Intercom Power Method", ["PoE", "2-wire bus", "12V DC"]),
  ] },

  { domain: "unified_comms", name: "IP PBX / Call Platform", attrs: [
    sel("Deployment Type", ["On-premise appliance", "Cloud", "Software"]),
    num("Max Users / Extensions", "users"),
    num("Max Concurrent Calls", "calls"),
    sel("Analog FXS Ports", ["0", "2", "4", "8"]),
    sel("Analog FXO Ports", ["0", "2", "4", "8"]),
    num("Network Ports", "count"),
    yn("PoE on Network Ports"),
    yn("Built-in Conferencing"),
    yn("High Availability"),
  ] },
  { domain: "unified_comms", name: "SIP Endpoint (Phone / ATA / Door)", attrs: [
    sel("Endpoint Type", ["Desk phone", "Hotel phone", "Cordless (DECT)", "Cordless (Wi-Fi)", "Video phone", "ATA", "Door intercom"]),
    sel("SIP Accounts", ["1", "2", "3", "4", "6", "8", "16"]),
    num("Line Keys", "count"),
    sel("Display", ["None", "Monochrome LCD", "Color LCD", "Touchscreen"]),
    sel("PoE", ["PoE (802.3af)", "PoE+ (802.3at)", "No PoE (adapter)"]),
    sel("Gigabit Ports", ["0", "1", "2"]),
    yn("Built-in Wi-Fi"),
    yn("Bluetooth"),
    multi("Voice Codecs", ["G.711", "G.722 (HD)", "G.729", "Opus", "iLBC"]),
    multi("Headset Support", ["RJ9", "EHS", "USB", "Bluetooth"]),
  ] },
  { domain: "unified_comms", name: "Gateway / ATA", attrs: [
    sel("Gateway Type", ["FXS gateway (analog phones)", "FXO gateway (PSTN lines)", "Hybrid FXS/FXO"]),
    sel("FXS Ports", ["1", "2", "4", "8", "16", "24", "32", "48"]),
    sel("FXO Ports", ["1", "2", "4", "8", "16", "24", "32", "48"]),
    num("Concurrent Calls", "calls"),
    sel("Gateway Network Ports", ["1", "2"]),
  ] },
  { domain: "unified_comms", name: "Conferencing & Collaboration", attrs: [
    sel("Device Type", ["Video conferencing endpoint", "Audio conference phone", "Webcam", "Headset", "Speaker"]),
    sel("Video Resolution", ["720p", "1080p Full HD", "4K"]),
    num("Camera Field of View", "°"),
    num("Microphone Pickup Range", "m"),
    multi("Connection", ["USB", "Bluetooth", "Wi-Fi", "SIP", "HDMI"]),
    num("Speaker Power", "W"),
    yn("Wireless Mic Expansion"),
  ] },

  { domain: "audio", name: "Audio Streaming & Control", attrs: [
    multi("Streaming Protocols", ["AirPlay", "AirPlay 2", "Spotify Connect", "Tidal Connect", "Qobuz Connect", "Google Cast", "Alexa Cast", "DLNA"]),
    yn("Multiroom"),
    multi("Bluetooth", ["Receiver", "Transmitter", "aptX"]),
    yn("Wi-Fi"),
    multi("Voice Assistant", ["Alexa", "Google Assistant", "None"]),
    multi("Control", ["App", "IR remote", "PC tool", "Web"]),
    yn("Hi-Res Audio"),
  ] },
  { domain: "audio", name: "Amplifier", attrs: [
    sel("Amplifier Type", ["Streaming amp", "Power amp", "Pre-amp (streamer, no power)", "Integrated"]),
    num("Output Power per Channel", "W"),
    sel("Channels", ["2 (stereo)", "2.1 (with sub)", "4", "6"]),
    multi("Speaker Impedance Support", ["4Ω", "6Ω", "8Ω"]),
    sel("Class", ["Class D", "Class AB"]),
    yn("Sub Output"),
    yn("Built-in DAC"),
  ] },
  { domain: "audio", name: "Audio Inputs / Outputs", attrs: [
    multi("Audio Inputs", ["HDMI ARC", "Phono (turntable)", "Optical (Toslink)", "Coax", "RCA", "USB", "Line In", "PC DAC"]),
    multi("Audio Outputs", ["Speaker terminals", "Sub out", "RCA out", "Optical out"]),
    yn("Network Port"),
    yn("Phono Preamp"),
  ] },
  { domain: "audio", name: "Speaker", attrs: [
    sel("Speaker Type", ["In-ceiling", "In-wall", "Wall cube", "Bookshelf", "Outdoor", "Active (powered)"]),
    num("Power Handling", "W"),
    sel("Impedance", ["4Ω", "6Ω", "8Ω"]),
    num("Driver Size", "inches"),
    num("Frequency Response", "Hz", true),
    sel("Placement", ["Indoor", "Outdoor (weatherproof)"]),
  ] },

  { domain: "power_racks", name: "UPS (Uninterruptible Power Supply)", attrs: [
    sel("UPS Topology", ["Standby / offline", "Line-interactive", "Online double-conversion"]),
    num("Apparent Power", "VA"),
    num("Real Power", "W"),
    sel("UPS Form Factor", ["Desktop / compact", "Tower", "Rackmount", "Rack/Tower convertible"]),
    sel("Rack Height", ["1U", "2U", "3U", "4U"]),
    num("Runtime at Half Load", "min"),
    num("Output Voltage", "V"),
    multi("Output Outlets", ["IEC C13", "IEC C19", "Schuko", "Universal"]),
    num("Outlet Count", "count"),
    sel("Network Management", ["None", "SNMP card slot", "Built-in network card"]),
    sel("UPS Battery Type", ["Sealed lead-acid (VRLA)", "Lithium-ion"]),
    yn("Hot-Swap Battery"),
    yn("Pure Sine Wave"),
  ] },
  { domain: "power_racks", name: "PDU (Rack Power Distribution)", attrs: [
    sel("PDU Type", ["Basic", "Metered (input)", "Metered-by-outlet", "Switched", "Switched + metered"]),
    sel("PDU Mounting", ["Horizontal (1U/2U rack)", "Vertical (0U, zero-U)"]),
    sel("Phase", ["Single-phase", "Three-phase"]),
    num("Input Current", "A"),
    multi("Outlet Types", ["IEC C13", "IEC C19", "Schuko", "Universal"]),
    num("PDU Outlet Count", "count"),
    yn("Remote Monitoring"),
  ] },
  { domain: "power_racks", name: "Rack / Enclosure", attrs: [
    sel("Enclosure Type", ["Open frame (2-post)", "Open frame (4-post)", "Enclosed cabinet", "Wall-mount", "Floor-standing", "Small / compact", "Outdoor", "Hygienic", "Micro data center"]),
    sel("Mounting Standard", ["19\" (IT rack)", "Industrial (non-19\")", "DIN"]),
    sel("Material", ["Sheet steel", "Stainless steel (304 / 316L)", "Aluminium", "Polycarbonate / plastic"]),
    num("Rack Height (U)", "U"),
    num("Width", "mm"),
    num("Height", "mm"),
    num("Depth", "mm"),
    num("Load Capacity", "kg"),
    sel("IP / IK Protection", ["None", "IP54", "IP55", "IP66"]),
    multi("Cooling", ["Passive vents", "Fan kit", "AC cooling unit", "Air/water heat exchanger", "In-row cooling"]),
    sel("Doors", ["None (open)", "Perforated", "Glass", "Solid"]),
    yn("Lockable"),
    yn("Cable Management"),
  ] },

  { domain: "passive", name: "Cabling & Passive", attrs: [
    sel("Cable Category", ["Cat5e", "Cat6", "Cat6A", "Cat7", "Cat8"]),
    sel("Cable Speed Rating", ["1GbE", "2.5GbE", "5GbE", "10GbE"]),
    multi("Connector Type", ["RJ45", "LC", "SC", "MPO"]),
    sel("Fiber Mode", ["Single-mode", "Multi-mode (OM3 / OM4 / OM5)"]),
    num("Length", "m"),
    sel("Shielding", ["UTP", "FTP", "STP", "SFTP"]),
    num("Rack Units", "U"),
  ] },
];

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const conn = await mysql.createConnection({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 5000,
});

const toSpecFields = (attr) => {
  if (attr.type === "number") {
    return {
      valueType: "number",
      unit: attr.unit,
      allowMultiple: false,
      allowRange: Boolean(attr.range),
      options: [],
    };
  }
  const options =
    attr.type === "yesno"
      ? ["Yes", "No"]
      : attr.options;
  return {
    valueType: "select",
    unit: null,
    allowMultiple: attr.type === "multi",
    allowRange: false,
    options: options.map((value) => ({ value, children: [] })),
  };
};

try {
  // Preload existing keys + group names once, so the run makes few round-trips
  // and stays idempotent (skip attributes already seeded by key).
  const dbKeys = new Set();
  const [existingSpecs] = await conn.query("SELECT `key` FROM `Specifications`");
  for (const row of existingSpecs) {
    dbKeys.add(row.key);
  }
  const groupUuidByName = new Map();
  const [existingGroups] = await conn.query(
    "SELECT `uuid`, `name` FROM `SpecificationGroups`",
  );
  for (const row of existingGroups) {
    groupUuidByName.set(row.name, row.uuid);
  }

  const runKeys = new Set();
  let groupOrder = 0;
  let createdGroups = 0;
  let createdSpecs = 0;

  for (const group of LIBRARY) {
    let groupUuid = groupUuidByName.get(group.name);
    if (groupUuid) {
      await conn.execute(
        "UPDATE `SpecificationGroups` SET `domain` = ?, `order` = ? WHERE `uuid` = ?",
        [group.domain, groupOrder, groupUuid],
      );
    } else {
      groupUuid = randomUUID();
      await conn.execute(
        "INSERT INTO `SpecificationGroups` (`uuid`, `name`, `domain`, `order`) VALUES (?, ?, ?, ?)",
        [groupUuid, group.name, group.domain, groupOrder],
      );
      createdGroups++;
    }
    groupOrder++;

    // Build one batched multi-row insert for this group's new attributes.
    const rows = [];
    let specOrder = 0;
    for (const attr of group.attrs) {
      const baseKey = slugify(attr.label);
      let key = baseKey;
      if (dbKeys.has(key)) {
        // Already seeded — leave it untouched.
        specOrder++;
        continue;
      }
      if (runKeys.has(key)) {
        let n = 2;
        while (runKeys.has(`${baseKey}-${n}`) || dbKeys.has(`${baseKey}-${n}`)) {
          n++;
        }
        key = `${baseKey}-${n}`;
      }
      runKeys.add(key);

      const fields = toSpecFields(attr);
      rows.push([
        randomUUID(),
        groupUuid,
        attr.label,
        key,
        fields.valueType,
        fields.unit,
        fields.allowMultiple ? 1 : 0,
        fields.allowRange ? 1 : 0,
        JSON.stringify(fields.options),
        specOrder,
      ]);
      specOrder++;
    }

    if (rows.length > 0) {
      await conn.query(
        "INSERT INTO `Specifications` (`uuid`, `group_uuid`, `label`, `key`, `value_type`, `unit`, `allow_multiple`, `allow_range`, `options`, `order`) VALUES ?",
        [rows],
      );
      createdSpecs += rows.length;
    }
  }

  console.log(
    `Seed complete: ${createdGroups} new groups, ${createdSpecs} new attributes across ${LIBRARY.length} groups.`,
  );
} finally {
  await conn.end();
}
