<?php
// api.php
header('Content-Type: application/json'); // Sagt dem Browser: "Hier kommt JSON-Code"
require_once 'db.php'; // Bindet unsere Datenbankverbindung ein

// JSON-Daten aus dem Frontend (JavaScript) auslesen
$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, TRUE);

// Bestimmen, welche Aktion ausgeführt werden soll (aus URL oder JSON-Body)
$action = $_GET['action'] ?? ($input['action'] ?? '');

switch ($action) {

    // AKTION 1: Alle Live-Events auslesen
    case 'getEvents':
        try {
            // Holt alle aktiven Events, neueste zuerst
            $stmt = $pdo->query("SELECT id, name, tickets FROM tc_events WHERE is_live = 1 ORDER BY created_at DESC");
            $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Formatierung: Sicherstellen, dass Zahlen auch als Zahlen an JS übergeben werden
            foreach ($events as &$event) {
                $event['id'] = (int)$event['id'];
                $event['tickets'] = (int)$event['tickets'];
            }
            
            echo json_encode(['success' => true, 'events' => $events]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    // AKTION 2: Ein neues Event anlegen
    case 'createEvent':
        $name = $input['name'] ?? '';
        $tickets = (int)($input['tickets'] ?? 0);

        if (empty($name) || $tickets < 0) {
            echo json_encode(['success' => false, 'error' => 'Ungültige Daten']);
            exit;
        }

        try {
            // Prepared Statement: Schützt vor SQL-Injection
            $stmt = $pdo->prepare("INSERT INTO tc_events (name, tickets) VALUES (:name, :tickets)");
            $stmt->execute(['name' => $name, 'tickets' => $tickets]);
            
            $newId = $pdo->lastInsertId(); // ID des neuen Eintrags holen
            echo json_encode(['success' => true, 'id' => (int)$newId]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    // AKTION 3: Tickets ausgeben oder zurücknehmen (+1 oder -1)
    case 'updateTickets':
        $id = (int)($input['id'] ?? 0);
        $amount = (int)($input['amount'] ?? 0); 

        if ($id <= 0 || $amount === 0) {
            echo json_encode(['success' => false, 'error' => 'Ungültige Daten']);
            exit;
        }

        try {
            // Besonderheit: Die Prüfung, dass Tickets nicht < 0 fallen, machen wir direkt in der Datenbank
            $stmt = $pdo->prepare("UPDATE tc_events SET tickets = tickets + :amount WHERE id = :id AND tickets + :amount >= 0");
            $stmt->execute(['amount' => $amount, 'id' => $id]);
            
            // Prüfen, ob eine Zeile geändert wurde (wenn nein, war der Stand bei 0 und jemand hat -1 gedrückt)
            if ($stmt->rowCount() > 0) {
                // Den neuen, aktuellen Stand direkt zurückgeben, um alle Bildschirme synchron zu halten
                $stmt = $pdo->prepare("SELECT tickets FROM tc_events WHERE id = :id");
                $stmt->execute(['id' => $id]);
                $newTotal = $stmt->fetchColumn();
                
                echo json_encode(['success' => true, 'newTotal' => (int)$newTotal]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Update fehlgeschlagen (evtl. keine Tickets mehr verfügbar).']);
            }
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    // FEHLER: Unbekannte Aktion
    default:
        echo json_encode(['success' => false, 'error' => 'Unbekannte Aktion']);
        break;
}
?>