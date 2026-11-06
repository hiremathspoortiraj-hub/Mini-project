COLLEGE EVENT MANAGEMENT SYSTEM - SETUP

1. Copy server.js into your existing project root.
2. Copy the five HTML files, style.css and script.js into your existing public folder.
3. Open server.js and replace YOUR_MYSQL_PASSWORD with your local MySQL password.
4. Ensure the college_event_db database and its four tables already exist in MySQL Workbench.
5. From the project root terminal run: node server.js
6. Open http://localhost:3000

API routes:
GET    /api/events
GET    /api/events/:id
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id
POST   /api/register
GET    /api/registrations
POST   /api/contact

IMPORTANT SECURITY NOTE:
The manage page and event-management API routes are not protected by login in this beginner local demo.
Do not deploy it publicly until admin authentication/authorization is added. Do not share your MySQL password.
