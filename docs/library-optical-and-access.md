# Optical / MiniFTTO and Access Control — the attributes to enter

§0.3 C and §6.2 of the master document record these two groups as **classified in
the tree but with zero attributes defined**: 11 optical products and 6 access
control products that nobody can enter, because there is nothing to enter them
against.

This is that library pass. Every attribute below is ready to create in
**Library → Attributes**, in the form the admin asks for it. Nothing here is
seeded — the rows are yours to create when you are ready, and the order given is
the order that works (shared lists first, since attributes point at them).

The units these need — `nm` and `doors` — are already in the dropdown.

---

## Before anything else: three shared lists

Create these in **Library → Shared lists**. They exist because both ends of an
optical link have to spell the same word for a rule to compare them: an OLT's
downstream wavelength and an ONU's upstream wavelength are the same vocabulary,
and two private lists that both say "1490 nm" are two different stored values
that no comparator can line up.

| Shared list | Ordered | Options |
|---|---|---|
| **Optical Wavelength** | yes | 1270 nm · 1310 nm · 1330 nm · 1490 nm · 1550 nm · 1577 nm |
| **PON Standard** | yes | EPON · GPON · 10G-EPON · XG-PON · XGS-PON · NG-PON2 |
| **Fibre Connector** | no | SC/UPC · SC/APC · LC/UPC · LC/APC · FC/UPC · MPO-12 |

Rank the wavelengths by their own number and the PON standards by line rate — the
ranks are what let a rule say "at least XGS-PON" rather than listing every
standard above it.

---

## 1 · Optical / MiniFTTO (nodes 2.A.1, 2.A.2)

### Engine-reading

| External name | Label | Type | Unit | Notes |
|---|---|---|---|---|
| `opt.pon_standard` | PON standard | single_select → **PON Standard** | — | Ordered. The OLT and the ONU must share one, so both sides borrow the set. |
| `opt.optical_budget_db` | Optical budget | number | dB | Ordered. The **supply** side of the link. |
| `opt.link_loss_db` | Link loss | number | dB | Ordered. The **demand** side. Two attributes, not one, because a Budget rule compares them — rule 2 of §1.4, exactly as `poe_budget_w` and `poe_draw_w`. |
| `opt.tx_wavelength_nm` | Transmit wavelength | multi_select → **Optical Wavelength** | — | |
| `opt.rx_wavelength_nm` | Receive wavelength | multi_select → **Optical Wavelength** | — | Split for the same reason: an OLT transmits at 1490 and receives at 1310, and one attribute could not say which end. |
| `opt.split_ratio` | Split ratio | single_select | — | Ordered: 1:2 · 1:4 · 1:8 · 1:16 · 1:32 · 1:64 · 1:128. Rank by the divisor. |
| `opt.pon_ports` | PON ports | number | ports | Ordered. How many trees an OLT drives. |
| `opt.max_onus_per_port` | ONUs per PON port | number | devices | Ordered. The Count cap on one tree. |
| `opt.line_rate_down` | Downstream line rate | number | Gbps | Ordered. |
| `opt.line_rate_up` | Upstream line rate | number | Gbps | Ordered. |
| `opt.max_reach_km` | Maximum reach | number | km | Ordered. |
| `opt.fibre_mode` | Fibre mode | single_select | — | Single-mode · Multi-mode OM3 · Multi-mode OM4. Ordered by bandwidth. |
| `opt.connector` | Connector | multi_select → **Fibre Connector** | — | |

### Display only

`opt.wdm_type` (single: None · CWDM · DWDM), `opt.optical_class` (single: Class
B+ · Class C+ · Class C++), `opt.fibre_count` (number, `count`).

### The three rules these make possible

1. **Budget** — Σ link loss ≤ optical budget. The whole reason the two are
   separate attributes.
2. **Count** — ONUs on a tree ≤ `opt.max_onus_per_port`. Same shape as the EN54
   sub-cap in `claimed-non-gaps.test.ts`.
3. **Match** — the ONU's PON standard against the OLT's, `intersects` on the
   shared list. This is the one that only works because both sides borrow the
   same vocabulary.

---

## 2 · Access Control (nodes 4.A.1, 4.B.1, 4.B.2)

### Engine-reading

| External name | Label | Type | Unit | Notes |
|---|---|---|---|---|
| `acc.credential_technology` | Credential technology | multi_select | — | 125 kHz EM · 125 kHz HID Prox · MIFARE Classic · MIFARE DESFire EV1 · MIFARE DESFire EV2 · MIFARE DESFire EV3 · NFC · BLE · QR code · PIN · Fingerprint · Face. **A card and the reader that reads it must overlap here** — this is the attribute the whole group exists for. |
| `acc.reader_interface` | Reader interface | multi_select | — | Wiegand 26-bit · Wiegand 34-bit · OSDP v1 · OSDP v2 (Secure Channel) · RS-485 · Clock & Data. |
| `acc.max_doors` | Doors supported | number | doors | Ordered. Why `doors` was added as a unit: a controller handling 4 doors and 40 credentials must never have the two totalled. |
| `acc.max_credentials` | Credentials supported | number | users | Ordered. |
| `acc.lock_output_type` | Lock output | multi_select | — | Dry contact · 12 V DC switched · Fail-safe · Fail-secure. |
| `acc.request_to_exit` | Request-to-exit input | boolean | — | |
| `acc.offline_operation` | Works offline | boolean | — | A real discriminator, not a universal: some readers stop at the door when the controller is unreachable, and §1.4 rule 3's test is whether it ever changes an answer. This does. |

### Display only

`acc.form_factor` (Card · Fob · Wristband · Sticker), `acc.card_thickness_mm`
(number, mm), `acc.printable` (boolean).

### The two rules these make possible

1. **Match** — the credential's technology `intersects` the reader's. A DESFire
   EV3 card against an EM-only reader is the failure this catches, and it is
   invisible at checkout today.
2. **Count** — doors in the design ≤ `acc.max_doors` on the controller, with
   `number_of_doors` from §2.10 as the project-input variant.

---

## What is deliberately not here

**No `acc.door_count` on a door.** A door is not a product. Doors are a project
input (`number_of_doors`, §2.10), and the Count rule reads the variable rather
than an attribute nothing carries.

**No optical `complete_set` rows yet.** An OLT ships with no ONUs and an ONU
needs no OLT in the box; what they need from each other is a *rule*, not a
composition. The composition table is for a part in the same carton, or one sold
separately for the same device — an SFP module bundled with a switch, not a
switch that needs a router somewhere on the network.

**No wavelength as a number.** `nm` exists as a unit and the temptation is to
store 1490 and compare it numerically. Don't: the values are a small fixed set,
both ends must spell them identically, and a shared select is the only shape that
makes the Match rule work. The unit is there for anything genuinely continuous.
