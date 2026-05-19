const API_URL = 'api.php'; 

let events = []; 
let activeEventId = null; 
let pollingInterval = null;
let editId = -1; // Speichert, welches Event gerade bearbeitet wird (-1 bedeutet: wir erstellen ein neues)

// --- NAVIGATION ---
function switchView(viewId) {
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
    document.getElementById('counterView').classList.add('hidden');

    document.getElementById(viewId).classList.remove('hidden');

    // Wenn wir in die Settings gehen, rendern wir die Lösch-Liste
    if (viewId === 'settingsView') {
        renderSettingsEventList();
    }

    if (viewId === 'counterView' || viewId === 'listView') {
        startPolling();
    } else {
        stopPolling();
    }
}

// --- PASSWORT PRÜFUNG ---
function checkPassword() {
    const pwInput = document.getElementById('adminPassword');
    if (pwInput.value === "ticket123") {
        pwInput.value = ""; 
        switchView('settingsView'); 
    } else {
        alert("Falsches Passwort!");
    }
}

// --- SERVER-KOMMUNIKATION (FETCH) ---
async function fetchEvents() {
    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_URL}?action=getEvents&t=${timestamp}`, {
            cache: 'no-store' 
        });
        
        const data = await response.json();
        
        if (data.success) {
            events = data.events; 
            
            if (!document.getElementById('listView').classList.contains('hidden')) {
                renderEventList();
            }
            if (!document.getElementById('counterView').classList.contains('hidden') && activeEventId) {
                updateCounterDisplay();
            }
            // Aktualisiert auch die Lösch-Liste live, falls jemand im Settings-Menü ist
            if (!document.getElementById('settingsView').classList.contains('hidden')) {
                renderSettingsEventList();
            }
        }
    } catch (error) {
        console.error("Fehler beim Laden der Events:", error);
    }
}

async function addNewEvent() {
    const nameInput = document.getElementById('eventNameInput');
    const ticketsInput = document.getElementById('eventTicketsInput');
    
    const name = nameInput.value.trim();
    const tickets = parseInt(ticketsInput.value);

    if (name === "" || isNaN(tickets) || tickets < 0) {
        alert("Bitte einen gültigen Namen und eine gültige Zahl eingeben.");
        return;
    }

    // Entscheiden: Update (Bearbeiten) oder Insert (Neu)?
    const action = (editId === -1) ? 'createEvent' : 'updateEvent';
    const bodyData = (editId === -1) 
        ? { action: 'createEvent', name: name, tickets: tickets }
        : { action: 'updateEvent', id: editId, name: name, tickets: tickets };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData)
        });
        
        const data = await response.json();
        if (data.success) {
            nameInput.value = "";
            ticketsInput.value = "";
            
            // Modus zurücksetzen
            editId = -1;
            document.querySelector('#settingsView button.btn-primary').innerText = "Event erstellen & Freischalten";
            document.querySelector('#settingsView button.btn-primary').style.backgroundColor = "#007bff";
            
            await fetchEvents(); 
        } else {
            alert("Fehler: " + data.error);
        }
    } catch (error) {
        alert("Verbindungsfehler zum Server.");
    }
}

// NEU: Funktion zum Löschen eines Events
async function deleteEvent(id) {
    if (!confirm("Möchtest du diese Veranstaltung wirklich unwiderruflich löschen?")) {
        return; 
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteEvent', id: id })
        });
        
        const data = await response.json();
        if (data.success) {
            await fetchEvents(); 
        } else {
            alert("Fehler beim Löschen: " + data.error);
        }
    } catch (error) {
        alert("Verbindungsfehler zum Server.");
    }
}

async function changeTickets(amount) {
    const currentEvent = events.find(e => e.id === activeEventId);
    if (!currentEvent || currentEvent.tickets + amount < 0) return; 

    document.getElementById('loadingSpinner').classList.remove('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateTickets', id: activeEventId, amount: amount })
        });
        
        const data = await response.json();
        if (data.success) {
            currentEvent.tickets = data.newTotal;
            updateCounterDisplay();
        } else {
            console.warn(data.error);
            await fetchEvents(); 
        }
    } catch (error) {
        console.error("Verbindungsfehler");
    } finally {
        document.getElementById('loadingSpinner').classList.add('hidden');
    }
}

// --- HILFSFUNKTIONEN FÜR DIE OBERFLÄCHE ---
function renderEventList() {
    const container = document.getElementById('activeEventsContainer');
    container.innerHTML = ""; 

    if (events.length === 0) {
        container.innerHTML = "<p style='color:#777;'>Aktuell keine Events live.</p>";
        return;
    }

    events.forEach(event => {
        const button = document.createElement('button');
        button.className = 'btn-event';
        button.onclick = () => openCounter(event.id);
        button.innerHTML = `<span>${event.name}</span> <span>🎟️ ${event.tickets}</span>`;
        container.appendChild(button);
    });
}

function renderSettingsEventList() {
    const container = document.getElementById('settingsEventsContainer');
    container.innerHTML = ""; 

    if (events.length === 0) {
        container.innerHTML = "<p style='color:#777; font-size: 14px;'>Keine Events zum Verwalten vorhanden.</p>";
        return;
    }

    events.forEach(event => {
        const div = document.createElement('div');
        div.className = 'settings-event-item';
        div.innerHTML = `
            <span style="text-align: left; flex-grow: 1;">${event.name} (🎟️ ${event.tickets})</span>
            <div>
                <button class="btn-secondary" style="padding: 10px; width: auto; margin-right: 5px;" onclick="prepareEdit(${event.id})">✏️</button>
                <button class="btn-delete" onclick="deleteEvent(${event.id})">🗑️</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function prepareEdit(id) {
    const event = events.find(e => e.id === id);
    if (!event) return;

    document.getElementById('eventNameInput').value = event.name;
    document.getElementById('eventTicketsInput').value = event.tickets;
    
    editId = id; 
    
    const btn = document.querySelector('#settingsView button.btn-primary');
    btn.innerText = "Änderungen speichern";
    btn.style.backgroundColor = "#ffc107"; 
}

function openCounter(id) {
    activeEventId = id; 
    const currentEvent = events.find(e => e.id === id);
    if(currentEvent) {
        document.getElementById('currentEventTitle').innerText = currentEvent.name;
        updateCounterDisplay();
        switchView('counterView');
    }
}

function updateCounterDisplay() {
    const currentEvent = events.find(e => e.id === activeEventId);
    if (!currentEvent) return; 

    const displayElement = document.getElementById('ticketCountDisplay');
    displayElement.innerText = currentEvent.tickets;
    displayElement.style.color = currentEvent.tickets === 0 ? "#dc3545" : "#ffffff";
}

// --- POLLING ---
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(fetchEvents, 3000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// App-Start
fetchEvents();