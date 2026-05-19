<?php
// api.php
header('Content-Type: application/json');
require_once 'db.php'; 

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, TRUE);

$action = $_GET['action'] ?? ($input['action'] ?? '');

switch ($action) {

    // AKTION 1: Alle Live-Events auslesen
    case 'getEvents':
        try {
            $stmt = $pdo->query("SELECT id, name, tickets FROM tc_events WHERE is_live = 1 ORDER BY created_at DESC");
            $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
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
            $stmt = $pdo->prepare("INSERT INTO tc_events (name, tickets) VALUES (:name, :tickets)");
            $stmt->execute(['name' => $name, 'tickets' => $tickets]);
            
            $newId = $pdo->lastInsertId(); 
            echo json_encode(['success' => true, 'id' => (int)$newId]);
        } catch (PDOException $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    // AKTION 3: Tickets ausgeben oder zurücknehmen
    case 'updateTickets':
        $id = (int)($input['id'] ?? 0);
        $amount = (int)($input['amount'] ?? 0); 

        if ($id <= 0 || $amount === 0) {
            echo json_encode(['success' => false, 'error' => 'Ungültige Daten']);
            exit;
        }

        try {
            $stmt = $pdo->prepare("UPDATE tc_events SET tickets = tickets + :amount WHERE id = :id AND tickets + :amount >= 0");
            $stmt->execute(['amount' => $amount, 'id' => $id]);
            
            if ($stmt->rowCount() > 0) {
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

    // AKTION 4 (NEU): Ein Event komplett löschen
    case 'deleteEvent':
        $id = (int)($input['id'] ?? 0);

        if ($id <= 0) {
            echo json_encode(['success' => false, 'error' => 'Ungültige ID']);
            exit;
        }

        try {
            // Löscht die Zeile mit der passenden ID aus der Datenbank
            $stmt = $pdo->prepare("DELETE FROM tc_events WHERE id = :id");
            $stmt->execute(['id' => $id]);
            
            echo json_encode(['success' => true]);
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