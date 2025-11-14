const express = require('express');
const axios = require('axios');
require('dotenv').config();

// DB-Verbindung importieren
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const crypto = require('crypto');


// Body-Parser für JSON
app.use(express.json());

// Swagger
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

// Swagger Setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Ticketmaster API Wrapper",
      version: "1.0.0",
      description: "API-Dokumentation für Ticketmaster-Abfrage & Event-Datenbank"
    }
  },
  apis: ["./server.js"] // liest JSDoc-Kommentare aus dieser Datei
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI Endpoint
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Ticketmaster API-Key aus .env
const TM_API_KEY = process.env.TM_API_KEY;

// Hotelbeds API Credentials
const HOTELBEDS_API_KEY = process.env.HOTELBEDS_API_KEY;
const HOTELBEDS_API_SECRET = process.env.HOTELBEDS_API_SECRET;
const HOTELBEDS_URL = 'https://api.test.hotelbeds.com/hotel-api/1.0/hotels';

// Debug: Check if credentials are loaded
console.log("HOTELBEDS_API_KEY loaded:", !!HOTELBEDS_API_KEY);
console.log("HOTELBEDS_API_SECRET loaded:", !!HOTELBEDS_API_SECRET);


// Basis-URL für Ticketmaster Discovery API
const TM_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

/**
 * @openapi
 * /events:
 *   get:
 *     summary: Holt Events direkt von Ticketmaster
 *     tags:
 *       - Ticketmaster
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: Keyword zur Eventsuche
 *       - in: query
 *         name: countryCode
 *         schema:
 *           type: string
 *           default: DE
 *         description: Ländercode (z. B. DE)
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Anzahl der Ergebnisse
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Seitenzahl (Pagination)
 *     responses:
 *       200:
 *         description: Erfolgreich Ticketmaster-Events abgerufen
 */

app.get('/events', async (req, res) => {
  try {
    const { keyword, countryCode = "DE", size = 20, page = 0 } = req.query;

    const params = {
      apikey: TM_API_KEY,
      countryCode,
      size,
      page
    };

    if (keyword) params.keyword = keyword;

    const response = await axios.get(TM_URL, { params });
    res.json(response.data);
  } catch (err) {
    console.error("Ticketmaster API Error:", err.message);
    res.status(500).json({ error: 'Fehler bei der Ticketmaster-Abfrage' });
  }
});

/**
 * @openapi
 * /search-event:
 *   get:
 *     summary: Sucht Events bei Ticketmaster nach Name, Stadt oder Datum
 *     tags:
 *       - Ticketmaster
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Event-Name oder Keyword
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Stadtname (z. B. Berlin)
 *       - in: query
 *         name: countryCode
 *         schema:
 *           type: string
 *         description: Ländercode (z. B. DE)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Datum im Format YYYY-MM-DD
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Anzahl der Ergebnisse
 *     responses:
 *       200:
 *         description: Liste der gefundenen Events
 */

app.get('/search-event', async (req, res) => {
  try {
    const { name, city, countryCode, date, size = 10 } = req.query;

    const params = {
      apikey: TM_API_KEY,
      size
    };

    if (name) params.keyword = name;
    if (city) params.city = city;
    if (countryCode) params.countryCode = countryCode;

    if (date) {
      params.startDateTime = `${date}T00:00:00Z`;
      params.endDateTime = `${date}T23:59:59Z`;
    }

    const response = await axios.get(TM_URL, { params });

    if (!response.data._embedded) {
      return res.json({ message: "Keine Events gefunden." });
    }

    const events = response.data._embedded.events;

    res.json({
      count: events.length,
      events
    });

  } catch (err) {
    console.error("Search Event Error:", err.message);
    res.status(500).json({ error: "Fehler bei der Event-Suche" });
  }
});

/**
 * @openapi
 * /events:
 *   post:
 *     summary: Speichert ein Event in der Datenbank
 *     tags:
 *       - Database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_id
 *               - name
 *             properties:
 *               event_id:
 *                 type: string
 *                 description: Ticketmaster Event-ID
 *               name:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               venue:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event erfolgreich gespeichert
 *       400:
 *         description: Fehlende Pflichtfelder
 *       500:
 *         description: Fehler beim Speichern
 */
app.post("/events", async (req, res) => {
  try {
    const { event_id, name, date, venue } = req.body;

    if (!event_id || !name) {
      return res.status(400).json({
        error: "event_id und name sind Pflichtfelder"
      });
    }

    const sql = `
      INSERT INTO events (event_id, name, date, venue)
      VALUES (?, ?, ?, ?)
    `;

    await pool.execute(sql, [event_id, name, date, venue]);

    res.json({ message: "Event erfolgreich gespeichert" });

  } catch (err) {
    console.error("DB Insert Error:", err.message);
    res.status(500).json({ error: "Fehler beim Speichern des Events" });
  }
});


/**
 * @openapi
 * /events/db:
 *   get:
 *     summary: Holt alle gespeicherten Events aus der Datenbank
 *     description: Gibt alle Events zurück, die lokal in der MariaDB gespeichert wurden.
 *     tags:
 *       - Database
 *     responses:
 *       200:
 *         description: Liste der gespeicherten Events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   description: Anzahl der Events
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: Datenbank-ID
 *                       event_id:
 *                         type: string
 *                         description: Ticketmaster Event-ID
 *                       name:
 *                         type: string
 *                       date:
 *                         type: string
 *                         description: Datum des Events
 *                       venue:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         description: Zeitpunkt der Speicherung
 */
app.get("/events/db", async (req, res) => {
  try {
    const sql = "SELECT * FROM events ORDER BY created_at DESC";
    const [rows] = await pool.execute(sql);

    res.json({
      count: rows.length,
      events: rows
    });

  } catch (err) {
    console.error("DB Select Error:", err.message);
    res.status(500).json({ error: "Fehler beim Abrufen der gespeicherten Events" });
  }
});

// HOTEL SEARCH ENDPOINT
app.get("/hotels", async (req, res) => {
  try {
    const {
      destination,
      checkIn,
      checkOut,
      rooms = 1,
      adults = 1,
      children = 0
    } = req.query;

    if (!destination || !checkIn || !checkOut) {
      return res.status(400).json({
        error: "destination, checkIn, und checkOut sind Pflichtfelder"
      });
    }

    const apiKey = HOTELBEDS_API_KEY || '';
    const secret = HOTELBEDS_API_SECRET || '';
    if (!apiKey || !secret) {
      return res.status(500).json({ error: "Hotelbeds-Credentials nicht gesetzt" });
    }

    const timestamp = process.env.HOTELBEDS_TS_MS ? Date.now().toString() : Math.floor(Date.now() / 1000).toString();

    const sigGenerators = {
      'hmac:apiKey+timestamp': () => crypto.createHmac('sha256', secret).update(apiKey + timestamp).digest('hex'),
      'hmac:timestamp+apiKey': () => crypto.createHmac('sha256', secret).update(timestamp + apiKey).digest('hex'),
      'hmac:apiKey+secret+timestamp': () => crypto.createHmac('sha256', secret).update(apiKey + secret + timestamp).digest('hex'),
      'sha256:secret+apiKey+timestamp': () => crypto.createHash('sha256').update(secret + apiKey + timestamp).digest('hex'),
      'sha256:apiKey+secret+timestamp': () => crypto.createHash('sha256').update(apiKey + secret + timestamp).digest('hex'),
      'sha256:secret+timestamp+apiKey': () => crypto.createHash('sha256').update(secret + timestamp + apiKey).digest('hex'),
    };

    // Auswahl: falls env gesetzt, nur diese Variante benutzen, sonst Reihenfolge wie definiert
    const forced = process.env.HOTELBEDS_SIG_FORMAT;
    const variants = forced ? [forced] : Object.keys(sigGenerators);

    const payload = {
      stay: { checkIn, checkOut },
      occupancies: [{
        rooms: parseInt(rooms, 10),
        adults: parseInt(adults, 10),
        children: parseInt(children, 10)
      }],
      destination: { code: destination }
    };

    let lastErr = null;
    for (const fmt of variants) {
      const signature = sigGenerators[fmt]();

      const headers = {
        // beide Varianten des Api-Key-Headers setzen (manche Envs erwarten X-HB-ApiKey)
        'Api-key': apiKey,
        'X-HB-ApiKey': apiKey,
        // beide Varianten des Signature-Headers
        'X-Signature': signature,
        'X-HB-Signature': signature,
        'X-Timestamp': timestamp,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };

      try {
        console.log(`Trying Hotelbeds signature format: ${fmt}, timestamp=${timestamp}`);
        const response = await axios.post(HOTELBEDS_URL, payload, { headers, timeout: 8000 });
        // Erfolg
        return res.json({
          usedFormat: fmt,
          count: response.data.hotels?.length || 0,
          hotels: response.data.hotels || []
        });
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        // Bei 401 weiter probieren, sonst abbrechen und Fehler zurückgeben
        console.warn(`Hotelbeds attempt ${fmt} failed: ${status || err.message}`);
        if (status && status !== 401) break;
        // sonst Loop weiter
      }
    }

    // Alle Varianten schlugen fehl
    console.error("All signature attempts failed");
    res.status(401).json({
      error: "Request signature verification failed (alle Versuche fehlgeschlagen)",
      details: lastErr?.response?.data || lastErr?.message
    });

  } catch (err) {
    console.error("Hotelbeds API Error:", err.message);
    res.status(500).json({ error: "Fehler bei der Hotel-Suche", details: err.message });
  }
});

/**
 * @openapi
 * /events/save-ticketmaster:
 *   post:
 *     summary: Ruft ein Ticketmaster-Event ab und speichert es in der Datenbank
 *     tags:
 *       - Database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 description: Ticketmaster Event-ID
 *     responses:
 *       200:
 *         description: Event erfolgreich gespeichert
 *       400:
 *         description: Fehlende oder ungültige Event-ID
 *       500:
 *         description: Fehler beim Speichern oder Abrufen des Events
 */
app.post("/events/save-ticketmaster", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Bitte eine Ticketmaster Event-ID angeben (id)" });
    }

    // Ticketmaster Event-URL
    const url = `https://app.ticketmaster.com/discovery/v2/events/${id}.json`;

    // Event von Ticketmaster abrufen
    const response = await axios.get(url, {
      params: {
        apikey: TM_API_KEY
      }
    });

    const data = response.data;

    if (!data || !data.name) {
      return res.status(400).json({ error: "Event nicht gefunden" });
    }

    // Event-Daten extrahieren
    const name = data.name || null;
    const date = data?.dates?.start?.localDate || null;
    const venue = data?._embedded?.venues?.[0]?.name || null;

    // Event in der MariaDB speichern
    const sql = `
      INSERT INTO events (event_id, name, date, venue)
      VALUES (?, ?, ?, ?)
    `;

    await pool.execute(sql, [id, name, date, venue]);

    res.json({
      message: "Ticketmaster-Event erfolgreich gespeichert",
      saved: {
        event_id: id,
        name,
        date,
        venue
      }
    });

  } catch (err) {
    console.error("Save Ticketmaster Event Error:", err.message);

    res.status(500).json({
      error: "Fehler beim Abrufen oder Speichern des Ticketmaster-Events",
      details: err.message
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
