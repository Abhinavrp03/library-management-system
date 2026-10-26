# Library Management System

A web-based Library Management System built using **Node.js, Express.js, MongoDB Atlas, HTML, CSS, and JavaScript**.

## Features

- **Staff authentication:** Login and logout using bcrypt password hashing and server-side sessions stored in MongoDB.
- **Book management:** Add, view, search, edit, and delete books.
- **Member management:** Register and view library members.
- **Issue and return:** Manage book loans with issue dates, due dates, copy availability, and transaction records.
- **Reservations:** Create and view book reservations.
- **Analytics dashboard:** Five MongoDB aggregation reports covering popular books, overdue loans, books by genre, transaction status, and fines.
- **Database operations:** CRUD, aggregation pipelines, indexes, schema validation, and transaction testing.
- **Responsive interface:** Web dashboard designed for desktop and mobile screens.

## Technology Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express.js
- Database: MongoDB Atlas
- Authentication: bcryptjs, express-session, connect-mongo
- Version control: Git and GitHub

## Project Structure

```text
library-demo/
├── public/
│   └── index.html
├── server.js
├── setup-admin.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

## Setup Instructions

1. Install Node.js.
2. Clone this repository.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root:

   ```env
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_random_session_secret
   PORT=3000
   ```

5. Configure the MongoDB Atlas database and ensure the required collections and sample data exist.
6. If setting up the administrator account, use the provided `setup-admin.js` script and create a strong password privately.
7. Start the application:

   ```bash
   node server.js
   ```

8. Open `http://localhost:3000` in your browser and log in using your configured staff account.

## Analytics Reports

1. Most borrowed books
2. Currently overdue loans
3. Books grouped by genre
4. Transaction status summary
5. Fine summary by member

## Security Notes

- Never commit `.env`, database credentials, or session secrets.
- Passwords are stored as bcrypt hashes.
- Write operations require an authenticated staff session.
- For production deployment, use HTTPS, secure cookies, rate limiting, and appropriate database access controls.

## Academic Purpose

This project demonstrates document-oriented database design, CRUD operations, aggregation, indexing, validation, transaction handling, authentication, and a web-based interface for a Library Management System.
