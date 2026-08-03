// Citations let Claude point back to the exact source text behind a claim, instead of a plain
// summary you have to trust blindly. Enabling it is two extra fields on 14's `document` block:
// `title` (a readable name for the source) and `citations: { enabled: true }`. In return, each
// text block in the response carries a `citations` array — the quoted source passage, which
// document it came from, and a location. PDFs cite by page number; plain text cites by
// character offset, since a plain-text source has no pages to point to.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const client = new Anthropic();

const MODEL = 'claude-opus-4-8';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.join(__dirname, 'pdfs', 'earth.pdf');
const OUTPUT_PATH = path.join(__dirname, 'output', 'citations.html');

const QUESTION = "How were Earth's atmosphere and oceans formed?";

// Same Wikipedia excerpt on Earth used by the lesson, as a plain-text citation source — this
// lets the PDF and plain-text demos below cite the same underlying content, so the only
// difference in their output is page numbers vs. character offsets.
const ARTICLE_TEXT = `
Earth is the third planet from the Sun and the only
astronomical object known to harbor life. This is
enabled by Earth being an ocean world, the only one in
the Solar System sustaining liquid surface water. Almost
all of Earth's water is contained in its global ocean,
covering 70.8% of Earth's crust. The remaining 29.2% of
Earth's crust is land, most of which is located in the
form of continental landmasses within Earth's land
hemisphere. Most of Earth's land is at least somewhat
humid and covered by vegetation, while large sheets of
ice at Earth's polar deserts retain more water than
Earth's groundwater, lakes, rivers, and atmospheric
water combined. Earth's crust consists of slowly moving
tectonic plates, which interact to produce mountain
ranges, volcanoes, and earthquakes. Earth has a liquid
outer core that generates a magnetosphere capable of
deflecting most of the destructive solar winds and
cosmic radiation.
Earth has a dynamic atmosphere, which sustains
Earth's surface conditions and protects it from most
meteoroids and UV-light at entry. It has a composition
of primarily nitrogen and oxygen. Water vapor is widely
present in the atmosphere, forming clouds that cover
most of the planet. The water vapor acts as a greenhouse
gas and, together with other greenhouse gases in the
atmosphere, particularly carbon dioxide (CO2), creates
the conditions for both liquid surface water and water
vapor to persist via the capturing of energy from the
Sun's light. This process maintains the current average
surface temperature of 14.76 °C (58.57 °F), at which
water is liquid under normal atmospheric pressure.
Differences in the amount of captured energy between
geographic regions (as with the equatorial region
receiving more sunlight than the polar regions) drive
atmospheric and ocean currents, producing a global
climate system with different climate regions, and a
range of weather phenomena such as precipitation,
allowing components such as nitrogen to cycle.
Earth
The Blue Marble, Apollo 17, December 1972
Designations
Alternative
names
The world · The globe ·
Terra · Tellus · Gaia ·
Mother Earth · Sol III
Adjectives Earthly · Terrestrial · Terran
· Tellurian
Symbol and
Orbital characteristics
Epoch J2000[n 1]
Aphelion 152 097 597 km
Perihelion 147 098 450 km[n 2]
Semi-major axis 149 598 023 km[1]
Eccentricity 0.016 7086[1]
Orbital period
365.256 363 004 d[2]
(sidereal)
(1.000 017 420 96 aj)
29.7827 km/s[3]
Average orbital
speed
Mean anomaly 358.617°
Inclination 7.155°
– Sun's equator;
Earth is rounded into an ellipsoid with a circumference
of about 40,000 kilometres (25,000 miles). It is the
densest planet in the Solar System. Of the four rocky
planets, it is the largest and most massive. Earth is
about eight light-minutes away from the Sun and orbits
it, taking a year (about 365.25 days) to complete one
revolution. Earth rotates around its own axis in slightly
less than a day (in about 23 hours and 56 minutes).
Earth's axis of rotation is tilted with respect to the
perpendicular to its orbital plane around the Sun,
producing seasons. Earth is orbited by one permanent
natural satellite, the Moon, which orbits Earth at
384,400 km (238,900 mi)—1.28 light seconds—and is
roughly a quarter as wide as Earth. The Moon's gravity
helps stabilize Earth's axis, causes tides and gradually
slows Earth's rotation. Tidal locking has made the Moon
always face Earth with the same side.
Earth, like most other bodies in the Solar System,
formed about 4.5 billion years ago from gas and dust in
the early Solar System. During the first billion years of
Earth's history, the ocean formed and then life
developed within it. Life spread globally and has been
altering Earth's atmosphere and surface, leading to the
Great Oxidation Event two billion years ago. Humans
emerged 300,000 years ago in Africa and have spread
across every continent on Earth. Humans depend on
Earth's biosphere and natural resources for their
survival, but have increasingly impacted the planet's
environment. Humanity's current impact on Earth's
climate and biosphere is unsustainable, threatening the
livelihood of humans and many other forms of life, and
causing widespread extinctions.
[23]
Etymology
The Modern English word Earth developed, via Middle
English, from an Old English noun most often spelled
eorðe.
[24] It has cognates in every Germanic language,
from which Proto-Germanic *erþō has been
reconstructed. In its earliest attestation, the word eorðe
was used to translate the many senses of Latin terra and
Greek gē: the ground, its soil, dry land, the human
world, the surface of the world (including the sea), and
the globe itself. As with Roman Terra (or Tellus) and
1.578 69°
– invariable
plane;[4]
0.000 05°
– J2000 ecliptic
Longitude of
ascending node
−11.260 64°
– J2000
ecliptic[3]
2023-Jan-04[5]
Time of
perihelion
Argument of
perihelion
114.207 83°[3]
Satellites 1, the Moon
Physical characteristics
Mean radius 6 371.0 km[6]
6 378.137 km[7][8]
Equatorial
radius
Polar radius 6 356.752 km[9]
Flattening 1/298.257 222 101
(ETRS89)[10]
Circumference 40 075.017 km equatorial[8]
40 007.86 km
meridional[11][n 3]
Surface area 510 072 000 km2[12][n 4]
Land: 148 940 000 km2
Water: 361 132 000 km2
Volume 1.083 21 × 1012 km3[3]
Mass 5.972 168 × 1024 kg[13]
Mean density 5.513 g/cm3[3]
Surface gravity 9.806 65 m/s2[14]
(exactly 1 g0)
0.3307[15]
Moment of
inertia factor
Escape velocity 11.186 km/s[3]
Synodic rotation
period
Sidereal rotation
period
1.0 d
(24h 00 m 00s)
0.997 269 68 d[16]
(23h 56 m 4.100s)
0.4651 km/s[17]
Equatorial
rotation velocity
Axial tilt 23.439 2811°[2]
Albedo 0.434 geometric[3]
0.294 Bond[3]
Greek Gaia, Earth may have been a personified goddess
in Germanic paganism: late Norse mythology included
Jörð ('Earth'), a giantess often given as the mother of
Thor.
[25]
Temperature 255 K (−18 °C)
(blackbody temperature)[18]
Surface temp. min mean max
[n 5]−89.2 °C 14.76 °C 56.7 °C
0.274 μSv/h[22]
Historically, Earth has been written in lowercase.
During the Early Middle English period, its definite
sense as "the globe" began being expressed using the
phrase the earth. By the period of Early Modern
English, capitalization of nouns began to prevail, and
the earth was also written the Earth, particularly when
referenced along with other heavenly bodies. More
recently, the name is sometimes simply given as Earth,
by analogy with the names of the other planets, though
earth and forms with the earth remain common.[24]
House styles now vary: Oxford spelling recognizes the
lowercase form as the more common, with the
capitalized form an acceptable variant. Another
convention capitalizes Earth when appearing as a name,
such as a description of the "Earth's atmosphere", but
employs the lowercase when it is preceded by the, such
as "the atmosphere of the earth". It almost always
appears in lowercase in colloquial expressions such as
"what on earth are you doing?"[26]
Surface
equivalent dose
rate
Absolute
magnitude (H)
−3.99
Atmosphere
Surface
101.325 kPa (at sea level)
pressure
Composition by
volume
78.08% nitrogen (dry air)
20.95% oxygen (dry air)
≤1% water vapor (variable)
0.9340% argon
0.0415% carbon dioxide
0.00182% neon
0.00052% helium
0.00017% methane
0.00011% krypton
0.00006% hydrogen
Source:[3]
The name Terra /ˈtɛrə/ TERR-ə is occasionally used in
scientific writing; it also sees use in science fiction to
distinguish humanity's inhabited planet from others,[27] while in poetry Tellus /ˈtɛləs/ TELL-əs has
been used to denote personification of the Earth.[28] Terra is also the name of the planet in some
Romance languages, languages that evolved from Latin, like Italian and Portuguese, while in other
Romance languages the word gave rise to names with slightly altered spellings, like the Spanish Tierra
and the French Terre. The Latinate form Gaea (English: /ˈdʒiː.ə/ DJEE-ə) of the Greek poetic name
Gaia ([ɡâi ̯ .a] or [ɡâj.ja]) is rare, though the alternative spelling Gaia has become common due to the
Gaia hypothesis, in which case its pronunciation is /ˈ
ɡaɪ.ə/ GYE-ə rather than the more traditional
English /ˈ
ɡeɪ.ə/ GAY-ə.
[29]
There are a number of adjectives for the planet Earth. The word earthly is derived from Earth. From
the Latin Terra comes terran /ˈtɛrən/ TERR-ən,
[30] terrestrial /təˈ
rɛstriəl/ tərr-EHST-ree-əl,
[31] and
(via French) terrene /təˈ
riːn/ tə-REEN,
[32] and from the Latin Tellus comes tellurian /tɛ
ˈlʊəriən/ teh-
LUURR-ee-ən[33] and telluric.
[34]
Natural history
Formation
A 2012 artistic impression of the early Solar System's
protoplanetary disk from which Earth and other Solar
System bodies were formed
The oldest material found in the Solar System is
dated to 4.5682 +0.0002
−0.0004 Ga (billion years) ago.[35]
By 4.54 ± 0.04 Ga the primordial Earth had
formed.[36] The bodies in the Solar System formed
and evolved with the Sun. In theory, a solar nebula
partitions a volume out of a molecular cloud by
gravitational collapse, which begins to spin and
flatten into a circumstellar disk, and then the
planets grow out of that disk with the Sun. A
nebula contains gas, ice grains, and dust (including
primordial nuclides). According to nebular theory,
planetesimals formed by accretion, with the
primordial Earth being estimated as likely taking
anywhere from 70 to 100 million years to form.[37]
Estimates of the age of the Moon range from 4.5
Ga to significantly younger.[38] A leading hypothesis is that it was formed by accretion from material
loosed from Earth after a Mars-sized object with about 10% of Earth's mass, named Theia, collided
with Earth.[39] It hit Earth with a glancing blow and some of its mass merged with Earth.[40][41]
Between approximately 4.0 and 3.8 Ga, numerous asteroid impacts during the Late Heavy
Bombardment caused significant changes to the greater surface environment of the Moon and, by
inference, to that of Earth.[42]
After formation
Earth's atmosphere and oceans were formed by volcanic activity and outgassing.
[43] Water vapor from
these sources condensed into the oceans, augmented by water and ice from asteroids, protoplanets,
and comets.
[44] Sufficient water to fill the oceans may have been on Earth since it formed.[45] In this
model, atmospheric greenhouse gases kept the oceans from freezing when the newly forming Sun had
only 70% of its current luminosity.
[46] By 3.5 Ga, Earth's magnetic field was established, which helped
prevent the atmosphere from being stripped away by the solar wind.
[47]
As the molten outer layer of Earth cooled it formed the first solid crust, which is thought to have been
mafic in composition. The first continental crust, which was more felsic in composition, formed by the
partial melting of this mafic crust.[49] The presence of grains of the mineral zircon of Hadean age in
Eoarchean sedimentary rocks suggests that at least some felsic crust existed as early as 4.4 Ga, only
140 Ma after Earth's formation.[50] There are two main models of how this initial small volume of
continental crust evolved to reach its current abundance:[51] (1) a relatively steady growth up to the
present day,[52] which is supported by the radiometric dating of continental crust globally and (2) an
initial rapid growth in the volume of continental crust during the Archean, forming the bulk of the
`;

// Same growing-history array as 12/13/14 — reset between the two demos below since they're
// independent conversations, not turns of the same one.
let messages = [];

function addUserMessage(message) {
    let content;
    if (typeof message === 'string' || Array.isArray(message)) {
        content = message;
    } else {
        content = message.content;
    }
    messages.push({ role: 'user', content });
}

function addAssistantMessage(message) {
    let content;
    if (typeof message === 'string' || Array.isArray(message)) {
        content = message;
    } else {
        content = message.content;
    }
    messages.push({ role: 'assistant', content });
}

async function chat(tools, { system, stopSequences = [], thinking = false, effort } = {}) {
    const params = {
        model: MODEL,
        max_tokens: 4000,
        messages,
        stop_sequences: stopSequences,
    };

    if (thinking) {
        params.thinking = { type: 'adaptive', display: 'summarized' };
    }

    if (effort) {
        params.output_config = { effort };
    }

    if (tools) {
        params.tools = tools;
    }

    if (system) {
        params.system = system;
    }

    return client.messages.create(params);
}

function textFromMessage(message) {
    return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}

// --- HTML rendering: turn cited text blocks into hoverable tooltip markers -----------------

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function locationLabel(citation) {
    if (citation.type === 'page_location') {
        return citation.start_page_number === citation.end_page_number - 1
            ? `page ${citation.start_page_number}`
            : `pages ${citation.start_page_number}–${citation.end_page_number - 1}`;
    }
    if (citation.type === 'char_location') {
        return `chars ${citation.start_char_index}–${citation.end_char_index}`;
    }
    return citation.type;
}

// Each text block carries its own `citations` array (empty/null if that sentence wasn't backed
// by the source). We wrap the block's text and append one superscript marker per citation, each
// holding its tooltip content — the quoted source passage and where it came from.
function blockToHtml(block, counter) {
    const text = escapeHtml(block.text);
    if (!block.citations || block.citations.length === 0) {
        return text;
    }

    const markers = block.citations
        .map((citation) => {
            counter.n += 1;
            return `<span class="citation" tabindex="0">[${counter.n}]<span class="tooltip">
        <div class="quote">&ldquo;${escapeHtml(citation.cited_text)}&rdquo;</div>
        <div class="loc">${escapeHtml(citation.document_title || 'source')} — ${locationLabel(citation)}</div>
      </span></span>`;
        })
        .join('');

    return `<span class="cited">${text}</span>${markers}`;
}

function responseToHtml(content) {
    const counter = { n: 0 };
    return content
        .filter((block) => block.type === 'text')
        .map((block) => blockToHtml(block, counter))
        .join(' ');
}

function demoSectionHtml(title, sourceLabel, answerHtml) {
    return `<section>
    <h2>${escapeHtml(title)}</h2>
    <p class="source">Source: ${escapeHtml(sourceLabel)}</p>
    <p class="question">${escapeHtml(QUESTION)}</p>
    <div class="answer">${answerHtml}</div>
  </section>`;
}

function writeHtmlReport(sections) {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Citations demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; line-height: 1.6; color: #1a1a1a; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1.1rem; border-top: 1px solid #ddd; padding-top: 1.5rem; }
    .source { color: #666; font-size: 0.9rem; }
    .question { font-style: italic; }
    .answer { white-space: pre-wrap; }
    .cited { border-bottom: 1px dotted #999; }
    .citation {
      position: relative;
      display: inline-block;
      font-size: 0.7rem;
      vertical-align: super;
      color: #0a5fcc;
      cursor: help;
    }
    .citation .tooltip {
      display: none;
      position: absolute;
      bottom: 1.4em;
      left: 0;
      width: 280px;
      background: #222;
      color: #fff;
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      line-height: 1.4;
      z-index: 1;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    .citation:hover .tooltip,
    .citation:focus .tooltip {
      display: block;
    }
    .tooltip .quote { font-style: italic; margin-bottom: 0.3rem; }
    .tooltip .loc { color: #aaa; }
  </style>
</head>
<body>
  <h1>Citations demo</h1>
  <p>Hover (or tab to) a superscript marker to see the exact source passage it's grounded in.</p>
  ${sections.join('\n  ')}
</body>
</html>
`;

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, html);
}

const htmlSections = [];

// --- Demo 1: citing a PDF — locations come back as page numbers ----------------------------

console.log('=== Citing a PDF (page-based locations) ===\n');

if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`No PDF found at ${PDF_PATH} — expected earth.pdf committed alongside this exercise.`);
}
const fileBytes = fs.readFileSync(PDF_PATH).toString('base64');

messages = [];
addUserMessage([
    {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileBytes },
        title: 'earth.pdf',
        citations: { enabled: true },
    },
    { type: 'text', text: QUESTION },
]);
const pdfResponse = await chat();
addAssistantMessage(pdfResponse);

console.log(textFromMessage(pdfResponse) + '\n');
htmlSections.push(demoSectionHtml('PDF citations', 'earth.pdf', responseToHtml(pdfResponse.content)));

// --- Demo 2: citing plain text — locations come back as character offsets ------------------

console.log('=== Citing plain text (character-offset locations) ===\n');

messages = [];
addUserMessage([
    {
        type: 'document',
        source: { type: 'text', media_type: 'text/plain', data: ARTICLE_TEXT },
        title: 'Earth Article',
        citations: { enabled: true },
    },
    { type: 'text', text: QUESTION },
]);
const textResponse = await chat();
addAssistantMessage(textResponse);

console.log(textFromMessage(textResponse) + '\n');
htmlSections.push(
    demoSectionHtml('Plain-text citations', 'Earth Article (plain text)', responseToHtml(textResponse.content)),
);

writeHtmlReport(htmlSections);
console.log(`HTML report written to ${OUTPUT_PATH}`);
