const express = require('express');
const axios = require('axios');
require('dotenv').config();

// DB-Verbindung importieren
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Body-Parser für JSON
app.use(express.json());

// Ticketmaster API-Key aus .env
const TM_API_KEY = process.env.TM_API_KEY;

// Basis-URL für Ticketmaster Discovery API
const TM_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

// Route: Events abfragen
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

// SEARCH-EVENT ENDPOINT
app.get('/search-event', async (req, res) => {
  try {
    const {
      name,          // Event-Name / Keyword
      city,          // Stadt
      countryCode,   // Länder-Code (z.B. DE)
      date,          // Datum YYYY-MM-DD
      size = 10
    } = req.query;

    const params = {
      apikey: TM_API_KEY,
      size
    };

    if (name) params.keyword = name;
    if (city) params.city = city;
    if (countryCode) params.countryCode = countryCode;

    // Wenn ein Datum angegeben ist → formatieren für Ticketmaster
    if (date) {
      params.startDateTime = `${date}T00:00:00Z`;
      params.endDateTime = `${date}T23:59:59Z`;
    }

    const response = await axios.get(TM_URL, { params });

    // Keine Events gefunden
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


app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
