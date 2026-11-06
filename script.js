const API = "/api";

function showMessage(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("hidden", "error");
    if (isError) element.classList.add("error");
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "Date to be announced";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHTML(value);
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function eventCard(event) {
    return `
        <article class="card">
            <div class="card-top">
                <div class="icon-tile">✦</div>
                <span class="tag">${escapeHTML(event.category || "College event")}</span>
            </div>
            <h3>${escapeHTML(event.event_name)}</h3>
            <p><strong>Event ID:</strong> ${escapeHTML(event.event_id)}</p>
            <p><strong>Branch:</strong> ${escapeHTML(event.branch)}</p>
            <p><strong>Date:</strong> ${formatDate(event.event_date)}</p>
            <p><strong>Venue:</strong> ${escapeHTML(event.venue || "To be announced")}</p>
            ${event.description ? `<p>${escapeHTML(event.description)}</p>` : ""}
            <a class="button" href="register.html?event=${encodeURIComponent(event.event_id)}">Register now</a>
        </article>`;
}

async function loadEvents(target, filters = {}) {
    if (!target) return [];
    target.innerHTML = '<div class="empty-state">Loading events...</div>';

    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.branch) params.set("branch", filters.branch);
    if (filters.category) params.set("category", filters.category);

    try {
        const events = await apiRequest(`${API}/events?${params.toString()}`);
        target.innerHTML = events.length
            ? events.map(eventCard).join("")
            : '<div class="empty-state">No events found. Try changing your filters or check back later.</div>';
        return events;
    } catch (error) {
        target.innerHTML = `<div class="notice error">${escapeHTML(error.message)}</div>`;
        return [];
    }
}

function setupNavigation() {
    const toggle = document.querySelector(".menu-toggle");
    const links = document.querySelector(".nav-links");
    if (toggle && links) {
        toggle.addEventListener("click", () => links.classList.toggle("open"));
    }

    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach(link => {
        if (link.getAttribute("href") === current) link.classList.add("active");
    });
}

function setupHomePage() {
    const target = document.querySelector("#featured-events");
    if (target) loadEvents(target).then(events => {
        const count = document.querySelector("#event-count");
        if (count) count.textContent = events.length;
        target.innerHTML = events.length
            ? events.slice(0, 3).map(eventCard).join("")
            : '<div class="empty-state">No events yet. Add your first event from Manage Events.</div>';
    });
}

function setupEventsPage() {
    const target = document.querySelector("#events-list");
    if (!target) return;

    const search = document.querySelector("#search");
    const branch = document.querySelector("#branch-filter");
    const category = document.querySelector("#category-filter");
    const apply = document.querySelector("#apply-filters");
    const reset = document.querySelector("#reset-filters");

    const refresh = () => loadEvents(target, {
        search: search.value.trim(),
        branch: branch.value,
        category: category.value
    });

    apply.addEventListener("click", refresh);
    reset.addEventListener("click", () => {
        search.value = "";
        branch.value = "";
        category.value = "";
        refresh();
    });
    search.addEventListener("keydown", event => {
        if (event.key === "Enter") refresh();
    });
    refresh();
}

function setupRegistrationPage() {
    const form = document.querySelector("#registration-form");
    if (!form) return;

    const message = document.querySelector("#registration-message");
    const eventSelect = document.querySelector("#event_id");
    const params = new URLSearchParams(location.search);
    const selectedEvent = params.get("event");

    apiRequest(`${API}/events`).then(events => {
        eventSelect.innerHTML = '<option value="">Choose an event</option>' +
            events.map(event => `<option value="${event.event_id}">${escapeHTML(event.event_name)} — ${escapeHTML(event.branch)}</option>`).join("");
        if (selectedEvent) eventSelect.value = selectedEvent;
    }).catch(error => showMessage(message, error.message, true));

    form.addEventListener("submit", async event => {
        event.preventDefault();
        message.classList.add("hidden");

        const data = Object.fromEntries(new FormData(form).entries());
        data.year_of_study = data.year_of_study ? Number(data.year_of_study) : null;

        try {
            const result = await apiRequest(`${API}/register`, {
                method: "POST",
                body: JSON.stringify(data)
            });
            showMessage(message, result.message);
            form.reset();
        } catch (error) {
            showMessage(message, error.message, true);
        }
    });
}

function setupContactPage() {
    const form = document.querySelector("#contact-form");
    if (!form) return;
    const message = document.querySelector("#contact-message");

    form.addEventListener("submit", async event => {
        event.preventDefault();
        message.classList.add("hidden");

        try {
            const result = await apiRequest(`${API}/contact`, {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
            });
            showMessage(message, result.message);
            form.reset();
        } catch (error) {
            showMessage(message, error.message, true);
        }
    });
}

function setupManagePage() {
    const form = document.querySelector("#event-form");
    if (!form) return;

    const message = document.querySelector("#manage-message");
    const tableBody = document.querySelector("#manage-events-body");
    const registrationsBody = document.querySelector("#registrations-body");
    const submitButton = document.querySelector("#save-event");
    const cancelButton = document.querySelector("#cancel-edit");
    const eventId = document.querySelector("#event_id");
    const eventName = document.querySelector("#event_name");
    const branch = document.querySelector("#event_branch");
    const category = document.querySelector("#event_category");
    const date = document.querySelector("#event_date");
    const venue = document.querySelector("#event_venue");
    const description = document.querySelector("#event_description");

    async function refreshEvents() {
        const events = await apiRequest(`${API}/events`);
        tableBody.innerHTML = events.length ? events.map(event => `
            <tr>
                <td>${escapeHTML(event.event_id)}</td>
                <td>${escapeHTML(event.event_name)}</td>
                <td>${escapeHTML(event.branch)}</td>
                <td>${escapeHTML(event.category || "-")}</td>
                <td>${formatDate(event.event_date)}</td>
                <td>
                    <button class="small-action" data-edit="${event.event_id}">Edit</button>
                    <button class="small-action danger" data-delete="${event.event_id}">Delete</button>
                </td>
            </tr>`).join("") : '<tr><td colspan="6">No events added yet.</td></tr>';

        tableBody.querySelectorAll("[data-edit]").forEach(button => {
            button.addEventListener("click", () => {
                const event = events.find(item => item.event_id === Number(button.dataset.edit));
                if (!event) return;
                eventId.value = event.event_id;
                eventName.value = event.event_name || "";
                branch.value = event.branch || "";
                category.value = event.category || "";
                date.value = event.event_date ? String(event.event_date).slice(0, 10) : "";
                venue.value = event.venue || "";
                description.value = event.description || "";
                submitButton.textContent = "Update Event";
                cancelButton.classList.remove("hidden");
                form.scrollIntoView({ behavior: "smooth" });
            });
        });

        tableBody.querySelectorAll("[data-delete]").forEach(button => {
            button.addEventListener("click", async () => {
                if (!confirm("Delete this event?")) return;
                try {
                    const result = await apiRequest(`${API}/events/${button.dataset.delete}`, { method: "DELETE" });
                    showMessage(message, result.message);
                    await refreshEvents();
                } catch (error) {
                    showMessage(message, error.message, true);
                }
            });
        });
    }

    async function refreshRegistrations() {
        try {
            const registrations = await apiRequest(`${API}/registrations`);
            registrationsBody.innerHTML = registrations.length ? registrations.map(reg => `
                <tr>
                    <td>${escapeHTML(reg.registration_id)}</td>
                    <td>${escapeHTML(reg.student_name)}</td>
                    <td>${escapeHTML(reg.roll_number)}</td>
                    <td>${escapeHTML(reg.student_branch)}</td>
                    <td>${escapeHTML(reg.event_name)} (ID ${escapeHTML(reg.event_id)})</td>
                    <td>${escapeHTML(reg.email)}</td>
                </tr>`).join("") : '<tr><td colspan="6">No registrations yet.</td></tr>';
        } catch (error) {
            registrationsBody.innerHTML = `<tr><td colspan="6">${escapeHTML(error.message)}</td></tr>`;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const data = {
            event_name: eventName.value.trim(),
            branch: branch.value,
            category: category.value,
            event_date: date.value || null,
            venue: venue.value.trim(),
            description: description.value.trim()
        };

        try {
            const editing = Boolean(eventId.value);
            const result = await apiRequest(
                editing ? `${API}/events/${eventId.value}` : `${API}/events`,
                { method: editing ? "PUT" : "POST", body: JSON.stringify(data) }
            );
            showMessage(message, result.message);
            form.reset();
            eventId.value = "";
            submitButton.textContent = "Add Event";
            cancelButton.classList.add("hidden");
            await refreshEvents();
        } catch (error) {
            showMessage(message, error.message, true);
        }
    });

    cancelButton.addEventListener("click", () => {
        form.reset();
        eventId.value = "";
        submitButton.textContent = "Add Event";
        cancelButton.classList.add("hidden");
    });

    refreshEvents().catch(error => showMessage(message, error.message, true));
    refreshRegistrations();
}

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupHomePage();
    setupEventsPage();
    setupRegistrationPage();
    setupContactPage();
    setupManagePage();
});
