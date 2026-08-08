# Specification authoring conventions

Decisions where the model already does the right thing and the only question is
how to use it. Each one comes from a real attribute in the specification library
that had nowhere obvious to go — the answer is written down here so the next
person does not re-derive it, or worse, solve it a second way.

Anything that needed the model to change is not here; it is in the code, with
the reasoning on the column or the function that carries it.

---

## 1. A range inside a repeatable row → two number columns

**Where it comes from.** `cap.io_group` wants `ac_range` and `dc_range` on each
I/O row: "100–240 V", "12–24 V".

**The convention.** Two numeric sub-fields, `ac_min_v` and `ac_max_v`.

A `group` sub-field is a number or a pick, and that is deliberate — the comment
on `SpecGroupField` spells out why a row must not become a document. Adding a
third kind would touch every reduction, the `where` evaluator and every
comparator, to express something two columns already express exactly.

Two columns are also more useful than one range would be. A rule asking "does
this input accept the site's 220 V" reads the pair with `within`; a rule asking
"what is the lowest input voltage on this board" reads one column and totals or
sorts it. A single range field could answer the first and not the second.

**The trap.** Name them `*_min_*` and `*_max_*` and keep them adjacent in the
column order. A row where the minimum column sits after some unrelated pick is
one an author fills in wrongly on a bad day, and nothing downstream can tell.

---

## 2. `project_compliance_target` → one boolean project input per target

**Where it comes from.** §2.10 lists it among the project inputs, and
`ProjectVariables.type` is `number | boolean`. It wants to be a select: "EN 50131
Grade 2", "EN 54", "SASO".

**The convention.** One boolean variable per target that a rule actually
distinguishes — "EN 50131 required?", "EN 54 required?", "SABER required?".

Two reasons, and the second is the real one.

`projectVariableTypes` is a `mysqlEnum`, and drizzle-kit widens a MySQL enum by
emitting a `TRUNCATE`. That is never acceptable on a populated table, so the
change costs a hand-written `ALTER` — a real cost, but payable.

The better reason is that booleans compose and a select does not. A project can
be EN 50131 **and** SABER at once; a single select forces one and then every rule
about the other has to be written against a value that is only sometimes there.
Conditional rules read booleans directly, and a new target is a new variable
rather than a migration.

**When to revisit.** If targets ever become mutually exclusive and there are more
than about six, a select earns its `ALTER`. They are not, and there are not.

---

## 3. Cross-tree products → file once, assign the attributes twice

**Where it comes from.** §3.7: a photo-verification detector belongs at 3.C.1
*and* 5.A.1; a doorbell at 3.A.4 *and* 4.B. `Products.categoryUuid` is single.

**The convention.** File the product in the node that owns it, and add the other
node's *attributes* to that node's assignment list.

What this costs is browsing: the detector will not appear when a shopper is
standing in 3.C.1 having filed it under 5.A.1. What it does **not** cost is rule
participation — a rule reads attribute values, and the product carries every one
of them either way. That is the half that matters, and it keeps working.

**What not to do.** Do not create a second row for the same product in the other
category. §3.7 says why in one line: it double-counts in every Count rule. A
panel that allows 200 devices would see 201 and refuse a design that is fine, and
the reason would be invisible.

**When to revisit.** If browsing from both branches becomes a requirement rather
than a nicety, the honest fix is a `ProductCategories` join table. It touches
listing, facets, assignment resolution and `in_category`, so it is worth doing
properly or not at all — not worth faking with a duplicate row.

---

## 4. `lifecycle_status` lives in the library, not on the column

**Where it comes from.** `Products.lifecycleStatus` exists and is dormant. §2.1
wants `id.lifecycle_status` as an engine attribute that Presence reads.

**The convention.** Author it as a library attribute. Leave the column alone.

A predicate reads `specValues`, keyed by attribute uuid. It cannot see a product
column at all, so a rule that must not recommend an end-of-life panel can only be
written against the attribute. Filling in both would give one fact two homes and
no rule about which wins — and the one the engine reads is not the one the admin
list would show.

**When to revisit.** If the dormant EOL feature is ever built and wants the
column, delete the attribute in the same change. Not before, and never both.

---

## 5. `net.connection_priority` → a group of `{rank, technology}`

**Where it comes from.** §2.4: the EN54 Fire Hub chains Ethernet → Wi-Fi →
Cellular. There is no ordered-list type.

**The convention.** A `group` with a number column `rank` and a select column
`technology` pointing at the same shared option set `net.link_technology` uses.

The shared set is the part that makes it worth doing rather than settling for a
multi-select: the priority list and the link technology then spell "Ethernet"
identically, so a rule can ask "is the fallback on this hub a technology the site
actually has" without either attribute knowing the other exists.

Mark `technology` as a **discriminator** (`distinct`). A hub does not fall back to
Wi-Fi twice, and without the flag two rows would be totalled.

---

## 6. `phys.dimensions_mm` → three number attributes

**The convention.** `phys.width_mm`, `phys.height_mm`, `phys.depth_mm`.

A single field holding "330 × 330 × 44" is a string, and the one rule anybody
actually wants from dimensions — does this fit the rack, does it clear the
enclosure — needs to compare one axis at a time. Three numbers give that for
free; a triple type would need a comparator of its own to do the same thing.

**The known gap.** `Ø 20 × 90 mm` (DoorProtect) is a cylinder and three axes are
the wrong shape for it. Leave the depth blank and record the diameter in whatever
display field the category has, exactly as §4.5 says: flag it, do not force it.

**The rack-depth rule these feed is a Budget, not a Match** — §6.2.5 calls it a
Match and authoring it that way ships a rule that blocks every rack build.
Match resolves both sides through option *ranks*, and two plain numbers have
none, so the comparison finds nothing on either side and fails everything. Use
`budget` with `perItem: true`: each device judged against the rack's usable depth
on its own, rather than summed, because four 520 mm servers do not need a
2,080 mm rack. There is a test pinning both halves of this in
`claimed-non-gaps.test.ts`.

---

## 7. `det.detection_zone.zone_label` → a controlled list, or nothing

**Where it comes from.** §2.5 wants `{zone_label, sensing_element, range_m,
angle_h, angle_v}` rows. A group sub-field is a number or a pick; there is no
free text inside a row, on purpose.

**The convention.** Either give `zone_label` a short controlled list — `Left`,
`Right`, `Upper`, `Lower`, `Primary` — or leave the column out and let
`sensing_element` identify the row.

For CurtainCam, `sensing_element` already distinguishes the rows (PIR pair at
78°/7°, microwave at 88°/43°) and a label adds nothing. For DualCurtain, which
states values per side, a two-value list of `Left`/`Right` is the whole
vocabulary needed.

**Why not free text.** The `text` type exists precisely so prose stops being
recorded as options, and a free-text column inside a row would reopen that: every
product would write its own label, near-duplicate detection could not see that
"left side" and "Left" are one thing, and any rule keyed on a zone would silently
stop matching.

---

## 8. `net.min_firmware_version` — now authorable, against a Space only

**Where it comes from.** §2.4 and §6.2 both flag it: the UL detector needs OS
Malevich 2.15.4+, gen-1 FireProtect interconnection needs 3.42+.

**This entry used to say "do not author it yet".** It named two missing things and
both now exist, so the guidance has changed rather than the reasoning.

The comparator is `packages/services/src/firmware.ts`. `compareVersions` reads the
dotted parts as numbers, which is the whole point: string comparison ranks `2.9`
above `2.15`, so a rule requiring 2.15.4 would have *passed* a device on 2.9 —
wrong in the direction of approval, which is the worst direction. A missing part
counts as zero, so `3.42` and `3.42.0` are one release. Anything unparseable comes
back `null` rather than a number, because every number there means something.

The carrier is `SpaceItems.firmwareVersion`, per item, on the Space object §6.1
added. That is the only place the fact can live: a BOQ line is a product somebody
intends to buy and firmware belongs to a unit already on a wall.

**The convention.** Author it, and only against an installed item. Two rules
follow and neither is optional.

*Never against a BOQ line.* There is no version there to read, and a rule that
reads nothing does not fire — the check would look present and be absent, which is
the shape this model works hardest to avoid.

*It degrades to a warning while `firmwareVerified` is false.* SOT cannot read the
firmware off a panel in a building three cities away, so the number came from a
person typing what they believed. `assessFirmware` enforces this: an unverified
shortfall is `warn`, however far short it falls, and only a version somebody at SOT
has confirmed can produce `block`. A rule that silently trusted a self-declared
number would look like verification and be hearsay, and a fire system signed off on
that basis has been approved by nobody.

**What is still missing.** Nothing in the relationship engine reads a Space yet —
the engine judges a *selection*, and a firmware check only has a subject when the
selection is an addition to a site that already has equipment in it. That is the
"add to system" path in §6.2. Until it lands, `assessFirmware` is reachable and
tested but no authored rule routes through it, so authoring the attribute buys
nothing yet.

---

## 9. The `conditional_value` pattern — one fact, several cases

**Where it comes from.** §2.3 asks for a `conditional_value` type for
`pwr.power_draw_w`: 9 W on 12 V DC, 8.5 W on PoE, 12 W at maximum. Also
`pwr.autonomy_h` — 24 h or 72 h depending which battery was bought.

**The convention.** A `group` with a select column naming the case and a number
column holding the value. Mark the case column **distinct**.

    when (select, distinct) | watts (number, W)
    12 V DC                 | 9
    PoE                     | 8.5
    maximum                 | 12

A rule reads one case with a row filter:

    { source: "spec", specUuid: "…", groupField: "watts",
      where: { op: "equals", attr: "when", value: "maximum" } }

**The rule that makes it safe.** An operand **totals** a group column. Two rows
answering the same case get summed, so a 12 W camera measures 24 W with no error
anywhere. The `distinct` flag is what refuses that, and it is not optional on
this shape — a case column without it is a bug waiting for the day two rows say
`maximum`.

**Power cascades use the full-load case, never the average.** §2.3 says it and it
is worth repeating here, because the `where` filter makes picking the wrong one a
one-word mistake.

---

## 10. External names are dotted, and they do not move

**The convention.** Give every attribute the dotted id from the specification
document as its external name — `pwr.power_draw_w`, `phys.ip_rating` — and never
change it afterwards.

Leave it blank only for an attribute the document does not name; it will be
derived from the label, which is fine for something no mapping file mentions.

**Why it is typed rather than derived.** `slugify` turns `pwr.power_draw_w` into
`pwr-power-draw-w`. An author who typed the dotted id into a mapping file and let
the system derive the key would have two different strings and an import that
matched nothing, silently, on every row.

Renaming the attribute's **label** never touches it. Editing the external name
itself is allowed and returns a warning, because the consequence lands outside
this system where we cannot see it.

---

## 11. Aliases are how a source spelling gets remembered

**The convention.** When an import or an author meets a spelling that means an
option we already have, record it as an **alias on that option** — not as a new
option, and not as a note somewhere.

`||` is II. `Workbench` is Desktop. `866.0 – 866.5 MHz` is `866.0–866.5 MHz`.

**What this buys.** The resolver reads aliases on every route in, so the same
spelling never has to be recognised twice. A fix recorded anywhere else — a
mapping file, an importer branch, somebody's memory — has to be re-applied the
next time the data is harvested, and the time after that it will not be.

**What is refused.** An alias that two options answer to. That is a library
defect and the save names it, because an alias whose whole purpose is to resolve
to one thing cannot be allowed to resolve to two.

**Punctuation is not normalised away.** `||` squashes to an empty string, and it
is a real alias on 68 products.
