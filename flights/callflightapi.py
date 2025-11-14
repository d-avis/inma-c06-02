import requests
import json
import argparse  # NEU: Importiere das Modul für Argumenten-Verarbeitung

# --- Konfiguration ---
# Dein API-Schlüssel von SerpApi
SERPAPI_API_KEY = "1a7cd235016ea3e6bbe298eb4c89ad81257be21fdb74f9d2b887e64258a8cb74"

# Basis-URL für die SerpApi Google Flights Engine
SERPAPI_BASE_URL = "https://serpapi.com/search.json"


def call_flight_api(flight_data):
    
    # 1. Parameter für die GET-Anfrage zusammenstellen
    params = {
        "engine": "google_flights",
        "api_key": SERPAPI_API_KEY,
        "departure_id": flight_data["departure_id"],
        "arrival_id": flight_data["arrival_id"],
        "outbound_date": flight_data["outbound_date"],
        "return_date": flight_data["return_date"],
        "hl": "en",
        "currency": "USD"
    }

    print(f"INFO: Rufe Flug-API auf für: {flight_data['departure_id']} -> {flight_data['arrival_id']}")

    try:
        # 2. Die API-Anfrage senden
        response = requests.get(SERPAPI_BASE_URL, params=params)
        response.raise_for_status() 
        data = response.json()

        # 3. API-Antwort prüfen
        if data.get("search_metadata", {}).get("status") != "Success":
            error_message = data.get("error", "Unbekannter SerpApi-Fehler")
            print(f"FEHLER: API-Antwort war nicht 'Success': {error_message}")
            return {"status": "failed", "message": error_message}

        # 4. Den ersten "besten Flug" extrahieren
        if data.get("best_flights"):
            first_flight = data["best_flights"][0]
            price = first_flight.get("price")
            booking_token = first_flight.get("departure_token") 

            if price is None or booking_token is None:
                print("FEHLER: Bester Flug hat keinen Preis oder Token.")
                return {"status": "failed", "message": "Flug gefunden, aber unvollständige Daten (kein Preis/Token)."}

            # 5. Erfolgsantwort für den Orchestrator zurückgeben
            print(f"INFO: Flug gefunden! Preis: {price} USD, Token: {booking_token[:15]}...")
            return {
                "status": "success",
                "data": {
                    "flightId": f"Flight-{first_flight['flights'][0].get('flight_number', 'KLM-456')}",
                    "price": price,
                    "booking_token": booking_token,
                    "segments": first_flight.get("flights", [])
                }
            }
        else:
            print("FEHLER: Keine Flüge gefunden.")
            return {"status": "failed", "message": "Keine Flüge für diese Route gefunden."}

    except requests.exceptions.HTTPError as http_err:
        print(f"FEHLER: HTTP-Fehler bei API-Aufruf: {http_err}")
        return {"status": "failed", "message": str(http_err)}
    except requests.exceptions.RequestException as req_err:
        print(f"FEHLER: Netzwerk-Fehler bei API-Aufruf: {req_err}")
        return {"status": "failed", "message": str(req_err)}
    except json.JSONDecodeError:
        print("FEHLER: Ungültige JSON-Antwort von der API.")
        return {"status": "failed", "message": "Ungültige JSON-Antwort von der API."}

# -----------------------------------------------------------------
# NEUER TEIL: Skript über die Kommandozeile ausführbar machen
# -----------------------------------------------------------------
if __name__ == "__main__":
    # 1. Einen "Parser" erstellen, der die Argumente liest
    parser = argparse.ArgumentParser(description="Findet Flüge über die SerpApi.")

    # 2. Definieren, welche Argumente wir erwarten
    # Wir machen alle 4 Argumente "required" (erforderlich)
    parser.add_argument("--departure_id", 
                        help="Abflug-Flughafen (z.B. FRA)", 
                        required=True)
    parser.add_argument("--arrival_id", 
                        help="Ankunft-Flughafen (z.B. AUS)", 
                        required=True)
    parser.add_argument("--outbound_date", 
                        help="Hinflug-Datum (Format: YYYY-MM-DD)", 
                        required=True)
    parser.add_argument("--return_date", 
                        help="Rückflug-Datum (Format: YYYY-MM-DD)", 
                        required=True)

    # 3. Die Argumente aus der Kommandozeile einlesen
    args = parser.parse_args()

    # 4. Das flight_data-Dictionary dynamisch aus den gelesenen Argumenten erstellen
    flight_request_data = {
        "departure_id": args.departure_id,
        "arrival_id": args.arrival_id,
        "outbound_date": args.outbound_date,
        "return_date": args.return_date
    }
    
    print(f"INFO: Starte API-Anfrage für: {args.departure_id} -> {args.arrival_id}...")

    # 5. Unsere Hauptfunktion mit den dynamischen Daten aufrufen
    result = call_flight_api(flight_request_data)

    # 6. Das Ergebnis wie gewohnt ausgeben
    print("\n--- API-Ergebnis ---")
    print(json.dumps(result, indent=2, ensure_ascii=False))
