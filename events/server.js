const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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


app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
