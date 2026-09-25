\# Library Management System



A MongoDB-based Library Management System developed as part of the Database Systems Lab Review 2.



\## Project Overview



The system manages books, library members, staff, book transactions, and reservations using MongoDB as the NoSQL database.



The project demonstrates CRUD operations, aggregation pipelines, indexing, document validation, ACID transactions, and Node.js integration with MongoDB Atlas.



\## Technologies Used



\- MongoDB Atlas

\- MongoDB

\- MongoDB Shell (mongosh)

\- Node.js

\- JavaScript

\- MongoDB Node.js Driver

\- dotenv

\- Git \& GitHub



\## Database



Database name:



`library\_management`



\### Collections



| Collection | Description |

|---|---|

| `books` | Stores book details, authors, copies and availability |

| `members` | Stores library member information |

| `staff` | Stores staff information |

| `transactions` | Stores book issue and return transactions |

| `reservations` | Stores book reservations |



\## Dataset



The database contains:



\- 100 Books

\- 35 Members

\- 5 Staff

\- 55 Transactions

\- 25 Reservations



\*\*Total Documents: 220\*\*



\## Features



\### 1. CRUD Operations



The project demonstrates:



\- Creating books

\- Searching books

\- Finding available copies

\- Updating book copy status

\- Updating transaction status

\- Deleting members/reservations



\### 2. Aggregation Queries



The following aggregation operations are implemented:



1\. Most borrowed books

2\. Currently overdue members

3\. Books grouped by genre

4\. Transaction status summary

5\. Fine summary by member



\### 3. Indexing



Indexes are created for:



\- Book title

\- Author name

\- Genre

\- Member ID and issue date

\- Book ID and reservation status



\### 4. Document Validation



Transaction documents use MongoDB schema validation.



Required fields and transaction status values are validated before insertion.



Allowed transaction statuses:



\- `Issued`

\- `Returned`



\### 5. ACID Transaction



A multi-document MongoDB transaction is implemented for the book issue workflow.



The transaction:



1\. Changes a book copy from `Available` to `Issued`

2\. Decreases the available copy count

3\. Creates a corresponding transaction record

4\. Commits both operations together



\### 6. Node.js Integration



The Node.js application connects to MongoDB Atlas using the MongoDB Node.js Driver.



The application demonstrates retrieving available books from the database.



\## Project Structure



```text

library-demo/

│

├── server.js

├── package.json

├── package-lock.json

├── README.md

├── .gitignore

└── .env

